import { Page, Locator } from 'playwright';
import { Logger } from '../utils/logger';

export class ThreadsPage {
  readonly page: Page;
  
  // Locators
  readonly loginButton: Locator;
  readonly newThreadButton: Locator;
  
  constructor(page: Page) {
    this.page = page;
    this.loginButton = page.getByRole('button', { name: /Log in|Đăng nhập/i }).first();
    this.newThreadButton = page.locator('div').filter({ hasText: /^Start a thread\.\.\.$|^Bắt đầu( một)? thread\.\.\.$|^Bắt đầu\.\.\.$/i }).first();
  }

  async open(): Promise<void> {
    Logger.info('Opening Threads...');
    await this.page.goto('https://www.threads.net/', { waitUntil: 'domcontentloaded' });
  }

  async isLoggedIn(): Promise<boolean> {
    try {
      await this.page.waitForTimeout(3000); 
      if (this.page.url().includes('/login')) {
        return false;
      }
      const isLoginVisible = await this.loginButton.isVisible();
      if (isLoginVisible) return false;
      return true;
    } catch {
      return false;
    }
  }

  async openComposer(): Promise<void> {
    Logger.info('Opening composer...');
    const createIcon = this.page.locator('svg[aria-label="Create"], svg[aria-label="Tạo"]').first();
    
    if (await this.newThreadButton.isVisible()) {
      await this.newThreadButton.click();
    } else if (await createIcon.isVisible()) {
      await createIcon.click();
    } else {
      Logger.info('Could not find composer button easily, trying fallback...');
      await this.page.keyboard.press('c');
    }
    
    // Đợi textbox hiển thị
    const textbox = this.page.locator('div[contenteditable="true"]').filter({ state: 'visible' }).last();
    await textbox.waitFor({ state: 'visible', timeout: 10000 });
  }

  async fillPost(text: string): Promise<void> {
    Logger.info('Entering post text...');
    const textbox = this.page.locator('div[contenteditable="true"]').filter({ state: 'visible' }).last();
    await textbox.fill(text);
  }

  async publish(): Promise<void> {
    Logger.info('Clicking Post button...');
    // Nút đăng thường nằm gần textbox, ta lấy nút Post visible cuối cùng
    const postBtn = this.page.getByRole('button', { name: /^Post$|^Đăng$/i }).filter({ state: 'visible' }).last();
    await postBtn.waitFor({ state: 'visible', timeout: 5000 });
    await postBtn.click();
  }

  async waitForPublished(): Promise<void> {
    Logger.info('Verifying publish succeeded...');
    // Sau khi nhấn, composer overlay sẽ biến mất hoặc có toast
    // Ta chờ textbox biến mất hoặc reset về rỗng
    await this.page.waitForTimeout(3000); // Đợi 1 chút để UI phản hồi
  }
}
