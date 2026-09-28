import { PostRepository, resolveExistingPostImages } from './posts/post.repository';

const posts = PostRepository.readAll();
for (const post of posts) {
  resolveExistingPostImages(post.images ?? []);
}
console.log(`Valid posts.json: ${posts.length} posts; all referenced images exist.`);
