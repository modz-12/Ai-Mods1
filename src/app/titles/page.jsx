'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import TitleCard from '@/components/TitleCard';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function TitlesPage() {
  const [titles, setTitles] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const snap = await getDocs(
        query(collection(db, 'titles'), where('published', '==', true), orderBy('createdAt', 'desc'))
      );
      setTitles(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return titles;
    return titles.filter((t) => (t.name || '').toLowerCase().includes(q));
  }, [titles, search]);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl">المسلسلات</h1>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="دور على مسلسل..."
          className="w-48 rounded-full border border-border bg-surface px-4 py-2 text-sm outline-none focus:border-accent sm:w-64"
        />
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <p className="rounded-md border border-border bg-surface p-6 text-center text-sm text-muted">
          مفيش نتايج
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {filtered.map((t) => (
            <TitleCard key={t.id} id={t.id} name={t.name} coverUrl={t.coverUrl} genres={t.genres} />
          ))}
        </div>
      )}
    </div>
  );
}
