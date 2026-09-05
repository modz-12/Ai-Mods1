'use client';

import VideoPlayer from './VideoPlayer';
import FavoriteButton from './FavoriteButton';
import CommentSection from './CommentSection';

export default function ReelModal({ reel, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-md bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg">{reel.title}</h3>
          <button onClick={onClose} className="text-muted hover:text-ink">
            ✕
          </button>
        </div>
        <VideoPlayer video={reel} />
        <div className="mt-3">
          <FavoriteButton type="reel" refId={reel.id} title={reel.title} cover={reel.thumbnail} />
        </div>
        <CommentSection pathSegments={['reels', reel.id, 'comments']} />
      </div>
    </div>
  );
}
