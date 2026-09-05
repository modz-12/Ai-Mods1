'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import ReelCard from '@/components/ReelCard';
import ReelModal from '@/components/ReelModal';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function ReelsPage() {
  const [reels, setReels] = useState([]);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const snap = await getDocs(
        query(collection(db, 'reels'), where('published', '==', true), orderBy('createdAt', 'desc'))
      );
      setReels(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div>
      <h1 className="mb-5 font-display text-2xl">الريلز</h1>
      {loading ? (
        <LoadingSpinner />
      ) : reels.length === 0 ? (
        <p className="rounded-md border border-border bg-surface p-6 text-center text-sm text-muted">
          لسه مفيش ريلز منشورة
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {reels.map((r) => (
            <ReelCard key={r.id} reel={r} onOpen={setActive} />
          ))}
        </div>
      )}
      {active && <ReelModal reel={active} onClose={() => setActive(null)} />}
    </div>
  );
}
