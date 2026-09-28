import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('https://www.threads.net/@nuis07.studio', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  
  // Find all pressable containers
  const items = await page.locator('div[data-pressable-container="true"]').all();
  console.log(`Found ${items.length} items`);
  
  for (let i = 0; i < Math.min(4, items.length); i++) {
    const html = await items[i].evaluate(el => el.outerHTML);
    const parentHTML = await items[i].evaluate(el => el.parentElement?.parentElement?.outerHTML.substring(0, 500));
    console.log(`--- Item ${i} ---`);
    console.log(`Text: ${await items[i].innerText()}`);
    console.log(`Parent snippet: ${parentHTML}`);
  }
  
  await browser.close();
}
run();
