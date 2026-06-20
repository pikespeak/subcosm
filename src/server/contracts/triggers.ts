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
// `.passthrough()` is deliberate and is the "until confirmed" state (A2): the
// exact 0.13.4 payload nesting (especially `comment.parentId` / thread root for
// reply-depth) is NOT yet verified on a real playtest. Tolerating extra/unknown
// platform fields means a slightly-different real payload still parses; the
// 03-01 Wave-0 spike logs the first real payload, and plan 03-02 tightens
// `CommentCreatePayloadSchema` against the captured shape. We only require the
// ids we actually depend on (author/post/comment), so a malformed payload
// missing a required id is still rejected.
import { z } from 'zod';

/** Shared minimal author ref — only the id we key on is required. */
const AuthorSchema = z.object({ id: z.string() }).passthrough();

/**
 * onCommentCreate payload (DEV-02/DEV-03). Required: author.id, comment.id,
 * post.id. Optional: comment.parentId (present = a reply → reply-depth proxy).
 * Extra platform fields pass through (A2).
 */
export const CommentCreatePayloadSchema = z
  .object({
    author: AuthorSchema,
    comment: z
      .object({
        id: z.string(),
        parentId: z.string().optional(),
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
