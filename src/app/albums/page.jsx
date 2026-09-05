'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import AlbumCard from '@/components/AlbumCard';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function AlbumsPage() {
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const snap = await getDocs(
        query(collection(db, 'albums'), where('published', '==', true), orderBy('createdAt', 'desc'))
      );
      setAlbums(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div>
      <h1 className="mb-5 font-display text-2xl">الألبومات</h1>
      {loading ? (
        <LoadingSpinner />
      ) : albums.length === 0 ? (
        <p className="rounded-md border border-border bg-surface p-6 text-center text-sm text-muted">
          لسه مفيش ألبومات منشورة
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {albums.map((a) => (
            <AlbumCard key={a.id} id={a.id} title={a.title} coverUrl={a.coverUrl} photoCount={a.photoCount} />
          ))}
        </div>
      )}
    </div>
  );
}
