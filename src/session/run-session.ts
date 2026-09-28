import { Post, SessionSlot } from '../posts/post.types';
import { PostRepository } from '../posts/post.repository';
import { withPostingLock } from '../posts/post.lock';
import { ThreadsService } from '../threads/threads.service';
import { Logger } from '../utils/logger';
import { dateInTimeZone, loadProducts, loadSessionConfig, nextDueTime, nextSessionPost, planSession, postsForSession, sessionId } from './session.plan';

function parseSlot(value: string | undefined): SessionSlot {
  if (value === 'morning' || value === 'afternoon') return value;
  throw new Error('Choose a session: npm run session -- morning|afternoon');
}

function currentPosts(date: string, slot: SessionSlot): Post[] {
  return postsForSession(PostRepository.readAll(), date, slot);
}

async function prepareSession(date: string, slot: SessionSlot, intervalMinutes: number): Promise<Post[]> {
  return withPostingLock(async () => {
    const history = PostRepository.readAll();
    const existing = postsForSession(history, date, slot);
    if (existing.length) return existing;

    const otherSlot: SessionSlot = slot === 'morning' ? 'afternoon' : 'morning';
    const otherPosts = postsForSession(history, date, otherSlot);
    if (otherPosts.some(post => post.status === 'pending' || post.status === 'publishing' || post.status === 'draft')) {
      throw new Error(`Finish the ${otherSlot} session for ${date} before starting ${slot}`);
    }

    const planned = planSession(history, otherPosts.length ? [] : loadProducts(), date, slot, new Date(), intervalMinutes);
    for (const post of planned) {
      if (history.some(item => item.id === post.id)) throw new Error(`Post id already exists: ${post.id}`);
    }
    PostRepository.saveAll([...history, ...planned]);
    return planned;
  });
}

async function waitUntil(due: number): Promise<void> {
  while (Date.now() < due) {
    await new Promise(resolve => setTimeout(resolve, Math.min(due - Date.now(), 30_000)));
  }
}

async function main(): Promise<void> {
  const slot = parseSlot(process.argv[2]);
  const config = loadSessionConfig();
  const date = dateInTimeZone(new Date(), config.timeZone);
  const id = sessionId(date, slot);
  const planned = await prepareSession(date, slot, config.intervalMinutes);
  Logger.info(`${id}: ${planned.length} products; ${config.intervalMinutes} minutes between submissions`);

  while (true) {
    const posts = currentPosts(date, slot);
    const next = nextSessionPost(posts);
    if (!next) {
      const failed = posts.filter(post => post.status === 'failed').length;
      Logger.info(`${id} complete: ${posts.length - failed} without reported error; ${failed} failed and skipped`);
      return;
    }
    const due = nextDueTime(posts, next, config.intervalMinutes);
    if (Date.now() < due) Logger.info(`Waiting until ${new Date(due).toLocaleString('vi-VN', { timeZone: config.timeZone })} for ${next.id}`);
    await waitUntil(due);

    const result = await withPostingLock(async () => {
      const fresh = currentPosts(date, slot).find(post => post.id === next.id);
      if (!fresh || fresh.status !== 'pending') return fresh;
      const service = new ThreadsService();
      await service.postThread(fresh);
      return currentPosts(date, slot).find(post => post.id === next.id);
    });
    if (result?.status === 'failed') {
      Logger.error(`${id}: skipping failed post ${result.id}; continuing to the next product`);
      continue;
    }
    if (!result || (result.status !== 'needs_review' && result.status !== 'published')) {
      throw new Error(`${id} stopped at ${next.id} (${result?.status ?? 'missing'}). Check data/posts.json before resuming.`);
    }
  }
}

main().catch(error => {
  Logger.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
