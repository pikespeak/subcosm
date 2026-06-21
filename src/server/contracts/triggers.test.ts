// triggers contracts — unit tests for the tolerant trigger payload schemas.
//
// These schemas are the Zod BOUNDARY (V5) for the Reddit-platform → server
// trust boundary (T-03-01). They must accept the documented required ids AND
// tolerate extra/unknown platform fields (.passthrough(), A2 — exact 0.13.4
// nesting unconfirmed until the playtest spike), while still rejecting a payload
// missing a required id.
import { describe, expect, test } from 'vitest';
import {
  CommentCreatePayloadSchema,
  PostCreatePayloadSchema,
} from './triggers';

describe('CommentCreatePayloadSchema', () => {
  test('accepts the confirmed shape (comment.author + comment.postId required)', () => {
    const parsed = CommentCreatePayloadSchema.parse({
      author: { id: 't2_author' },
      comment: { id: 't1_comment', author: 't2_author', postId: 't3_post' },
      post: { id: 't3_post' },
    });
    expect(parsed.author.id).toBe('t2_author');
    expect(parsed.comment.id).toBe('t1_comment');
    expect(parsed.comment.author).toBe('t2_author');
    expect(parsed.comment.postId).toBe('t3_post');
    expect(parsed.post.id).toBe('t3_post');
  });

  test('tolerates an optional comment.parentId (reply-depth proxy)', () => {
    const reply = CommentCreatePayloadSchema.parse({
      author: { id: 't2_a' },
      comment: { id: 't1_c', author: 't2_a', postId: 't3_p', parentId: 't1_parent' },
      post: { id: 't3_p' },
    });
    expect(reply.comment.parentId).toBe('t1_parent'); // t1_ → a reply

    const topLevel = CommentCreatePayloadSchema.parse({
      author: { id: 't2_a' },
      comment: { id: 't1_c', author: 't2_a', postId: 't3_p', parentId: 't3_p' },
      post: { id: 't3_p' },
    });
    expect(topLevel.comment.parentId).toBe('t3_p'); // t3_ → a top-level comment
  });

  test('passes through extra unknown platform fields (A2)', () => {
    const parsed = CommentCreatePayloadSchema.parse({
      author: { id: 't2_a', name: 'someone' },
      comment: {
        id: 't1_c',
        author: 't2_a',
        postId: 't3_p',
        body: 'hi',
        extraNested: { x: 1 },
      },
      post: { id: 't3_p' },
      subreddit: { id: 't5_sub', name: 'sub' },
      unexpectedTopLevel: true,
    }) as Record<string, unknown>;
    expect(parsed.unexpectedTopLevel).toBe(true);
    expect(parsed.subreddit).toEqual({ id: 't5_sub', name: 'sub' });
  });

  test('rejects a payload missing a required id (boundary rejects malformed — V5)', () => {
    expect(() =>
      CommentCreatePayloadSchema.parse({
        author: {},
        comment: { id: 't1_c', author: 't2_a', postId: 't3_p' },
        post: { id: 't3_p' },
      }),
    ).toThrow();
    expect(() =>
      CommentCreatePayloadSchema.parse({
        author: { id: 't2_a' },
        comment: { id: 't1_c', author: 't2_a', postId: 't3_p' },
        // post.id missing
      }),
    ).toThrow();
    // The tightened fields are required: missing comment.author / comment.postId rejects.
    expect(() =>
      CommentCreatePayloadSchema.parse({
        author: { id: 't2_a' },
        comment: { id: 't1_c', postId: 't3_p' }, // comment.author missing
        post: { id: 't3_p' },
      }),
    ).toThrow();
    expect(() =>
      CommentCreatePayloadSchema.parse({
        author: { id: 't2_a' },
        comment: { id: 't1_c', author: 't2_a' }, // comment.postId missing
        post: { id: 't3_p' },
      }),
    ).toThrow();
  });
});

describe('PostCreatePayloadSchema', () => {
  test('accepts author.id + post.id and extra fields', () => {
    const parsed = PostCreatePayloadSchema.parse({
      author: { id: 't2_a' },
      post: { id: 't3_p', title: 'Hello', flair: 'x' },
      somethingElse: 1,
    }) as Record<string, unknown>;
    expect((parsed.author as { id: string }).id).toBe('t2_a');
    expect((parsed.post as { id: string }).id).toBe('t3_p');
    expect(parsed.somethingElse).toBe(1);
  });

  test('rejects a payload missing a required id', () => {
    expect(() =>
      PostCreatePayloadSchema.parse({ author: { id: 't2_a' } }),
    ).toThrow();
    expect(() =>
      PostCreatePayloadSchema.parse({ post: { id: 't3_p' } }),
    ).toThrow();
  });
});
