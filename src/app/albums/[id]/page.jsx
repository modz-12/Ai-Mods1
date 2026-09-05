'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import FavoriteButton from '@/components/FavoriteButton';
import CommentSection from '@/components/CommentSection';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function AlbumDetailPage() {
  const { id } = useParams();
  const [album, setAlbum] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [lightboxIdx, setLightboxIdx] = useState(-1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const aSnap = await getDoc(doc(db, 'albums', id));
      if (aSnap.exists()) setAlbum({ id: aSnap.id, ...aSnap.data() });

      const pSnap = await getDocs(query(collection(db, 'albums', id, 'photos'), orderBy('order', 'asc')));
      setPhotos(pSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return <LoadingSpinner />;
  if (!album) return <p className="py-10 text-center text-muted">الألبوم ده مش موجود</p>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl">{album.title}</h1>
          {album.description && <p className="mt-1 text-sm text-muted">{album.description}</p>}
        </div>
        <FavoriteButton type="album" refId={album.id} title={album.title} cover={album.coverUrl} />
      </div>

      {photos.length === 0 ? (
        <p className="rounded-md border border-border bg-surface p-6 text-center text-sm text-muted">
          لسه مفيش صور في الألبوم ده
        </p>
      ) : (
        <div className="columns-2 gap-3 sm:columns-3 md:columns-4">
          {photos.map((p, idx) => (
            <button
              key={p.id}
              onClick={() => setLightboxIdx(idx)}
              className="mb-3 block w-full overflow-hidden rounded-md border border-border bg-surface2"
            >
              <img src={p.url} alt={p.caption || album.title} loading="lazy" className="w-full" />
            </button>
          ))}
        </div>
      )}

      {lightboxIdx > -1 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={(e) => e.target === e.currentTarget && setLightboxIdx(-1)}
        >
          <button
            className="absolute left-4 top-4 text-2xl text-white"
            onClick={() => setLightboxIdx(-1)}
          >
            ✕
          </button>
          <button
            className="absolute right-4 text-3xl text-white"
            onClick={() => setLightboxIdx((lightboxIdx - 1 + photos.length) % photos.length)}
          >
            ›
          </button>
          <img
            src={photos[lightboxIdx].url}
            alt=""
            className="max-h-[85vh] max-w-[90vw] rounded-md object-contain"
          />
          <button
            className="absolute left-4 text-3xl text-white"
            onClick={() => setLightboxIdx((lightboxIdx + 1) % photos.length)}
          >
            ‹
          </button>
        </div>
      )}

      <CommentSection pathSegments={['albums', album.id, 'comments']} />
    </div>
  );
}
