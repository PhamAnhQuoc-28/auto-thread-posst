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
    const parent3 = await items[i].evaluate(el => el.parentElement?.parentElement?.parentElement?.className);
    const parent4 = await items[i].evaluate(el => el.parentElement?.parentElement?.parentElement?.parentElement?.className);
    const parent5 = await items[i].evaluate(el => el.parentElement?.parentElement?.parentElement?.parentElement?.parentElement?.className);
    const parent6 = await items[i].evaluate(el => el.parentElement?.parentElement?.parentElement?.parentElement?.parentElement?.parentElement?.className);
    
    console.log(`--- Item ${i} ---`);
    console.log(`Text: ${await items[i].innerText()}`);
    console.log(`Level 3: ${parent3}`);
    console.log(`Level 4: ${parent4}`);
    console.log(`Level 5: ${parent5}`);
    console.log(`Level 6: ${parent6}`);
  }
  
  await browser.close();
}
run();
