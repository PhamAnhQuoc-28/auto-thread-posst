import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import Fastify, { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { Post, SessionSlot } from '../posts/post.types';
import { resolveExistingPostImages, validatePosts } from '../posts/post.repository';
import { dateInTimeZone, planSession, postsForSession, validateProducts, validateSessionConfig } from '../session/session.plan';
import { describeUnsupportedEmoji } from '../emoji/compatibility';

const imageMime: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

function readJson(filePath: string, fallback: unknown): unknown {
  return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf-8')) : fallback;
}

function saveJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
    fs.renameSync(tempPath, filePath);
  } finally {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  }
}

function isImage(buffer: Buffer, mime: string): boolean {
  if (mime === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mime === 'image/webp') return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  return false;
}

function badRequest(error: unknown): Error & { statusCode: number } {
  const issue = new Error(error instanceof Error ? error.message : String(error)) as Error & { statusCode: number };
  issue.statusCode = 400;
  return issue;
}

export function createEditorServer(rootDir: string = process.cwd(), serveUi = true): FastifyInstance {
  const app = Fastify({ bodyLimit: 2 * 1024 * 1024 });
  const dataDir = path.join(rootDir, 'data');
  const productsPath = path.join(dataDir, 'products.json');
  const configPath = path.join(dataDir, 'session-config.json');
  const postsPath = path.join(dataDir, 'posts.json');
  const mediaDir = path.join(dataDir, 'media');

  const productsDir = path.join(dataDir, 'products');

  const readCatalog = () => {
    let rawProductsArr: any[] = [];
    let hashContent = '';
    if (fs.existsSync(productsDir)) {
      const files = fs.readdirSync(productsDir).filter(f => f.endsWith('.json')).sort();
      for (const file of files) {
        const content = fs.readFileSync(path.join(productsDir, file), 'utf-8');
        rawProductsArr.push(JSON.parse(content));
        hashContent += content;
      }
    } else if (fs.existsSync(productsPath)) {
      const content = fs.existsSync(productsPath) ? fs.readFileSync(productsPath, 'utf-8') : '[]\n';
      rawProductsArr = JSON.parse(content);
      hashContent = content;
    }
    const rawConfig = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf-8') : '{"intervalMinutes":10,"timeZone":"Asia/Ho_Chi_Minh"}\n';
    const products = validateProducts(rawProductsArr, rootDir, true)
      .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id));
    const config = validateSessionConfig(JSON.parse(rawConfig));
    const revision = crypto.createHash('sha256').update(hashContent).update('\n').update(rawConfig).digest('hex');
    return { products, config, revision };
  };
  const readHistory = (): Post[] => validatePosts(readJson(postsPath, []), rootDir);

  app.addHook('onRequest', async (request, reply) => {
    const host = request.headers.host?.split(':')[0];
    if (host && host !== '127.0.0.1' && host !== 'localhost') return reply.code(403).send({ error: 'Local access only' });
    if (request.method === 'GET' || request.method === 'HEAD') return;
    const origin = request.headers.origin;
    if (origin && origin !== `http://${request.headers.host}`) {
      return reply.code(403).send({ error: 'Local access only' });
    }
  });

  app.setErrorHandler((error, _request, reply) => {
    const issue = error as Error & { statusCode?: number };
    const status = issue.statusCode && issue.statusCode >= 400 && issue.statusCode < 500 ? issue.statusCode : 500;
    reply.code(status).send({ error: status === 500 ? 'Server error. Check the editor console.' : issue.message });
    if (status === 500) console.error(error);
  });

  app.get('/api/catalog', async () => readCatalog());

  app.put('/api/catalog', async (request, reply) => {
    const body = request.body as { products?: unknown; config?: unknown; revision?: unknown } | null;
    if (!body || typeof body.revision !== 'string') return reply.code(400).send({ error: 'Missing catalog revision' });
    const current = readCatalog();
    if (body.revision !== current.revision) return reply.code(409).send({ error: 'Data changed on disk. Reload the editor before saving.' });
    let products;
    let config;
    try {
      products = validateProducts(body.products, rootDir, true);
      products.forEach((product, index) => { product.order = index; });
      config = validateSessionConfig(body.config);
      for (const product of products) for (const content of product.contents) {
        const emojiIssue = describeUnsupportedEmoji(content.text);
        if (emojiIssue) throw new Error(`Content ${content.id}: ${emojiIssue}`);
        resolveExistingPostImages(content.images, rootDir);
      }
    } catch (error) {
      throw badRequest(error);
    }
    fs.mkdirSync(productsDir, { recursive: true });
    const currentFiles = fs.readdirSync(productsDir).filter(f => f.endsWith('.json'));
    const newProductIds = products.map(p => p.id);
    for (const file of currentFiles) {
      if (!newProductIds.includes(file.replace('.json', ''))) {
        fs.unlinkSync(path.join(productsDir, file));
      }
    }
    for (const product of products) {
      saveJson(path.join(productsDir, `${product.id}.json`), product);
    }
    if (fs.existsSync(productsPath)) fs.unlinkSync(productsPath);
    saveJson(configPath, config);
    return { ...readCatalog(), saved: true };
  });

  app.get('/api/preview', async (request, reply) => {
    const { slot } = request.query as { slot?: string };
    if (slot !== 'morning' && slot !== 'afternoon') return reply.code(400).send({ error: 'Choose morning or afternoon' });
    const { products, config } = readCatalog();
    const history = readHistory();
    const date = dateInTimeZone(new Date(), config.timeZone);
    const existing = postsForSession(history, date, slot);
    const otherSlot: SessionSlot = slot === 'morning' ? 'afternoon' : 'morning';
    const otherPosts = postsForSession(history, date, otherSlot);
    const blocked = otherPosts.some(post => ['draft', 'pending', 'publishing'].includes(post.status));
    let planned: Post[];
    try {
      planned = existing.length ? existing : (products.length || otherPosts.length)
        ? planSession(history, otherPosts.length ? [] : products, date, slot, new Date(), config.intervalMinutes, rootDir)
        : [];
    } catch (error) {
      throw badRequest(error);
    }
    return {
      date, slot, dayNumber: planned[0]?.session?.dayNumber ?? null,
      intervalMinutes: config.intervalMinutes, existing: existing.length > 0, blocked,
      posts: planned.map(post => ({
        id: post.id, productId: post.session?.productId, contentId: post.session?.contentId,
        text: post.text, topic: post.topic ?? null, images: post.images ?? [],
        scheduledAt: post.scheduledAt, status: post.status
      }))
    };
  });

  app.register(multipart, { limits: { fileSize: 15 * 1024 * 1024, files: 1 } });
  app.post('/api/media', async (request, reply) => {
    const { productId } = request.query as { productId?: string };
    if (!productId || !/^[a-zA-Z0-9_-]+$/.test(productId)) return reply.code(400).send({ error: 'Save a valid product ID before uploading images' });
    const file = await request.file();
    if (!file) return reply.code(400).send({ error: 'Choose an image' });
    const extension = imageMime[file.mimetype];
    if (!extension) return reply.code(400).send({ error: 'Only JPG, PNG and WebP images are supported' });
    const buffer = await file.toBuffer();
    if (!buffer.length || !isImage(buffer, file.mimetype)) return reply.code(400).send({ error: 'The selected file is not a valid image' });
    const directory = path.join(mediaDir, productId);
    fs.mkdirSync(directory, { recursive: true });
    const fileName = `${crypto.randomUUID()}${extension}`;
    fs.writeFileSync(path.join(directory, fileName), buffer, { flag: 'wx' });
    return { path: `data/media/${productId}/${fileName}` };
  });

  app.get('/api/media/:productId/:fileName', async (request, reply) => {
    const { productId, fileName } = request.params as { productId: string; fileName: string };
    if (!/^[a-zA-Z0-9_-]+$/.test(productId) || !/^[a-zA-Z0-9._-]+\.(jpe?g|png|webp)$/i.test(fileName)) {
      return reply.code(400).send({ error: 'Invalid image path' });
    }
    const filePath = path.join(mediaDir, productId, fileName);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return reply.code(404).send({ error: 'Image not found' });
    const mime = fileName.toLowerCase().endsWith('.png') ? 'image/png' : fileName.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/jpeg';
    return reply.type(mime).header('Cache-Control', 'private, max-age=3600').send(fs.createReadStream(filePath));
  });

  if (serveUi) {
    const uiDir = path.join(rootDir, 'ui', 'dist');
    if (!fs.existsSync(path.join(uiDir, 'index.html'))) throw new Error('UI is not built. Run npm run build:ui first.');
    app.register(fastifyStatic, { root: uiDir, prefix: '/' });
  }
  return app;
}

if (require.main === module) {
  const port = Number(process.env.EDITOR_PORT || 4173);
  const app = createEditorServer();
  app.listen({ host: '127.0.0.1', port }).then(address => {
    console.log(`Threads editor: ${address}`);
    if (process.env.EDITOR_NO_BROWSER !== '1' && process.platform === 'win32') {
      spawn('cmd.exe', ['/c', 'start', '', address], { detached: true, windowsHide: true, stdio: 'ignore' }).unref();
    }
  }).catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
