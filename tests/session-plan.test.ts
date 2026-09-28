import assert from 'node:assert/strict';
import test from 'node:test';
import { Product, nextDueTime, nextSessionPost, planSession } from '../src/session/session.plan';
import { Post } from '../src/posts/post.types';

const products: Product[] = [
  { id: 'a', name: 'A', contents: [
    { id: 'a1', text: 'A1', images: [], topic: 'squishy' },
    { id: 'a2', text: 'A2', images: [] }
  ] },
  { id: 'b', name: 'B', contents: [
    { id: 'b1', text: 'B1', images: [] },
    { id: 'b2', text: 'B2', images: [] }
  ] }
];
const start = new Date('2026-09-23T01:00:00.000Z');

test('morning and afternoon share variants; next run day advances and wraps', () => {
  const day1Morning = planSession([], products, '2026-09-23', 'morning', start, 10);
  assert.deepEqual(day1Morning.map(post => post.text), ['A1', 'B1']);
  assert.equal(day1Morning[0].topic, 'squishy');
  assert.equal(day1Morning[1].scheduledAt, '2026-09-23T01:10:00.000Z');

  const editedProducts = structuredClone(products);
  editedProducts[0].contents[0].text = 'changed after morning';
  editedProducts[0].contents[0].topic = 'changed';
  const day1Afternoon = planSession(day1Morning, editedProducts, '2026-09-23', 'afternoon', start, 10);
  assert.deepEqual(day1Afternoon.map(post => post.text), ['A1', 'B1']);
  assert.equal(day1Afternoon[0].topic, 'squishy');
  assert.deepEqual(day1Afternoon.map(post => post.session?.dayNumber), [1, 1]);

  const history: Post[] = [...day1Morning, ...day1Afternoon];
  const day2Morning = planSession(history, products, '2026-09-24', 'morning', start, 10);
  assert.deepEqual(day2Morning.map(post => post.text), ['A2', 'B2']);
  const day3Morning = planSession([...history, ...day2Morning], products, '2026-09-25', 'morning', start, 10);
  assert.deepEqual(day3Morning.map(post => post.text), ['A1', 'B1']);
  assert.throws(() => planSession(history, products, '2026-09-23', 'morning', start, 10), /already exists/);
});

test('waits ten minutes after the previous actual submission', () => {
  const posts = planSession([], products, '2026-09-23', 'morning', start, 10);
  posts[0].status = 'needs_review';
  posts[0].submittedAt = '2026-09-23T01:03:00.000Z';
  assert.equal(new Date(nextDueTime(posts, posts[1], 10)).toISOString(), '2026-09-23T01:13:00.000Z');
});

test('a failed product is skipped and the next pending product is selected', () => {
  const posts = planSession([], products, '2026-09-23', 'morning', start, 10);
  posts[0].status = 'failed';
  assert.equal(nextSessionPost(posts)?.id, posts[1].id);
  assert.equal(new Date(nextDueTime(posts, posts[1], 10)).toISOString(), '2026-09-23T01:10:00.000Z');
  posts[1].status = 'failed';
  assert.equal(nextSessionPost(posts), null);
});

test('a failed middle product does not erase the gap after the last submission', () => {
  const threeProducts: Product[] = [...products, {
    id: 'c', name: 'C', contents: [{ id: 'c1', text: 'C1', images: [] }]
  }];
  const posts = planSession([], threeProducts, '2026-09-23', 'morning', start, 10);
  posts[0].status = 'needs_review';
  posts[0].submittedAt = '2026-09-23T01:15:00.000Z';
  posts[1].status = 'failed';
  assert.equal(nextSessionPost(posts)?.id, posts[2].id);
  assert.equal(new Date(nextDueTime(posts, posts[2], 10)).toISOString(), '2026-09-23T01:25:00.000Z');
});

test('session planning rejects emoji that render as missing glyphs on this browser', () => {
  const incompatible = structuredClone(products);
  incompatible[0].contents[0].text = 'Emoji lỗi 🫩';
  assert.throws(() => planSession([], incompatible, '2026-09-23', 'morning', start, 10), /U\+1FAE9/);
});
