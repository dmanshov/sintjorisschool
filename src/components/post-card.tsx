import Image from 'next/image';
import { toggleLikeAction } from '@/lib/actions/posts';
import type { PostWithMeta } from '@/lib/data/posts';
import { LikeButton } from './like-button';

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('nl-BE', {
    timeZone: 'Europe/Brussels',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function PostCard({
  post,
  canLike,
  priority = false,
}: {
  post: PostWithMeta;
  canLike: boolean;
  priority?: boolean;
}) {
  return (
    <article className="card flex flex-col overflow-hidden p-0">
      {post.postPhoto ? (
        <Image
          src={post.postPhoto}
          alt=""
          width={800}
          height={520}
          priority={priority}
          className="aspect-[16/10] w-full object-cover"
          // Post photos come from user uploads of unknown provenance; if one is
          // missing the layout must not collapse.
          unoptimized={post.postPhoto.startsWith('http') === false}
        />
      ) : null}

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          {post.pinned ? (
            <span className="rounded-full bg-secondary/15 px-2.5 py-0.5 text-xs font-medium text-secondary">
              Vastgepind
            </span>
          ) : null}
          {post.classroom.map((room) => (
            <span
              key={room}
              className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
            >
              {room}
            </span>
          ))}
        </div>

        <h3 className="mt-3 font-display text-xl leading-snug font-semibold">{post.postTitle}</h3>

        <p className="mt-1 text-xs text-ink-muted">
          <time dateTime={post.timePosted.toISOString()}>{formatDate(post.timePosted)}</time>
          {post.authorName ? ` · ${post.authorName}` : ''}
        </p>

        {post.postDescription ? (
          <div className="prose-cms mt-3 text-[15px] text-ink">{post.postDescription}</div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-3 pt-1">
          {post.albumUrl ? (
            <a
              href={post.albumUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-primary px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary hover:text-white"
            >
              Toon alle foto&apos;s
            </a>
          ) : null}
          {post.externalUrl ? (
            <a
              href={post.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg px-3 py-2 text-sm font-medium text-primary underline-offset-2 hover:underline"
            >
              Ga verder
            </a>
          ) : null}

          <div className="ml-auto">
            {canLike ? (
              <form action={toggleLikeAction}>
                <input type="hidden" name="postId" value={post.id} />
                <LikeButton liked={post.likedByViewer} count={post.likeCount} />
              </form>
            ) : post.likeCount > 0 ? (
              <span className="text-sm text-ink-muted" aria-label={`${post.likeCount} keer leuk gevonden`}>
                ♥ {post.likeCount}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
