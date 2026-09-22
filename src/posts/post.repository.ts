import fs from 'fs';
import path from 'path';
import { Post, PostStatus } from './post.types';
import { Logger } from '../utils/logger';

export class PostRepository {
  private static dataPath = path.resolve(process.cwd(), 'data', 'posts.json');

  static readAll(): Post[] {
    try {
      if (!fs.existsSync(this.dataPath)) {
        fs.mkdirSync(path.dirname(this.dataPath), { recursive: true });
        fs.writeFileSync(this.dataPath, '[]');
        return [];
      }
      const rawData = fs.readFileSync(this.dataPath, 'utf-8');
      return JSON.parse(rawData) as Post[];
    } catch (error) {
      Logger.error('Failed to read posts.json', error);
      return [];
    }
  }

  static saveAll(posts: Post[]): void {
    try {
      fs.writeFileSync(this.dataPath, JSON.stringify(posts, null, 2));
    } catch (error) {
      Logger.error('Failed to write to posts.json', error);
    }
  }

  static getNextPendingPost(): Post | null {
    const posts = this.readAll();
    const pendingPost = posts.find(p => p.status === 'pending');
    return pendingPost || null;
  }

  static updateStatus(id: string, status: PostStatus, errorMsg: string | null = null): void {
    const posts = this.readAll();
    const postIndex = posts.findIndex(p => p.id === id);
    
    if (postIndex !== -1) {
      posts[postIndex].status = status;
      if (status === 'published') {
        posts[postIndex].publishedAt = new Date().toISOString();
        posts[postIndex].error = null;
      }
      if (errorMsg !== null) {
        posts[postIndex].error = errorMsg;
      }
      this.saveAll(posts);
      Logger.info(`Updated post ${id} status to ${status}`);
    }
  }
}
