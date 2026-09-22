import { PostRepository } from './posts/post.repository';
import { ThreadsService } from './threads/threads.service';
import { Logger } from './utils/logger';

async function main() {
  Logger.info('Starting auto post flow...');
  
  const pendingPost = PostRepository.getNextPendingPost();
  
  if (!pendingPost) {
    Logger.info('No pending posts found. Exiting.');
    return;
  }
  
  Logger.info(`Selected post: ${pendingPost.id}`);
  
  const service = new ThreadsService();
  await service.postThread(pendingPost);
  
  Logger.info('Finished auto post flow.');
}

main().catch(error => {
  Logger.error('Fatal error in auto post script', error);
  process.exit(1);
});
