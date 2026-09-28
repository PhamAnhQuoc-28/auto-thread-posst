import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright';
import { ThreadsPage } from '../src/threads/threads.page';

const onePixelPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==', 'base64');

test('attaches multiple images and waits for composer previews', async () => {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'threads-media-test-'));
  const imagePaths = ['first.png', 'second.png'].map(name => path.join(fixtureDir, name));
  for (const imagePath of imagePaths) fs.writeFileSync(imagePath, onePixelPng);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <div role="dialog">
        <div contenteditable="true" role="textbox"></div>
        <input type="file" accept="image/*" multiple>
        <div id="previews"></div>
      </div>
      <script>
        document.querySelector('input').addEventListener('change', event => {
          for (const file of event.target.files) {
            const image = document.createElement('img');
            image.src = URL.createObjectURL(file);
            document.querySelector('#previews').append(image);
          }
        });
      </script>
    `);
    await new ThreadsPage(page).attachImages(imagePaths);
    assert.equal(await page.locator('#previews img').count(), 2);
  } finally {
    await browser.close();
    const tempRoot = path.resolve(os.tmpdir());
    const resolvedFixture = path.resolve(fixtureDir);
    if (!resolvedFixture.startsWith(tempRoot + path.sep)) throw new Error('Unsafe test cleanup path');
    fs.rmSync(resolvedFixture, { recursive: true, force: true });
  }
});

test('refuses multiple images when the composer allows only one', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<div role="dialog"><div contenteditable="true"></div><input type="file" accept="image/*"></div>');
    await assert.rejects(() => new ThreadsPage(page).attachImages(['first.png', 'second.png']), /does not support multiple images/);
  } finally {
    await browser.close();
  }
});

test('opens the current New thread navigation control', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <div role="button" tabindex="0" id="new-thread">New thread</div>
      <script>
        document.querySelector('#new-thread').addEventListener('click', () => {
          const editor = document.createElement('div');
          editor.setAttribute('contenteditable', 'true');
          document.body.append(editor);
        });
      </script>
    `);
    const threadsPage = new ThreadsPage(page);
    assert.equal(await threadsPage.isLoggedIn(), true);
    await threadsPage.openComposer();
    assert.equal(await page.locator('div[contenteditable="true"]').count(), 1);
  } finally {
    await browser.close();
  }
});

test('selects an exact community or topic suggestion', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <input placeholder="Community or topic">
      <script>
        const input = document.querySelector('input');
        input.addEventListener('input', () => {
          const list = document.createElement('ul');
          list.setAttribute('role', 'listbox');
          for (const name of ['squishy', 'squishytoy']) {
            const option = document.createElement('li');
            option.setAttribute('role', 'option');
            option.textContent = name;
            option.addEventListener('click', () => {
              input.value = name;
              input.dataset.selected = name;
              list.remove();
            });
            list.append(option);
          }
          document.body.append(list);
        });
      </script>
    `);
    await new ThreadsPage(page).attachTopic('squishy');
    assert.equal(await page.locator('input').getAttribute('data-selected'), 'squishy');
  } finally {
    await browser.close();
  }
});

test('waits for Threads to show Posted after clicking the button', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`
      <button id="post">Post</button>
      <script>
        document.querySelector('#post').addEventListener('click', () => {
          setTimeout(() => {
            const toast = document.createElement('div');
            toast.textContent = 'Posted';
            document.body.append(toast);
          }, 300);
        });
      </script>
    `);
    const started = Date.now();
    assert.equal(await new ThreadsPage(page).publish(), true);
    assert.ok(Date.now() - started >= 250);
  } finally {
    await browser.close();
  }
});
