import { firefox } from 'playwright';
import path from 'path';

(async () => {
  const userDataDir = path.resolve(process.cwd(), 'browser-data-ff');
  const context = await firefox.launchPersistentContext(userDataDir, {
    headless: false,
    ignoreHTTPSErrors: true
  });
  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  
  page.on('response', response => {
    console.log(`<< ${response.status()} ${response.url()}`);
  });
  
  try {
    const response = await page.goto('https://www.threads.com/');
    console.log('Status:', response?.status());
  } catch (error) {
    console.error('Navigation error:', error);
  }
  
  await context.close();
})();
