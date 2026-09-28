import fs from 'fs';
import path from 'path';
import { Post, SessionSlot } from '../posts/post.types';
import { resolveExistingPostImages, resolvePostImage } from '../posts/post.repository';
import { describeUnsupportedEmoji } from '../emoji/compatibility';

export interface ProductContent {
  id: string;
  text: string;
  images: string[];
  topic?: string | null;
}

export interface Product {
  id: string;
  name: string;
  contents: ProductContent[];
}

export interface SessionConfig {
  intervalMinutes: number;
  timeZone: string;
}

export function loadSessionConfig(): SessionConfig {
  const configPath = path.resolve(process.cwd(), 'data', 'session-config.json');
  return validateSessionConfig(JSON.parse(fs.readFileSync(configPath, 'utf-8')));
}

export function validateSessionConfig(value: unknown): SessionConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid session configuration');
  const config = value as Partial<SessionConfig>;
  if (typeof config.intervalMinutes !== 'number' || !Number.isInteger(config.intervalMinutes) || config.intervalMinutes < 1) {
    throw new Error('intervalMinutes must be a positive whole number');
  }
  if (typeof config.timeZone !== 'string' || !config.timeZone.trim()) {
    throw new Error('timeZone must be an IANA time zone name');
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: config.timeZone });
  } catch {
    throw new Error(`Invalid timeZone: ${config.timeZone}`);
  }
  return config as SessionConfig;
}

export function loadProducts(): Product[] {
  const productsPath = path.resolve(process.cwd(), 'data', 'products.json');
  const value: unknown = JSON.parse(fs.readFileSync(productsPath, 'utf-8'));
  return validateProducts(value);
}

export function validateProducts(value: unknown, rootDir: string = process.cwd(), allowEmpty = false): Product[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    throw new Error('data/products.json needs at least one product');
  }
  const ids = new Set<string>();
  for (const product of value) {
    if (!product || typeof product !== 'object' || !/^[a-zA-Z0-9_-]+$/.test(product.id) || ids.has(product.id)) {
      throw new Error('Each product needs a unique id using letters, numbers, _ or -');
    }
    ids.add(product.id);
    if (typeof product.name !== 'string' || !product.name.trim()) throw new Error(`Product ${product.id} needs a name`);
    if (!Array.isArray(product.contents) || !product.contents.length) throw new Error(`Product ${product.id} needs content variants`);
    const contentIds = new Set<string>();
    for (const content of product.contents) {
      if (!content || typeof content.id !== 'string' || !content.id.trim() || contentIds.has(content.id)) {
        throw new Error(`Product ${product.id} has a missing or duplicate content id`);
      }
      contentIds.add(content.id);
      if (typeof content.text !== 'string' || !Array.isArray(content.images)) {
        throw new Error(`Content ${content.id} needs text and an images array`);
      }
      if (!content.text.trim() && !content.images.length) throw new Error(`Content ${content.id} is empty`);
      if (content.topic != null && (typeof content.topic !== 'string' || !content.topic.trim() || content.topic !== content.topic.trim())) {
        throw new Error(`Content ${content.id} topic must be a nonempty label without surrounding spaces`);
      }
      for (const image of content.images) resolvePostImage(image, rootDir);
    }
  }
  return value as Product[];
}

export function dateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function sessionId(date: string, slot: SessionSlot): string {
  return `${date}-${slot}`;
}

export function postsForSession(posts: Post[], date: string, slot: SessionSlot): Post[] {
  return posts.filter(post => post.session?.date === date && post.session.slot === slot)
    .sort((a, b) => a.session!.order - b.session!.order);
}

export function nextSessionPost(posts: Post[]): Post | null {
  const stopped = posts.find(post => post.status === 'publishing' || post.status === 'draft');
  if (stopped) throw new Error(`Session stopped at ${stopped.id} (${stopped.status})`);
  return posts.find(post => post.status === 'pending') ?? null;
}

export function nextDueTime(posts: Post[], next: Post, intervalMinutes: number): number {
  const scheduled = next.scheduledAt ? Date.parse(next.scheduledAt) : 0;
  const previous = posts.slice(0, next.session!.order).reverse()
    .find(post => post.status === 'needs_review' || post.status === 'published' || post.submittedAt || post.publishedAt);
  if (!previous) return scheduled;
  const submitted = previous.submittedAt ?? previous.publishedAt;
  if (!submitted) throw new Error(`Previous post ${previous.id} has no submission time; check its status`);
  return Math.max(scheduled, Date.parse(submitted) + intervalMinutes * 60_000);
}

export function planSession(
  history: Post[], products: Product[], date: string, slot: SessionSlot,
  startedAt: Date, intervalMinutes: number, rootDir: string = process.cwd()
): Post[] {
  if (postsForSession(history, date, slot).length) throw new Error(`Session ${sessionId(date, slot)} already exists`);
  const runDates = [...new Set(history.flatMap(post => post.session ? [post.session.date] : []))].sort();
  if (runDates.some(runDate => runDate > date)) throw new Error('A session exists in the future; check the computer clock');
  const dayNumber = runDates.includes(date) ? runDates.indexOf(date) + 1 : runDates.length + 1;

  // The second run on a date copies the first run's content snapshot.
  const earlierSlot: SessionSlot = slot === 'morning' ? 'afternoon' : 'morning';
  const earlierPosts = postsForSession(history, date, earlierSlot);
  const content = earlierPosts.length
    ? earlierPosts.map(post => ({ productId: post.session!.productId, contentId: post.session!.contentId, text: post.text, images: post.images ?? [], topic: post.topic }))
    : products.map(product => {
        const variant = product.contents[(dayNumber - 1) % product.contents.length];
        return { productId: product.id, contentId: variant.id, text: variant.text, images: variant.images, topic: variant.topic };
      });

  return content.map((item, order) => {
    const emojiIssue = describeUnsupportedEmoji(item.text);
    if (emojiIssue) throw new Error(`Content ${item.contentId}: ${emojiIssue}`);
    resolveExistingPostImages(item.images, rootDir);
    return {
      id: `run-${date}-${slot}-${item.productId}`,
      text: item.text,
      images: [...item.images],
      topic: item.topic ?? null,
      scheduledAt: new Date(startedAt.getTime() + order * intervalMinutes * 60_000).toISOString(),
      status: 'pending',
      createdAt: startedAt.toISOString(),
      submittedAt: null,
      publishedAt: null,
      error: null,
      session: { date, slot, dayNumber, productId: item.productId, contentId: item.contentId, order }
    };
  });
}
