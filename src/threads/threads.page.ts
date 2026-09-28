import { Page, Locator, Response } from 'playwright';
import { Logger } from '../utils/logger';

export class ThreadsPage {
  readonly page: Page;
  
  // Locators
  readonly loginButton: Locator;
  readonly newThreadButton: Locator;
  readonly newThreadNavigation: Locator;
  
  constructor(page: Page) {
    this.page = page;
    this.loginButton = page.getByRole('button', { name: /Log in|Đăng nhập/i }).first();
    this.newThreadButton = page.locator('div').filter({ hasText: /^Start a thread\.\.\.$|^Bắt đầu( một)? thread\.\.\.$|^Bắt đầu\.\.\.$/i }).first();
    this.newThreadNavigation = page.getByRole('button', { name: /^New thread$|^Thread mới$|^Tạo thread$/i }).first();
  }

  async open(): Promise<void> {
    Logger.info('Opening Threads...');
    const url = 'https://www.threads.com/';
    let navigationStatus: number | undefined;
    const onResponse = (response: Response) => {
      if (response.request().isNavigationRequest() && response.url().startsWith(url)) {
        navigationStatus = response.status();
      }
    };

    this.page.on('response', onResponse);
    try {
      const response = await this.page.goto(url, { waitUntil: 'domcontentloaded' });
      navigationStatus = response?.status() ?? navigationStatus;
    } catch (error) {
      if (!navigationStatus || navigationStatus < 400) throw error;
    } finally {
      this.page.off('response', onResponse);
    }

    if (navigationStatus === 429) {
      throw new Error('Threads returned HTTP 429 (Too Many Requests). Check access to https://www.threads.com/ in a regular browser and try again after the limit clears.');
    }
    if (navigationStatus && navigationStatus >= 400) {
      throw new Error(`Threads returned HTTP ${navigationStatus} while opening ${url}`);
    }
  }

  async isLoggedIn(): Promise<boolean> {
    try {
      await this.page.waitForTimeout(3000); 
      if (this.page.url().includes('/login')) {
        return false;
      }
      const isLoginVisible = await this.loginButton.isVisible();
      if (isLoginVisible) return false;
      const createIcon = this.page.locator('svg[aria-label="Create"], svg[aria-label="Tạo"], svg[aria-label="New thread"]').first();
      return await this.newThreadNavigation.isVisible() || await this.newThreadButton.isVisible() || await createIcon.isVisible();
    } catch {
      return false;
    }
  }

  async openComposer(): Promise<void> {
    Logger.info('Opening composer...');
    const createIcon = this.page.locator('svg[aria-label="Create"], svg[aria-label="Tạo"], svg[aria-label="New thread"]').first();
    
    if (await this.newThreadNavigation.isVisible()) {
      await this.newThreadNavigation.click();
    } else if (await this.newThreadButton.isVisible()) {
      await this.newThreadButton.click();
    } else if (await createIcon.isVisible()) {
      await createIcon.click();
    } else {
      Logger.info('Could not find composer button easily, trying fallback...');
      await this.page.keyboard.press('c');
    }
    
    // Đợi textbox hiển thị
    const textbox = this.page.locator('div[contenteditable="true"]').filter({ visible: true }).last();
    await textbox.waitFor({ state: 'visible', timeout: 15000 });
  }

  async fillPost(text: string): Promise<void> {
    Logger.info('Entering post text...');
    const textbox = this.page.locator('div[contenteditable="true"]').filter({ visible: true }).last();
    await textbox.fill(text);
  }

  async attachTopic(topic: string): Promise<void> {
    Logger.info(`Selecting community or topic: ${topic}`);
    const input = this.page.getByPlaceholder(/Community or topic|Cộng đồng hoặc chủ đề/i).filter({ visible: true }).last();
    await input.waitFor({ state: 'visible', timeout: 10000 });
    await input.fill(topic);
    const option = this.page.getByRole('option', { name: topic, exact: true }).first();
    await option.waitFor({ state: 'visible', timeout: 10000 });
    await option.click();
    await option.waitFor({ state: 'hidden', timeout: 5000 });
    if (await input.inputValue() !== topic) throw new Error(`Threads did not keep the selected topic: ${topic}`);
  }

  private async composerScope(): Promise<Locator> {
    const dialogs = this.page.getByRole('dialog');
    for (let index = (await dialogs.count()) - 1; index >= 0; index--) {
      const dialog = dialogs.nth(index);
      if (await dialog.locator('div[contenteditable="true"]').filter({ visible: true }).count()) return dialog;
    }
    const textbox = this.page.locator('div[contenteditable="true"]').filter({ visible: true }).last();
    const ancestor = textbox.locator('xpath=ancestor::*[.//input[@type="file"]][1]');
    if (await ancestor.count()) return ancestor;
    return this.page.locator('body');
  }

  async attachImages(imageFiles: string[]): Promise<void> {
    if (!imageFiles.length) return;
    Logger.info(`Attaching ${imageFiles.length} image(s)...`);
    const scope = await this.composerScope();
    const previews = scope.locator('img');
    const beforeCount = await previews.count();
    const beforeSources = new Set(await previews.evaluateAll(images => images.map(image => image.getAttribute('src') || '')));

    const preferredInputs = scope.locator('input[type="file"][accept*="image"], input[type="file"][accept*=".jpg"], input[type="file"][accept*=".jpeg"], input[type="file"][accept*=".png"], input[type="file"][accept*=".webp"]');
    const inputs = await preferredInputs.count() ? preferredInputs : scope.locator('input[type="file"]');
    if (await inputs.count()) {
      const input = inputs.last();
      if (imageFiles.length > 1 && await input.getAttribute('multiple') === null) {
        throw new Error('The Threads composer file input does not support multiple images.');
      }
      await input.setInputFiles(imageFiles);
    } else {
      const attachButton = scope.getByRole('button', { name: /attach|add (photo|image|media)|đính kèm|thêm (ảnh|hình)/i }).last();
      if (!await attachButton.count()) throw new Error('Could not find the Threads image attachment control.');
      const chooserPromise = this.page.waitForEvent('filechooser', { timeout: 10000 });
      await attachButton.click();
      const chooser = await chooserPromise;
      if (imageFiles.length > 1 && !chooser.isMultiple()) {
        throw new Error('The Threads file chooser does not support multiple images.');
      }
      await chooser.setFiles(imageFiles);
    }

    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const sources = await previews.evaluateAll(images => images.map(image => image.getAttribute('src') || ''));
      const newSources = sources.filter(source => source && !beforeSources.has(source));
      if (sources.length >= beforeCount + imageFiles.length || newSources.length >= imageFiles.length) {
        Logger.info(`Image preview ready (${imageFiles.length} image(s)).`);
        return;
      }
      await this.page.waitForTimeout(250);
    }
    throw new Error(`Image preview did not appear for all ${imageFiles.length} file(s); post was not submitted.`);
  }

  async publish(): Promise<boolean> {
    Logger.info('Clicking Post button...');
    // Nút đăng thường nằm gần textbox, ta lấy nút Post visible cuối cùng
    const postBtn = this.page.getByRole('button', { name: /^Post$|^Đăng$/i }).filter({ visible: true }).last();
    await postBtn.waitFor({ state: 'visible', timeout: 5000 });
    await postBtn.click();
    try {
      await this.page.getByText(/^Posted$|^Đã đăng$/i).filter({ visible: true }).first()
        .waitFor({ state: 'visible', timeout: 20000 });
      Logger.info('Threads displayed the Posted confirmation.');
      return true;
    } catch {
      Logger.error('Threads did not display a Posted confirmation after the click. Check the post manually.');
      return false;
    }
  }

}
