import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createEditorServer } from '../src/editor/server';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==', 'base64');

test('editor saves products and media, previews the session, and rejects stale saves', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'threads-editor-test-'));
  const app = createEditorServer(root, false);
  try {
    const initial = await app.inject({ method: 'GET', url: '/api/catalog' });
    assert.equal(initial.statusCode, 200);
    const revision = initial.json().revision as string;

    const boundary = '----threads-editor-test-boundary';
    const multipart = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="tiny.png"\r\nContent-Type: image/png\r\n\r\n`),
      png,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);
    const upload = await app.inject({
      method: 'POST', url: '/api/media?productId=product-a',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: multipart
    });
    assert.equal(upload.statusCode, 200, upload.body);
    const imagePath = upload.json().path as string;
    assert.match(imagePath, /^data\/media\/product-a\/[a-f0-9-]+\.png$/);
    assert.equal(fs.existsSync(path.join(root, imagePath)), true);

    const products = [{ id: 'product-a', name: 'A', contents: [
      { id: 'a1', text: 'A1', topic: 'squishy', images: [imagePath] },
      { id: 'a2', text: 'A2', topic: null, images: [] }
    ] }];
    const config = { intervalMinutes: 10, timeZone: 'Asia/Ho_Chi_Minh' };
    const save = await app.inject({ method: 'PUT', url: '/api/catalog', payload: { products, config, revision } });
    assert.equal(save.statusCode, 200, save.body);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'data', 'products.json'), 'utf-8')), products);

    const image = await app.inject({ method: 'GET', url: `/api/media/${imagePath.slice('data/media/'.length)}` });
    assert.equal(image.statusCode, 200);
    assert.deepEqual(image.rawPayload, png);

    const preview = await app.inject({ method: 'GET', url: '/api/preview?slot=morning' });
    assert.equal(preview.statusCode, 200, preview.body);
    assert.equal(preview.json().posts[0].text, 'A1');
    assert.equal(preview.json().posts[0].topic, 'squishy');
    assert.equal(fs.existsSync(path.join(root, 'data', 'posts.json')), false);

    const stale = await app.inject({ method: 'PUT', url: '/api/catalog', payload: { products, config, revision } });
    assert.equal(stale.statusCode, 409);
    const missingImage = await app.inject({
      method: 'PUT', url: '/api/catalog',
      payload: { products: [{ ...products[0], contents: [{ ...products[0].contents[0], images: ['data/media/product-a/missing.png'] }] }], config, revision: save.json().revision }
    });
    assert.equal(missingImage.statusCode, 400);
    const unsupportedEmoji = await app.inject({
      method: 'PUT', url: '/api/catalog',
      payload: { products: [{ ...products[0], contents: [{ ...products[0].contents[0], text: 'Emoji lỗi 🫩' }] }], config, revision: save.json().revision }
    });
    assert.equal(unsupportedEmoji.statusCode, 400);
    assert.match(unsupportedEmoji.json().error, /U\+1FAE9/);
  } finally {
    await app.close();
    const tempRoot = path.resolve(os.tmpdir());
    const resolved = path.resolve(root);
    if (!resolved.startsWith(tempRoot + path.sep) || !path.basename(resolved).startsWith('threads-editor-test-')) {
      throw new Error('Unsafe test cleanup path');
    }
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});
