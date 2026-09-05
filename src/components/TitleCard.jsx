import Link from 'next/link';
import Image from 'next/image';

export default function TitleCard({ id, name, coverUrl, genres = [] }) {
  return (
    <Link
      href={`/titles/${id}`}
      className="group block overflow-hidden rounded-md border border-border bg-surface transition hover:border-accent"
    >
      <div className="relative aspect-[2/3] w-full bg-surface2">
        {coverUrl && (
          <Image
            src={coverUrl}
            alt={name}
            fill
            sizes="(max-width: 768px) 45vw, 220px"
            className="object-cover transition group-hover:opacity-90"
          />
        )}
      </div>
      <div className="p-2.5">
        <h3 className="line-clamp-2 text-sm font-medium text-ink">{name}</h3>
        {genres.length > 0 && (
          <p className="mt-1 line-clamp-1 text-xs text-muted">{genres.join(' · ')}</p>
        )}
      </div>
    </Link>
  );
}
