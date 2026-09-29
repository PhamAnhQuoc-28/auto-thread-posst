import { PostRepository, resolveExistingPostImages } from './posts/post.repository';
import { loadProducts } from './session/session.plan';

const products = loadProducts();
for (const product of products) for (const content of product.contents) {
  resolveExistingPostImages(content.images);
}
const posts = PostRepository.readAll();
let historicalMissingMedia = 0;
for (const post of posts) {
  if (['draft', 'pending', 'publishing'].includes(post.status)) {
    resolveExistingPostImages(post.images ?? []);
  } else {
    for (const image of post.images ?? []) {
      try { resolveExistingPostImages([image]); }
      catch { historicalMissingMedia++; }
    }
  }
}
console.log(`Valid active catalog: ${products.length} products; all current images exist.`);
console.log(`Valid pending posts: ${posts.filter(post => ['draft', 'pending', 'publishing'].includes(post.status)).length}.`);
if (historicalMissingMedia) console.warn(`${historicalMissingMedia} historical media reference(s) are missing; they are not used by future posts.`);
