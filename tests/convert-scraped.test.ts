import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { applyReview, cleanScrapedPost, makeReview } from '../src/import/convert-scraped';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==', 'base64');

test('cleans scraped UI text and keeps the topic', () => {
  assert.deepEqual(cleanScrapedPost('nuis07.studio\nsquishy\n2d\nBài thử 😋\n📍Shop online Da Nang  Translate\n13\n45', 'nuis07.studio'), {
    text: 'Bài thử 😋\n📍Shop online Da Nang', topic: 'squishy'
  });
});

test('review remains inactive until selected; apply imports local media and is idempotent', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'threads-import-test-'));
  try {
    const review = makeReview([{ text: 'nuis07.studio\nsquishy\n2d\nBài mới 😋  Translate\n3', mediaUrls: ['https://instagram.example.fbcdn.net/a.jpg'] }], 'nuis07.studio', 'source.json');
    assert.equal(review.items[0].include, false);
    await assert.rejects(() => applyReview(review, root), /Chưa chọn bài nào/);
    review.items[0].include = true;
    review.items[0].productId = 'product-a';
    review.items[0].productName = 'Sản phẩm A';
    const downloader = async () => ({ bytes: png, extension: '.png' as const });
    const first = await applyReview(review, root, downloader);
    assert.equal(first.imported, 1);
    const productPath = path.join(root, 'data', 'products', 'product-a.json');
    const product = JSON.parse(fs.readFileSync(productPath, 'utf8'));
    assert.equal(product.contents[0].id, 'v1');
    assert.equal(product.contents[0].text, 'Bài mới 😋');
    assert.equal(product.contents[0].topic, 'squishy');
    assert.deepEqual(product.contents[0].importedFrom, { account: 'nuis07.studio', postIndex: 0 });
    assert.equal(fs.readFileSync(path.join(root, product.contents[0].images[0])).equals(png), true);
    const second = await applyReview(review, root, downloader);
    assert.deepEqual({ imported: second.imported, skipped: second.skipped }, { imported: 0, skipped: 1 });
    assert.equal(JSON.parse(fs.readFileSync(productPath, 'utf8')).contents.length, 1);
    const replacement = makeReview([{ text: 'nuis07.studio\nsquishy\n2d\nNội dung thay thế', mediaUrls: [] }], 'nuis07.studio', 'second.json');
    replacement.items[0].index = 1;
    replacement.items[0].include = true;
    replacement.items[0].productId = 'product-a';
    replacement.items[0].action = 'replace';
    replacement.items[0].contentId = 'v1';
    await applyReview(replacement, root, downloader);
    const replaced = JSON.parse(fs.readFileSync(productPath, 'utf8'));
    assert.equal(replaced.contents.length, 1);
    assert.equal(replaced.contents[0].id, 'v1');
    assert.equal(replaced.contents[0].text, 'Nội dung thay thế');
  } finally {
    const tempRoot = path.resolve(os.tmpdir());
    const resolved = path.resolve(root);
    if (!resolved.startsWith(tempRoot + path.sep) || !path.basename(resolved).startsWith('threads-import-test-')) throw new Error('Unsafe test cleanup path');
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});

test('rejects emoji that would display as a square', async () => {
  const review = makeReview([{ text: 'nuis07.studio\n2d\nMệt 🫩', mediaUrls: [] }], 'nuis07.studio', 'source.json');
  review.items[0].include = true;
  review.items[0].productId = 'tired';
  review.items[0].productName = 'Tired';
  await assert.rejects(() => applyReview(review, os.tmpdir()), /U\+1FAE9/);
});
