import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('https://www.threads.net/@nuis07.studio', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  
  const result = await page.evaluate(() => {
    // Attempt to find the feed container
    const feed = document.querySelector('div[role="feed"]') || document.querySelector('main');
    if (!feed) return 'No feed found';
    
    // Find the actual list. It's usually the one containing many children that eventually have pressable-containers
    let listContainer = feed;
    // We can traverse down to find the div that has many children
    // Usually, the direct children of the list container are the thread groups
    
    // An alternative way: find all pressable containers, and trace up to find the common ancestor that is a list
    const pressables = Array.from(document.querySelectorAll('div[data-pressable-container="true"]'));
    if (pressables.length === 0) return 'No pressables';
    
    let p0 = pressables[0];
    let p1 = pressables[1]; // The comment
    
    // Find lowest common ancestor of p0 and p1
    let lca = p0.parentElement;
    while (lca && !lca.contains(p1)) {
      lca = lca.parentElement;
    }
    
    let p2 = pressables[2]; // The next main post
    let lca2 = p0.parentElement;
    while (lca2 && !lca2.contains(p2)) {
      lca2 = lca2.parentElement;
    }
    
    return {
      lca_0_and_1: lca?.tagName + ' ' + lca?.className,
      lca_0_and_2: lca2?.tagName + ' ' + lca2?.className,
      lca_is_same: lca === lca2
    };
  });
  
  console.log(result);
  
  await browser.close();
}
run();
