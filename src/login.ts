import { ThreadsService } from './threads/threads.service';
import { Logger } from './utils/logger';

async function main() {
  Logger.info('Starting manual login flow...');
  const service = new ThreadsService();
  await service.loginManually();
}

main().catch(error => {
  Logger.error('Fatal error in login script', error);
  process.exit(1);
});
