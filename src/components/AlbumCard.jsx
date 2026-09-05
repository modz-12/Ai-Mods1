import Link from 'next/link';
import Image from 'next/image';

export default function AlbumCard({ id, title, coverUrl, photoCount }) {
  return (
    <Link
      href={`/albums/${id}`}
      className="group block overflow-hidden rounded-md border border-border bg-surface transition hover:border-accent"
    >
      <div className="relative aspect-square w-full bg-surface2">
        {coverUrl && (
          <Image
            src={coverUrl}
            alt={title}
            fill
            sizes="(max-width: 768px) 45vw, 220px"
            className="object-cover transition group-hover:opacity-90"
          />
        )}
      </div>
      <div className="p-2.5">
        <h3 className="line-clamp-1 text-sm font-medium text-ink">{title}</h3>
        {typeof photoCount === 'number' && (
          <p className="mt-1 text-xs text-muted">{photoCount} صورة</p>
        )}
      </div>
    </Link>
  );
}
