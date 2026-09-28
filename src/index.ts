import { PostRepository } from './posts/post.repository';
import { withPostingLock } from './posts/post.lock';
import { ThreadsService } from './threads/threads.service';
import { Logger } from './utils/logger';

async function main() {
  Logger.info('Starting auto post flow...');
  await withPostingLock(async () => {
    const pendingPost = PostRepository.getNextPendingPost();
    if (!pendingPost) {
      Logger.info('No pending posts are due. Exiting.');
      return;
    }
    Logger.info(`Selected post: ${pendingPost.id}`);
    await new ThreadsService().postThread(pendingPost);
  });
  
  Logger.info('Finished auto post flow.');
}

main().catch(error => {
  Logger.error('Fatal error in auto post script', error);
  process.exit(1);
});
