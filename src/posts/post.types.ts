export type PostStatus = 'draft' | 'pending' | 'publishing' | 'needs_review' | 'published' | 'failed';
export type SessionSlot = 'morning' | 'afternoon';

export interface PostSession {
  date: string;
  slot: SessionSlot;
  dayNumber: number;
  productId: string;
  contentId: string;
  order: number;
}

export interface Post {
  id: string;
  text: string;
  /** Files below data/media, relative to the project root. */
  images?: string[];
  /** Exact Threads community or topic label to select in the composer. */
  topic?: string | null;
  /** ISO 8601 with a timezone offset, e.g. 2026-09-24T09:00:00+07:00. */
  scheduledAt?: string | null;
  session?: PostSession;
  status: PostStatus;
  createdAt: string | null;
  submittedAt?: string | null;
  publishedAt: string | null;
  error: string | null;
}
