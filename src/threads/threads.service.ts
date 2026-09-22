import { chromium, BrowserContext, Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import { ThreadsPage } from './threads.page';
import { Logger } from '../utils/logger';
import { Post } from '../posts/post.types';
import { PostRepository } from '../posts/post.repository';

export class ThreadsService {
  private userDataDir = path.resolve(process.cwd(), 'browser-data');
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  async initPersistentBrowser(headless: boolean = false): Promise<void> {
    Logger.info(`Launching browser (headless: ${headless})...`);
    this.context = await chromium.launchPersistentContext(this.userDataDir, {
      headless: headless,
      viewport: { width: 1280, height: 720 },
    });
    const pages = this.context.pages();
    this.page = pages.length > 0 ? pages[0] : await this.context.newPage();
  }

  async closeBrowser(): Promise<void> {
    if (this.context) {
      Logger.info('Closing browser...');
      await this.context.close();
    }
  }

  async loginManually(): Promise<void> {
    await this.initPersistentBrowser(false);
    if (!this.page) return;
    
    const threadsPage = new ThreadsPage(this.page);
    await threadsPage.open();
    
    Logger.info('Please log in manually in the opened browser window.');
    Logger.info('Close the browser manually when you are done.');
    
    // Đợi cho đến khi context bị đóng (người dùng tự tắt)
    await new Promise<void>(resolve => {
      this.context?.on('close', () => {
        Logger.info('Browser closed by user.');
        resolve();
      });
    });
  }

  async postThread(post: Post): Promise<void> {
    await this.initPersistentBrowser(false);
    if (!this.page) throw new Error('Page not initialized');

    const threadsPage = new ThreadsPage(this.page);

    try {
      // 1. Update status to publishing
      PostRepository.updateStatus(post.id, 'publishing');

      // 2. Open Threads
      await threadsPage.open();

      // 3. Check login
      Logger.info('Checking login session...');
      const loggedIn = await threadsPage.isLoggedIn();
      if (!loggedIn) {
        Logger.error('Threads session expired. Please run login.bat and login again.');
        await this.takeErrorScreenshot();
        // Revert status to pending
        PostRepository.updateStatus(post.id, 'pending', 'Session expired');
        return;
      }

      // 4. Open composer
      await threadsPage.openComposer();

      // 5. Enter text
      await threadsPage.fillPost(post.text);

      // 6. Publish
      await threadsPage.publish();

      // 7. Verify publish
      await threadsPage.waitForPublished();
      
      Logger.info('Published successfully');
      PostRepository.updateStatus(post.id, 'published');

    } catch (error: any) {
      Logger.error(`Publishing failed: ${error.message}`);
      PostRepository.updateStatus(post.id, 'failed', error.message);
      
      // Lưu screenshot khi lỗi
      await this.takeErrorScreenshot();
    } finally {
      await this.closeBrowser();
    }
  }

  private async takeErrorScreenshot(): Promise<void> {
    if (this.page) {
      try {
        const logsDir = path.resolve(process.cwd(), 'logs');
        if (!fs.existsSync(logsDir)) {
          fs.mkdirSync(logsDir, { recursive: true });
        }
        
        const now = new Date();
        const YYYY = now.getFullYear();
        const MM = String(now.getMonth() + 1).padStart(2, '0');
        const DD = String(now.getDate()).padStart(2, '0');
        const HH = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        const timestamp = `${YYYY}-${MM}-${DD}-${HH}${mm}${ss}`;
        
        const ssPath = path.join(logsDir, `error-${timestamp}.png`);
        await this.page.screenshot({ path: ssPath });
        Logger.info(`Error screenshot saved at ${ssPath}`);
      } catch (err) {
        Logger.error('Could not take error screenshot', err);
      }
    }
  }
}
