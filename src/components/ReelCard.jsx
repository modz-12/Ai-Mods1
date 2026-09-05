'use client';

import Image from 'next/image';

export default function ReelCard({ reel, onOpen }) {
  return (
    <button
      onClick={() => onOpen(reel)}
      className="group relative block aspect-[9/16] w-full overflow-hidden rounded-md border border-border bg-surface2 text-right"
    >
      {reel.thumbnail ? (
        <Image src={reel.thumbnail} alt={reel.title} fill sizes="200px" className="object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center text-3xl text-muted">▶</div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
        <p className="line-clamp-2 text-xs text-white">{reel.title}</p>
      </div>
      <div className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
        <span className="text-2xl text-white drop-shadow">▶</span>
      </div>
    </button>
  );
}
