import { Page, Locator } from 'playwright';
import { ExtractedPost } from '../types';

export class ThreadsProfilePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async navigate(username: string) {
    // Navigate to the user's profile
    // Clean username (remove @ if present)
    const cleanUsername = username.replace('@', '');
    await this.page.goto(`https://www.threads.net/@${cleanUsername}`, { waitUntil: 'domcontentloaded' });
    
    // Wait for the feed to load (we wait for a post container or at least some text)
    // Often Threads uses 'div' for posts. We can wait for any visible text that looks like a post.
    await this.page.waitForTimeout(3000); 
  }

  async extractPosts(limit: number): Promise<ExtractedPost[]> {
    // Because Threads uses heavily obfuscated CSS classes and doesn't provide 
    // easy semantic locators for post blocks, the most reliable way to extract 
    // bulk data is to evaluate a script inside the browser context that looks 
    // for typical post structures (e.g. text spans and image/video tags).
    
    // We scroll down a few times to ensure posts are loaded
    for (let i = 0; i < 3; i++) {
      await this.page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await this.page.waitForTimeout(1000);
    }

    const posts = await this.page.evaluate((maxCount) => {
      // Logic to find post containers. 
      // In Threads, posts usually have a user avatar, text, and optional media.
      // We will look for all text spans and images grouped by some container.
      // Since classes are obfuscated, we approximate by finding typical text blocks.
      
      const results: { text: string; mediaUrls: string[]; author: string }[] = [];
      
      // Select all potential post containers. On Threads, posts are often separated by dividers or are direct children of a main feed div.
      // A common pattern is finding elements that contain the username.
      // For now, we will scrape all images and long texts in the view.
      
      const textElements = document.querySelectorAll('span[dir="auto"]');
      let currentText = '';
      const processedTexts = new Set();
      
      // This is a simplified extraction. A real extraction might need more specific logic
      // based on the exact DOM structure which changes frequently.
      
      // Let's try to find main feed items by looking at the main feed container.
      // Usually, there is a list of blocks, each block is a thread. 
      // We want only the FIRST post in each thread group to avoid comments.
      const pressableContainers = Array.from(document.querySelectorAll('div[data-pressable-container="true"]'));
      
      // A simple heuristic: the main post usually has a different visual hierarchy or is the first one.
      // To group them, we look at their parent structure. Usually, a thread group wraps both the main post and its replies.
      // We can collect all containers, but only keep the first one sharing the same parent or grandparent.
      
      const seenGroups = new Set();
      const topLevelItems = pressableContainers.filter(container => {
        // In React Native Web (used by Threads), lists are rendered as a FlatList.
        // The FlatList container has many children (the rows). 
        // A single row represents a Thread Group (Main post + its replies).
        // We traverse up to find the element that is a direct child of a container with many children.
        
        let parent = container.parentElement;
        let groupContainer = container;
        
        // Traverse up until we find a parent with a significant number of children (e.g., > 3), 
        // which typically represents the main feed list.
        let steps = 0;
        while (parent && parent.tagName !== 'BODY' && steps < 10) {
          // If the parent has multiple children, it might be the feed list.
          // In Threads, the feed list typically has many children, one for each thread group.
          if (parent.children.length > 3) {
            break;
          }
          groupContainer = parent;
          parent = parent.parentElement;
          steps++;
        }
        
        if (seenGroups.has(groupContainer)) {
           return false; // Already saw the main post for this group
        } else {
           seenGroups.add(groupContainer);
           return true;
        }
      });
      
      if (topLevelItems.length > 0) {
        for (const item of topLevelItems) {
          if (results.length >= maxCount) break;
          
          const spans = item.querySelectorAll('span[dir="auto"]');
          let text = '';
          let textLines: string[] = [];
          for (const span of Array.from(spans)) {
            if (span.textContent) {
              textLines.push(span.textContent);
            }
          }
          text = textLines.join('\n').trim();
          
          const images = item.querySelectorAll('img');
          const mediaUrls: string[] = [];
          for (const img of Array.from(images)) {
            if (img.src && !img.src.includes('s150x150')) { // Filter out small avatars
              mediaUrls.push(img.src);
            }
          }
          
          const videos = item.querySelectorAll('video');
          for (const vid of Array.from(videos)) {
            if (vid.src) mediaUrls.push(vid.src);
          }
          
          if (text || mediaUrls.length > 0) {
            results.push({
              text,
              mediaUrls,
              author: '' 
            });
          }
        }
      } else {
        // Fallback: just grab all large images and texts
        // ... this can be improved with specific DOM analysis
      }

      return results;
    }, limit);

    return posts;
  }
}
