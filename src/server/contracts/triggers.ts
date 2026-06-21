// triggers contracts — tolerant Zod schemas for the create-trigger payloads.
//
// These are the Zod BOUNDARY (CLAUDE.md §6, V5) for the Reddit-platform → server
// trust boundary (threat T-03-01): every `onPostCreate` / `onCommentCreate`
// handler `.parse()`s the raw body through one of these before touching it.
//
// Zod is the single source of truth (CLAUDE.md §1/§9): the types below are
// `z.infer` of the schemas — there is NO hand-written `interface`/`type` for
// these shapes.
//
// `.passthrough()` is deliberate (CLAUDE.md §6 tolerant boundary, A2): the
// platform may add fields across SDK versions, so unknown fields pass through —
// a slightly-different real payload still parses. The exact 0.13.4 nesting is
// now CONFIRMED from the 03-01 Wave-0 playtest (03-01-SUMMARY.md), so 03-02
// tightens `CommentCreatePayloadSchema` to require the fields the counters key
// on: `comment.author` (the contributor id), `comment.postId` (the thread root
// for the ZSET) and `comment.parentId` (reply-depth discriminator). We still
// only require the ids we actually depend on, so a payload missing a required id
// is rejected at the boundary (V5).
//
// Confirmed `onCommentCreate` shape (03-01-SUMMARY.md, r/subcosm_test_om):
//   comment.id       = t1_…  (the comment)
//   comment.author   = t2_…  STRING id → unique-contributor SET key
//   comment.postId   = t3_…  thread root → top-threads ZSET member
//   comment.parentId = t3_…  (top-level) | t1_… (a reply → reply-depth proxy)
import { z } from 'zod';

/** Shared minimal author ref — only the id we key on is required. */
const AuthorSchema = z.object({ id: z.string() }).passthrough();

/**
 * onCommentCreate payload (DEV-02/DEV-03). Counters key on the nested
 * `comment.*` fields confirmed in the spike: `comment.author` (contributor),
 * `comment.postId` (thread root), `comment.parentId` (present → reply-depth
 * proxy). `parentId` starting `t1_` = a reply; `t3_` = a top-level comment.
 * Top-level `author.id` is kept (tolerant) but the contributor SET uses the
 * authoritative `comment.author` string id. Extra platform fields pass through.
 */
export const CommentCreatePayloadSchema = z
  .object({
    author: AuthorSchema,
    comment: z
      .object({
        id: z.string(),
        author: z.string(), // t2_… contributor id (string, per 03-01 spike)
        postId: z.string(), // t3_… thread root → top-threads ZSET
        parentId: z.string().optional(), // t1_ = reply, t3_ = top-level
      })
      .passthrough(),
    post: z.object({ id: z.string() }).passthrough(),
  })
  .passthrough();
export type CommentCreatePayload = z.infer<typeof CommentCreatePayloadSchema>;

/**
 * onPostCreate payload (DEV-02). Required: author.id, post.id. Extra platform
 * fields pass through (A2).
 */
export const PostCreatePayloadSchema = z
  .object({
    author: AuthorSchema,
    post: z.object({ id: z.string() }).passthrough(),
  })
  .passthrough();
export type PostCreatePayload = z.infer<typeof PostCreatePayloadSchema>;
