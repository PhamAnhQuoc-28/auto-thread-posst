import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { describeUnsupportedEmoji } from '../emoji/compatibility';
import { Product, ProductContent, validateProducts } from '../session/session.plan';

type ScrapedPost = { text: string; mediaUrls: string[]; author?: string };
type ReviewItem = {
  index: number;
  include: boolean;
  productId: string;
  productName: string;
  action: 'append' | 'replace';
  contentId: string | null;
  text: string;
  topic: string | null;
  mediaUrls: string[];
  mediaIndexes: number[];
  notes: string[];
};
export type ImportReview = { sourceFile: string; account: string; items: ReviewItem[] };
type DownloadedImage = { bytes: Buffer; extension: '.jpg' | '.png' | '.webp' };
type DownloadImage = (url: string) => Promise<DownloadedImage>;

const timeLine = /^\d+(?:[smhdw]|mo|y)$/i;
const metricLine = /^(?:\d+(?:[.,]\d+)?[KMB]?|Views)$/i;
const imageTypes: Record<string, DownloadedImage['extension']> = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp'
};
const maxImageBytes = 15 * 1024 * 1024;

export function cleanScrapedPost(rawText: string, account: string): { text: string; topic: string | null } {
  const lines = rawText.replace(/\r\n/g, '\n').split('\n').map(line => line.trim());
  if (lines[0]?.replace(/^@/, '').toLowerCase() === account.replace(/^@/, '').toLowerCase()) lines.shift();
  let topic: string | null = null;
  if (lines.length >= 2 && timeLine.test(lines[1]) && !timeLine.test(lines[0])) topic = lines.shift() || null;
  if (timeLine.test(lines[0] || '')) lines.shift();
  let text = lines.join('\n').replace(/[\s\u00a0]*Translate(?:\n[\s\S]*)?$/i, '').trim();
  if (text === lines.join('\n').trim()) {
    const bodyLines = text.split('\n');
    while (bodyLines.length > 1 && metricLine.test(bodyLines.at(-1)!.trim())) bodyLines.pop();
    text = bodyLines.join('\n').trim();
  }
  return { text, topic };
}

function mediaKind(url: string): 'image' | 'video' | 'unknown' {
  try {
    const extension = path.posix.extname(new URL(url).pathname).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp'].includes(extension)) return 'image';
    if (['.mp4', '.mov'].includes(extension)) return 'video';
  } catch { /* Invalid URLs are reported during apply. */ }
  return 'unknown';
}

export function makeReview(posts: ScrapedPost[], account: string, sourceFile: string): ImportReview {
  return {
    sourceFile, account: account.replace(/^@/, ''),
    items: posts.map((post, index) => {
      const cleaned = cleanScrapedPost(post.text, account);
      const mediaIndexes = post.mediaUrls.flatMap((url, mediaIndex) => mediaKind(url) === 'image' ? [mediaIndex] : []);
      const notes: string[] = [];
      if (post.mediaUrls.some(url => mediaKind(url) === 'video')) notes.push('Có video; bản chuyển đổi hiện chỉ tải ảnh. Kiểm tra bài gốc trước khi chọn.');
      if (post.mediaUrls.some(url => mediaKind(url) === 'unknown')) notes.push('Có URL media không nhận diện được.');
      const emojiIssue = describeUnsupportedEmoji(cleaned.text);
      if (emojiIssue) notes.push(emojiIssue);
      if (!cleaned.text) notes.push('Không tách được nội dung bài viết.');
      return {
        index, include: false, productId: '', productName: '', action: 'append', contentId: null,
        text: cleaned.text, topic: cleaned.topic, mediaUrls: post.mediaUrls,
        mediaIndexes, notes
      };
    })
  };
}

function assertCdnUrl(value: string): URL {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || !(host.endsWith('.fbcdn.net') || host.endsWith('.cdninstagram.com'))) {
    throw new Error(`Media URL must use a Threads/Instagram HTTPS CDN: ${value}`);
  }
  return url;
}

export async function downloadImage(url: string): Promise<DownloadedImage> {
  assertCdnUrl(url);
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Media download failed (HTTP ${response.status}); scrape the account again if its URL expired.`);
  assertCdnUrl(response.url);
  const extension = imageTypes[response.headers.get('content-type')?.split(';')[0].toLowerCase() || ''];
  if (!extension) throw new Error(`Only JPG, PNG and WebP can be imported; received ${response.headers.get('content-type')}`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Media response has no body');
  const chunks: Buffer[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxImageBytes) { await reader.cancel(); throw new Error('Image exceeds 15 MB'); }
    chunks.push(Buffer.from(value));
  }
  const bytes = Buffer.concat(chunks);
  const valid = extension === '.jpg' ? bytes[0] === 0xff && bytes[1] === 0xd8
    : extension === '.png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!valid) throw new Error('Downloaded media does not match its image type');
  return { bytes, extension };
}

function readProducts(rootDir: string): Map<string, Product> {
  const directory = path.join(rootDir, 'data', 'products');
  const products = new Map<string, Product>();
  if (!fs.existsSync(directory)) {
    if (fs.existsSync(path.join(rootDir, 'data', 'products.json'))) {
      throw new Error('Project still uses data/products.json. Open and save it in the editor to migrate before importing.');
    }
    return products;
  }
  for (const file of fs.readdirSync(directory).filter(file => file.endsWith('.json'))) {
    const product = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8')) as Product;
    if (file !== `${product.id}.json`) throw new Error(`Product filename and id differ: ${file}`);
    validateProducts([product], rootDir);
    products.set(product.id, product);
  }
  return products;
}

export async function applyReview(
  review: ImportReview, rootDir: string,
  fetchImage: DownloadImage = downloadImage
): Promise<{ imported: number; skipped: number; files: string[] }> {
  const products = readProducts(rootDir);
  const selected = review.items.filter(item => item.include);
  if (!selected.length) throw new Error('Chưa chọn bài nào: đặt include=true cho các bài muốn nhập.');
  const usedIndexes = new Set<number>();
  const stagedMedia: { filePath: string; bytes: Buffer }[] = [];
  const changed = new Set<string>();
  let skipped = 0;

  for (const item of selected) {
    if (!Number.isInteger(item.index) || item.index < 0 || usedIndexes.has(item.index)) throw new Error(`Invalid or duplicate source index: ${item.index}`);
    usedIndexes.add(item.index);
    if (!/^[a-zA-Z0-9_-]+$/.test(item.productId)) throw new Error(`Choose a valid productId for post ${item.index}`);
    if (item.action !== 'append' && item.action !== 'replace') throw new Error(`Choose append or replace for post ${item.index}`);
    if (!item.text.trim()) throw new Error(`Post ${item.index} has no text`);
    const emojiIssue = describeUnsupportedEmoji(item.text);
    if (emojiIssue) throw new Error(`Post ${item.index}: ${emojiIssue}`);
    const product = products.get(item.productId) ?? {
      id: item.productId, name: item.productName.trim(),
      order: Math.max(-1, ...[...products.values()].map(existing => existing.order ?? -1)) + 1,
      contents: []
    };
    if (!product.name) throw new Error(`Enter productName for new product ${item.productId}`);
    if (product.contents.some(content => content.importedFrom?.account === review.account && content.importedFrom.postIndex === item.index)) {
      skipped++;
      continue;
    }
    if (!Array.isArray(item.mediaIndexes) || !Array.isArray(item.mediaUrls)) throw new Error(`Post ${item.index} has invalid media selection`);
    const mediaIndexes = new Set(item.mediaIndexes);
    if (mediaIndexes.size !== item.mediaIndexes.length) throw new Error(`Post ${item.index} repeats a media index`);
    const images: string[] = [];
    for (const mediaIndex of item.mediaIndexes) {
      const url = item.mediaUrls[mediaIndex];
      if (!Number.isInteger(mediaIndex) || mediaKind(url) !== 'image') throw new Error(`Post ${item.index} media ${mediaIndex} is not an image`);
      const { bytes, extension } = await fetchImage(url);
      const digest = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 24);
      const fileName = `${digest}${extension}`;
      const relative = `data/media/${product.id}/${fileName}`;
      const filePath = path.join(rootDir, relative);
      if (fs.existsSync(filePath) && !fs.readFileSync(filePath).equals(bytes)) throw new Error(`Media filename collision: ${relative}`);
      stagedMedia.push({ filePath, bytes });
      images.push(relative);
    }
    const replacementIndex = item.action === 'replace' ? product.contents.findIndex(content => content.id === item.contentId) : -1;
    if (item.action === 'replace' && replacementIndex < 0) throw new Error(`Content ${item.contentId} not found in ${product.id}`);
    const nextNumber = Math.max(0, ...product.contents.map(content => /^v\d+$/.test(content.id) ? Number(content.id.slice(1)) : 0)) + 1;
    const content: ProductContent = {
      id: item.action === 'replace' ? item.contentId! : `v${nextNumber}`,
      text: item.text.trim(), images, topic: item.topic || null,
      importedFrom: { account: review.account, postIndex: item.index }
    };
    if (replacementIndex >= 0) product.contents[replacementIndex] = content;
    else product.contents.push(content);
    products.set(product.id, product);
    changed.add(product.id);
  }

  if (!changed.size) return { imported: 0, skipped, files: [] };
  for (const id of changed) validateProducts([products.get(id)!], rootDir);
  for (const { filePath, bytes } of stagedMedia) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, bytes, { flag: 'wx' });
  }
  const files: string[] = [];
  const directory = path.join(rootDir, 'data', 'products');
  fs.mkdirSync(directory, { recursive: true });
  for (const id of changed) {
    const filePath = path.join(directory, `${id}.json`);
    const tempPath = `${filePath}.${crypto.randomUUID()}.tmp`;
    try {
      fs.writeFileSync(tempPath, JSON.stringify(products.get(id), null, 2) + '\n', { flag: 'wx' });
      fs.renameSync(tempPath, filePath);
    } finally {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
    files.push(filePath);
  }
  return { imported: selected.length - skipped, skipped, files };
}

async function main(): Promise<void> {
  const [mode, input] = process.argv.slice(2);
  if (!['preview', 'apply'].includes(mode) || !input) {
    throw new Error('Usage: npm run convert:scraped -- preview data/scraped/<account>_posts.json | apply data/imports/<account>.review.json');
  }
  const inputPath = path.resolve(input);
  if (mode === 'preview') {
    const sourceName = path.basename(inputPath).match(/^(.+)_posts\.json$/i);
    if (!sourceName) throw new Error('Scraped filename must be <account>_posts.json');
    const account = sourceName[1];
    const posts = JSON.parse(fs.readFileSync(inputPath, 'utf8')) as ScrapedPost[];
    if (!Array.isArray(posts) || posts.some(post => typeof post.text !== 'string' || !Array.isArray(post.mediaUrls))) throw new Error('Invalid scraped data');
    const review = makeReview(posts, account, path.relative(process.cwd(), inputPath).replace(/\\/g, '/'));
    const output = path.resolve('data', 'imports', `${account}.review.json`);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    if (fs.existsSync(output)) throw new Error(`Review already exists; move or rename it before regenerating: ${output}`);
    fs.writeFileSync(output, JSON.stringify(review, null, 2) + '\n', { flag: 'wx' });
    console.log(`Review ${review.items.length} posts in ${output}; set include=true and productId for selected posts, then run apply.`);
    for (const item of review.items) {
      const excerpt = item.text.replace(/\s+/g, ' ').slice(0, 90);
      console.log(`[${item.index}] ${item.topic || 'no topic'} | ${item.mediaIndexes.length} image(s) | ${excerpt}${item.notes.length ? ` | ${item.notes.length} warning(s)` : ''}`);
    }
  } else {
    const review = JSON.parse(fs.readFileSync(inputPath, 'utf8')) as ImportReview;
    const result = await applyReview(review, process.cwd());
    console.log(`Imported ${result.imported} post(s), skipped ${result.skipped} already imported; updated ${result.files.length} product file(s).`);
  }
}

if (require.main === module) main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
