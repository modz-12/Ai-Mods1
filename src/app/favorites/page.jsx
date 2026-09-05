'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import RequireAuth from '@/components/RequireAuth';
import LoadingSpinner from '@/components/LoadingSpinner';

const TYPE_HREF = {
  title: (id) => `/titles/${id}`,
  album: (id) => `/albums/${id}`,
  reel: () => `/reels`,
};

const TYPE_LABEL = { title: 'مسلسل', album: 'ألبوم', reel: 'ريل' };

function FavoritesInner() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const snap = await getDocs(query(collection(db, 'favorites', user.uid, 'items'), orderBy('addedAt', 'desc')));
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }
    load();
  }, [user]);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <h1 className="mb-5 font-display text-2xl">المفضلة</h1>
      {items.length === 0 ? (
        <p className="rounded-md border border-border bg-surface p-6 text-center text-sm text-muted">
          لسه مضفتش حاجة للمفضلة
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {items.map((it) => (
            <Link
              key={it.id}
              href={TYPE_HREF[it.type](it.refId)}
              className="block overflow-hidden rounded-md border border-border bg-surface"
            >
              <div className="relative aspect-square w-full bg-surface2">
                {it.cover && <Image src={it.cover} alt={it.title} fill className="object-cover" />}
              </div>
              <div className="p-2.5">
                <p className="line-clamp-1 text-sm text-ink">{it.title}</p>
                <p className="text-xs text-muted">{TYPE_LABEL[it.type]}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FavoritesPage() {
  return (
    <RequireAuth>
      <FavoritesInner />
    </RequireAuth>
  );
}
