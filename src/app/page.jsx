'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, limit, orderBy, query, where } from 'firebase/firestore';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import TitleCard from '@/components/TitleCard';
import AlbumCard from '@/components/AlbumCard';
import ReelCard from '@/components/ReelCard';
import ReelModal from '@/components/ReelModal';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function HomePage() {
  const [titles, setTitles] = useState([]);
  const [reels, setReels] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeReel, setActiveReel] = useState(null);

  useEffect(() => {
    async function load() {
      const [tSnap, rSnap, aSnap] = await Promise.all([
        getDocs(query(collection(db, 'titles'), where('published', '==', true), orderBy('createdAt', 'desc'), limit(6))),
        getDocs(query(collection(db, 'reels'), where('published', '==', true), orderBy('createdAt', 'desc'), limit(6))),
        getDocs(query(collection(db, 'albums'), where('published', '==', true), orderBy('createdAt', 'desc'), limit(6))),
      ]);
      setTitles(tSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setReels(rSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setAlbums(aSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-12">
      <Section title="أحدث المسلسلات" moreHref="/titles">
        {titles.length === 0 ? (
          <EmptyRow text="لسه مفيش مسلسلات منشورة" />
        ) : (
          <Grid>
            {titles.map((t) => (
              <TitleCard key={t.id} id={t.id} name={t.name} coverUrl={t.coverUrl} genres={t.genres} />
            ))}
          </Grid>
        )}
      </Section>

      <Section title="أحدث الريلز" moreHref="/reels">
        {reels.length === 0 ? (
          <EmptyRow text="لسه مفيش ريلز منشورة" />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
            {reels.map((r) => (
              <ReelCard key={r.id} reel={r} onOpen={setActiveReel} />
            ))}
          </div>
        )}
      </Section>

      <Section title="أحدث الألبومات" moreHref="/albums">
        {albums.length === 0 ? (
          <EmptyRow text="لسه مفيش ألبومات منشورة" />
        ) : (
          <Grid>
            {albums.map((a) => (
              <AlbumCard key={a.id} id={a.id} title={a.title} coverUrl={a.coverUrl} photoCount={a.photoCount} />
            ))}
          </Grid>
        )}
      </Section>

      {activeReel && <ReelModal reel={activeReel} onClose={() => setActiveReel(null)} />}
    </div>
  );
}

function Section({ title, moreHref, children }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-xl">{title}</h2>
        <Link href={moreHref} className="text-sm text-accent">
          عرض الكل
        </Link>
      </div>
      {children}
    </section>
  );
}

function Grid({ children }) {
  return <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">{children}</div>;
}

function EmptyRow({ text }) {
  return <p className="rounded-md border border-border bg-surface p-6 text-center text-sm text-muted">{text}</p>;
}
