export type PostStatus = 'pending' | 'publishing' | 'published' | 'failed';

export interface Post {
  id: string;
  text: string;
  status: PostStatus;
  createdAt: string | null;
  publishedAt: string | null;
  error: string | null;
}
