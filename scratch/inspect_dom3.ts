import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('https://www.threads.net/@nuis07.studio', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  
  const items = await page.locator('div[data-pressable-container="true"]').all();
  
  for (let i = 0; i < 4; i++) {
    // Let's check for specific icons or structure
    // e.g. avatars, Thread lines
    const text = await items[i].innerText();
    const svgs = await items[i].evaluate(el => {
      return Array.from(el.querySelectorAll('svg')).map(s => s.getAttribute('aria-label')).filter(Boolean);
    });
    
    // Check if there is an <hr> right after or before
    const html = await items[i].evaluate(el => el.outerHTML);
    console.log(`--- Item ${i} ---`);
    console.log(text.split('\n')[3]); // Just snippet
    console.log(`SVGs:`, svgs);
  }
  
  await browser.close();
}
run();
