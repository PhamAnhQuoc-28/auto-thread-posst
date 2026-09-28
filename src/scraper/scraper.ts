import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { ThreadsProfilePage } from './pages/ThreadsProfilePage';

async function runScraper() {
  const username = process.argv[2];
  const limitArg = process.argv[3];
  const limit = limitArg ? parseInt(limitArg, 10) : 10;

  if (!username) {
    console.error('Usage: npm run scrape <username> [limit]');
    process.exit(1);
  }

  console.log(`Starting scraper for profile: ${username}, max posts: ${limit}`);
  
  // Launch browser. We can use a persistent context if we want to reuse login,
  // but public profiles can often be viewed without login. 
  // Let's use a standard browser launch.
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  const profilePage = new ThreadsProfilePage(page);

  try {
    console.log(`Navigating to ${username}'s profile...`);
    await profilePage.navigate(username);

    console.log('Extracting posts...');
    const posts = await profilePage.extractPosts(limit);

    console.log(`Successfully extracted ${posts.length} posts.`);
    
    // Save to data folder
    const dataDir = path.resolve(process.cwd(), 'data', 'scraped');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const outputPath = path.join(dataDir, `${username.replace('@', '')}_posts.json`);
    fs.writeFileSync(outputPath, JSON.stringify(posts, null, 2), 'utf-8');
    console.log(`Data saved to ${outputPath}`);
    
  } catch (error) {
    console.error('An error occurred during scraping:', error);
  } finally {
    await browser.close();
  }
}

runScraper();
