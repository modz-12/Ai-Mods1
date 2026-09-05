'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore';
import Image from 'next/image';
import { db } from '@/lib/firebase';
import VideoPlayer from '@/components/VideoPlayer';
import FavoriteButton from '@/components/FavoriteButton';
import CommentSection from '@/components/CommentSection';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function TitleDetailPage() {
  const { id } = useParams();
  const [title, setTitle] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [activeEpisode, setActiveEpisode] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const tSnap = await getDoc(doc(db, 'titles', id));
      if (tSnap.exists()) setTitle({ id: tSnap.id, ...tSnap.data() });

      const eSnap = await getDocs(query(collection(db, 'titles', id, 'episodes'), orderBy('number', 'asc')));
      const eps = eSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setEpisodes(eps);
      setActiveEpisode(eps[0] || null);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return <LoadingSpinner />;
  if (!title) return <p className="py-10 text-center text-muted">المسلسل ده مش موجود</p>;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-5 sm:flex-row">
        <div className="relative aspect-[2/3] w-40 flex-shrink-0 overflow-hidden rounded-md bg-surface2">
          {title.coverUrl && <Image src={title.coverUrl} alt={title.name} fill className="object-cover" />}
        </div>
        <div>
          <h1 className="font-display text-2xl">{title.name}</h1>
          {title.genres?.length > 0 && <p className="mt-1 text-sm text-muted">{title.genres.join(' · ')}</p>}
          <p className="mt-3 max-w-2xl text-sm text-muted">{title.description}</p>
          <div className="mt-4">
            <FavoriteButton type="title" refId={title.id} title={title.name} cover={title.coverUrl} />
          </div>
        </div>
      </div>

      {activeEpisode ? (
        <div className="mb-6">
          <VideoPlayer video={activeEpisode} />
          <p className="mt-2 text-sm text-muted">
            الحلقة {activeEpisode.number} — {activeEpisode.title}
          </p>
        </div>
      ) : (
        <p className="mb-6 rounded-md border border-border bg-surface p-6 text-center text-sm text-muted">
          لسه مفيش حلقات مضافة
        </p>
      )}

      {episodes.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-2 font-display text-lg">الحلقات</h2>
          <div className="flex flex-wrap gap-2">
            {episodes.map((ep) => (
              <button
                key={ep.id}
                onClick={() => setActiveEpisode(ep)}
                className={`rounded-full border px-3.5 py-1.5 text-sm ${
                  activeEpisode?.id === ep.id
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border text-muted hover:text-ink'
                }`}
              >
                {ep.number}
              </button>
            ))}
          </div>
        </div>
      )}

      <CommentSection pathSegments={['titles', title.id, 'comments']} />
    </div>
  );
}
