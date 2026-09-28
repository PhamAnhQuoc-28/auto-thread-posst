import fs from 'fs';
import path from 'path';
import { Post, PostStatus } from './post.types';
import { Logger } from '../utils/logger';

const projectRoot = process.cwd();
const scheduledAtPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const statuses: PostStatus[] = ['draft', 'pending', 'publishing', 'needs_review', 'published', 'failed'];

export function resolvePostImage(imagePath: string, rootDir: string = projectRoot): string {
  if (typeof imagePath !== 'string' || !imagePath.replace(/\\/g, '/').startsWith('data/media/')) {
    throw new Error(`Image path must start with data/media/: ${String(imagePath)}`);
  }
  const resolved = path.resolve(rootDir, imagePath);
  const mediaRoot = path.resolve(rootDir, 'data', 'media');
  const relative = path.relative(mediaRoot, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Image path is outside data/media/: ${imagePath}`);
  }
  if (!/\.(jpe?g|png|webp)$/i.test(resolved)) {
    throw new Error(`Unsupported image file: ${imagePath}`);
  }
  return resolved;
}

export function resolveExistingPostImages(images: string[], rootDir: string = projectRoot): string[] {
  return images.map(image => {
    const resolved = resolvePostImage(image, rootDir);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      throw new Error(`Image file not found: ${image}`);
    }
    if (fs.statSync(resolved).size === 0) {
      throw new Error(`Image file is empty: ${image}`);
    }
    return resolved;
  });
}

export function validatePosts(value: unknown, rootDir: string = projectRoot): Post[] {
  if (!Array.isArray(value)) throw new Error('data/posts.json must contain a JSON array');
  const ids = new Set<string>();
  for (const [index, item] of value.entries()) {
    const label = `Post at index ${index}`;
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`${label} must be an object`);
    const post = item as Partial<Post>;
    if (typeof post.id !== 'string' || !post.id.trim()) throw new Error(`${label} needs a nonempty id`);
    if (ids.has(post.id)) throw new Error(`Duplicate post id: ${post.id}`);
    ids.add(post.id);
    if (typeof post.text !== 'string') throw new Error(`Post ${post.id} needs text`);
    if (!statuses.includes(post.status as PostStatus)) throw new Error(`Post ${post.id} has invalid status`);
    if (post.images !== undefined) {
      if (!Array.isArray(post.images)) throw new Error(`Post ${post.id} images must be an array`);
      for (const image of post.images) resolvePostImage(image, rootDir);
    }
    if (post.topic != null && (typeof post.topic !== 'string' || !post.topic.trim() || post.topic !== post.topic.trim())) {
      throw new Error(`Post ${post.id} topic must be a nonempty label without surrounding spaces`);
    }
    if (post.scheduledAt != null) {
      if (typeof post.scheduledAt !== 'string' || !scheduledAtPattern.test(post.scheduledAt) || Number.isNaN(Date.parse(post.scheduledAt))) {
        throw new Error(`Post ${post.id} scheduledAt must be ISO 8601 with a timezone offset`);
      }
    }
    if (post.session !== undefined) {
      const session = post.session;
      if (!session || !/^\d{4}-\d{2}-\d{2}$/.test(session.date) ||
          !['morning', 'afternoon'].includes(session.slot) ||
          !Number.isInteger(session.dayNumber) || session.dayNumber < 1 ||
          !Number.isInteger(session.order) || session.order < 0 ||
          typeof session.productId !== 'string' || !session.productId ||
          typeof session.contentId !== 'string' || !session.contentId) {
        throw new Error(`Post ${post.id} has invalid session metadata`);
      }
    }
    if (post.status === 'pending' && !post.text.trim() && !post.images?.length) {
      throw new Error(`Post ${post.id} needs text or an image before publishing`);
    }
  }
  return value as Post[];
}

export function selectNextPendingPost(posts: Post[], now: Date = new Date(), scheduledOnly = false): Post | null {
  const candidates = posts.filter(post =>
    post.status === 'pending' &&
    post.session === undefined &&
    (!scheduledOnly || post.scheduledAt != null) &&
    (post.scheduledAt == null || Date.parse(post.scheduledAt) <= now.getTime())
  );
  candidates.sort((a, b) => {
    const aTime = a.scheduledAt == null ? Number.MAX_SAFE_INTEGER : Date.parse(a.scheduledAt);
    const bTime = b.scheduledAt == null ? Number.MAX_SAFE_INTEGER : Date.parse(b.scheduledAt);
    return aTime - bTime;
  });
  return candidates[0] ?? null;
}

export class PostRepository {
  private static dataPath = path.resolve(projectRoot, 'data', 'posts.json');

  static readAll(): Post[] {
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(path.dirname(this.dataPath), { recursive: true });
      fs.writeFileSync(this.dataPath, '[]\n');
      return [];
    }
    try {
      return validatePosts(JSON.parse(fs.readFileSync(this.dataPath, 'utf-8')));
    } catch (error) {
      Logger.error('Could not read data/posts.json', error);
      throw error;
    }
  }

  static saveAll(posts: Post[]): void {
    validatePosts(posts);
    fs.mkdirSync(path.dirname(this.dataPath), { recursive: true });
    const tempPath = `${this.dataPath}.${process.pid}.tmp`;
    try {
      fs.writeFileSync(tempPath, JSON.stringify(posts, null, 2) + '\n');
      fs.renameSync(tempPath, this.dataPath);
    } finally {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  }

  static getNextPendingPost(now: Date = new Date(), scheduledOnly = false): Post | null {
    return selectNextPendingPost(this.readAll(), now, scheduledOnly);
  }

  static updateStatus(id: string, status: PostStatus, errorMsg: string | null = null): void {
    const posts = this.readAll();
    const post = posts.find(item => item.id === id);
    if (!post) throw new Error(`Post not found: ${id}`);
    post.status = status;
    if (status === 'published') {
      post.publishedAt = new Date().toISOString();
      post.error = null;
    } else if (status === 'needs_review') {
      post.submittedAt = new Date().toISOString();
      post.error = 'Post button was clicked, but publication has not been verified.';
    } else if (errorMsg !== null) {
      post.error = errorMsg;
    } else if (status === 'pending' || status === 'publishing') {
      post.error = null;
    }
    this.saveAll(posts);
    Logger.info(`Updated post ${id} status to ${status}`);
  }
}
