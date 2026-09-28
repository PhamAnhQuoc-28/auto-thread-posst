import { chromium, BrowserContext, Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import { ThreadsPage } from './threads.page';
import { Logger } from '../utils/logger';
import { Post } from '../posts/post.types';
import { PostRepository, resolveExistingPostImages } from '../posts/post.repository';
import { describeUnsupportedEmoji } from '../emoji/compatibility';

export class ThreadsService {
  private userDataDir = path.resolve(process.cwd(), 'browser-data');
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  async initPersistentBrowser(headless: boolean = false): Promise<void> {
    Logger.info(`Launching browser (headless: ${headless})...`);
    this.context = await chromium.launchPersistentContext(this.userDataDir, {
      headless: headless,
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      args: ['--disable-blink-features=AutomationControlled', '--disable-infobars'],
      ignoreDefaultArgs: ['--enable-automation'],
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
    try {
      await threadsPage.open();
    } catch (error) {
      await this.closeBrowser();
      throw error;
    }
    
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
    PostRepository.updateStatus(post.id, 'publishing');
    try {
      const emojiIssue = describeUnsupportedEmoji(post.text);
      if (emojiIssue) throw new Error(emojiIssue);
      const imageFiles = resolveExistingPostImages(post.images ?? []);
      await this.initPersistentBrowser(false);
      if (!this.page) throw new Error('Page not initialized');
      const threadsPage = new ThreadsPage(this.page);

      // Open Threads
      await threadsPage.open();

      // 3. Check login
      Logger.info('Checking login session...');
      const loggedIn = await threadsPage.isLoggedIn();
      if (!loggedIn) {
        Logger.error('Threads session expired. Please run login.bat and login again.');
        await this.takeErrorScreenshot();
        PostRepository.updateStatus(post.id, 'failed', 'Session expired');
        return;
      }

      // 4. Open composer
      await threadsPage.openComposer();

      // 5. Enter text
      if (post.text.trim()) await threadsPage.fillPost(post.text);

      // Attach local image files and confirm that previews appear before posting.
      if (imageFiles.length) await threadsPage.attachImages(imageFiles);

      if (post.topic) await threadsPage.attachTopic(post.topic);

      // 6. Publish
      const confirmedByUi = await threadsPage.publish();

      // A transient toast does not prove that the post remains visible on the profile.
      // Keep the result for manual review.
      Logger.info(confirmedByUi ? 'Post button clicked and Threads showed Posted; publication needs manual review.' : 'Post button clicked; publication needs manual review.');
      PostRepository.updateStatus(post.id, 'needs_review');
      if (!confirmedByUi) await this.takeErrorScreenshot();

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
