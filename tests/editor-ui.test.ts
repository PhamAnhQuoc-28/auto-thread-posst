import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright';
import { createEditorServer } from '../src/editor/server';
import { planSession } from '../src/session/session.plan';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==', 'base64');

test('local editor saves a product, image and topic, then previews the run', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'threads-editor-ui-test-'));
  fs.mkdirSync(path.join(root, 'ui'), { recursive: true });
  fs.cpSync(path.resolve('ui', 'dist'), path.join(root, 'ui', 'dist'), { recursive: true });
  const app = createEditorServer(root);
  const browser = await chromium.launch({ headless: true });
  try {
    const address = await app.listen({ host: '127.0.0.1', port: 0 });
    const page = await browser.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.goto(address);
    await page.getByRole('heading', { name: 'Chuẩn bị bài đăng' }).waitFor();
    await page.getByRole('button', { name: '+ Thêm sản phẩm' }).first().click();
    await page.getByPlaceholder('Ví dụ: Squishy hình gấu').fill('Squishy gấu');
    const expectedText = 'Dòng 1 ✨\n\nLink: https://example.com\nDòng cuối😀';
    await page.locator('.editor-surface [contenteditable="true"]').fill('Dòng 1 ✨\n\nLink: https://example.com\nDòng cuối');
    await page.locator('.editor-surface [contenteditable="true"]').press('End');
    await page.getByRole('button', { name: 'Chọn emoji' }).click();
    await page.getByRole('dialog', { name: 'Bảng chọn emoji' }).waitFor();
    const pickerWidth = (await page.getByRole('dialog', { name: 'Bảng chọn emoji' }).boundingBox())?.width ?? 0;
    assert.ok(pickerWidth >= 450, `Emoji picker is too narrow: ${pickerWidth}px`);
    await page.getByPlaceholder('Tìm emoji: cười, tim, hoa...').fill('mặt có túi mắt');
    await page.waitForTimeout(250);
    assert.equal(await page.locator('.emoji-picker-popover button[data-unified="1fae9"]').count(), 0);
    await page.getByPlaceholder('Tìm emoji: cười, tim, hoa...').fill('cười toe toét');
    await page.waitForFunction(() => document.querySelectorAll('.emoji-picker-popover button[data-unified]').length === 1);
    await page.locator('.emoji-picker-popover button[data-unified="1f600"]').click();
    assert.equal(await page.locator('.editor-preview p').textContent(), expectedText);
    await page.getByRole('button', { name: 'English' }).click();
    await page.getByPlaceholder('Search emoji...').fill('grinning face');
    await page.locator('.emoji-picker-popover button[data-unified="1f600"]').first().waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog', { name: 'Bảng chọn emoji' }).waitFor({ state: 'hidden' });
    await page.locator('.editor-surface [contenteditable="true"]').fill('Emoji lỗi 🫩');
    await page.getByRole('alert').getByText('U+1FAE9', { exact: false }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Lưu dữ liệu' }).isDisabled(), true);
    await page.locator('.editor-surface [contenteditable="true"]').fill(expectedText);
    assert.equal(await page.getByRole('button', { name: 'Lưu dữ liệu' }).isEnabled(), true);
    await page.getByPlaceholder('squishy', { exact: true }).fill('squishy');
    await page.locator('input[type="file"]').setInputFiles({ name: 'tiny.png', mimeType: 'image/png', buffer: png });
    await page.getByText('Media đã được tải lên máy.').waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Lưu dữ liệu' }).click();
    await page.getByText('Đã lưu. Dữ liệu sẵn sàng cho post.bat.').waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Xem lượt sáng' }).click();
    await page.getByText(expectedText).last().waitFor({ state: 'visible' });

    const product = JSON.parse(fs.readFileSync(path.join(root, 'data', 'products', 'product-1.json'), 'utf-8'));
    assert.equal(product.name, 'Squishy gấu');
    assert.equal(product.order, 0);
    assert.equal(product.contents[0].text, expectedText);
    assert.equal(product.contents[0].topic, 'squishy');
    assert.equal(product.contents[0].images.length, 1);
    assert.equal(fs.existsSync(path.join(root, product.contents[0].images[0])), true);
    const planned = planSession([], [product], '2026-09-28', 'morning', new Date('2026-09-28T01:00:00.000Z'), 10, root);
    assert.equal(planned[0].text, expectedText);
    assert.equal(planned[0].topic, 'squishy');
    assert.deepEqual(planned[0].images, product.contents[0].images);
    await page.getByRole('button', { name: 'Tải lại' }).click();
    await page.getByText('Đã tải dữ liệu mới nhất.').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.editor-preview p').textContent(), expectedText);

    const endingNewline = 'Mở đầu\n\nKết thúc\n';
    await page.locator('.editor-surface [contenteditable="true"]').fill(endingNewline);
    await page.getByRole('button', { name: 'Lưu dữ liệu' }).click();
    await page.getByText('Đã lưu. Dữ liệu sẵn sàng cho post.bat.').waitFor({ state: 'visible' });
    const updated = JSON.parse(fs.readFileSync(path.join(root, 'data', 'products', 'product-1.json'), 'utf-8'));
    assert.equal(updated.contents[0].text, endingNewline);
    await page.getByRole('button', { name: 'Tải lại' }).click();
    await page.getByText('Đã tải dữ liệu mới nhất.').waitFor({ state: 'visible' });
    assert.equal(await page.locator('.editor-preview p').textContent(), endingNewline);
    assert.deepEqual(pageErrors, []);
  } finally {
    await browser.close();
    await app.close();
    const tempRoot = path.resolve(os.tmpdir());
    const resolved = path.resolve(root);
    if (!resolved.startsWith(tempRoot + path.sep) || !path.basename(resolved).startsWith('threads-editor-ui-test-')) {
      throw new Error('Unsafe test cleanup path');
    }
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});
