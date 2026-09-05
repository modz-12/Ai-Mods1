'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import RequireAdmin from '@/components/RequireAdmin';
import ImageInput from '@/components/ImageInput';
import VideoInput from '@/components/VideoInput';
import LoadingSpinner from '@/components/LoadingSpinner';
import { db } from '@/lib/firebase';

function AdminTitleEditInner() {
  const { id } = useParams();
  const router = useRouter();

  const [title, setTitle] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // نموذج الحلقة الجديدة
  const [epNumber, setEpNumber] = useState('');
  const [epTitle, setEpTitle] = useState('');
  const [epVideo, setEpVideo] = useState(null);
  const [addingEp, setAddingEp] = useState(false);

  async function load() {
    const tSnap = await getDoc(doc(db, 'titles', id));
    if (!tSnap.exists()) {
      setLoading(false);
      return;
    }
    setTitle({ id: tSnap.id, ...tSnap.data() });
    const eSnap = await getDocs(query(collection(db, 'titles', id, 'episodes'), orderBy('number', 'asc')));
    setEpisodes(eSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function saveTitle(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateDoc(doc(db, 'titles', id), {
        name: title.name,
        description: title.description || '',
        genres: title.genres || [],
        coverUrl: title.coverUrl || '',
        published: title.published,
      });
    } finally {
      setSaving(false);
    }
  }

  async function deleteTitle() {
    if (!confirm('حذف المسلسل ده نهائي، متأكد؟')) return;
    await deleteDoc(doc(db, 'titles', id));
    router.push('/admin/titles');
  }

  async function addEpisode(e) {
    e.preventDefault();
    if (!epVideo?.videoUrl) {
      alert('ضيف فيديو الحلقة الأول');
      return;
    }
    setAddingEp(true);
    try {
      await addDoc(collection(db, 'titles', id, 'episodes'), {
        number: Number(epNumber) || episodes.length + 1,
        title: epTitle.trim(),
        videoType: epVideo.videoType,
        videoUrl: epVideo.videoUrl,
        embedUrl: epVideo.embedUrl,
        thumbnail: epVideo.thumbnail,
        published: true,
        createdAt: serverTimestamp(),
      });
      setEpNumber('');
      setEpTitle('');
      setEpVideo(null);
      load();
    } finally {
      setAddingEp(false);
    }
  }

  async function deleteEpisode(epId) {
    if (!confirm('حذف الحلقة دي؟')) return;
    await deleteDoc(doc(db, 'titles', id, 'episodes', epId));
    load();
  }

  if (loading) return <LoadingSpinner />;
  if (!title) return <p className="py-10 text-center text-muted">المسلسل ده مش موجود</p>;

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form onSubmit={saveTitle} className="h-fit space-y-3 rounded-md border border-border bg-surface p-4">
        <h1 className="font-display text-xl">بيانات المسلسل</h1>
        <input
          value={title.name}
          onChange={(e) => setTitle({ ...title, name: e.target.value })}
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <textarea
          value={title.description || ''}
          onChange={(e) => setTitle({ ...title, description: e.target.value })}
          rows={3}
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <input
          value={(title.genres || []).join(', ')}
          onChange={(e) => setTitle({ ...title, genres: e.target.value.split(',').map((g) => g.trim()).filter(Boolean) })}
          placeholder="التصنيفات"
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <div>
          <p className="mb-1 text-sm text-muted">صورة الغلاف</p>
          <ImageInput value={title.coverUrl} onChange={(url) => setTitle({ ...title, coverUrl: url })} folder="titles-covers" />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={title.published}
            onChange={(e) => setTitle({ ...title, published: e.target.checked })}
          />
          منشور
        </label>
        <div className="flex gap-2">
          <button disabled={saving} className="flex-1 rounded-full bg-accent py-2 text-sm font-medium text-white">
            {saving ? 'جاري الحفظ...' : 'حفظ'}
          </button>
          <button type="button" onClick={deleteTitle} className="rounded-full border border-border px-4 text-sm text-muted hover:text-accent">
            حذف المسلسل
          </button>
        </div>
      </form>

      <div>
        <h2 className="mb-3 font-display text-xl">الحلقات ({episodes.length})</h2>
        <ul className="mb-5 space-y-2">
          {episodes.map((ep) => (
            <li key={ep.id} className="flex items-center justify-between rounded-md border border-border bg-surface p-3 text-sm">
              <span>
                #{ep.number} — {ep.title || 'بدون عنوان'}
              </span>
              <button onClick={() => deleteEpisode(ep.id)} className="text-muted hover:text-accent">
                حذف
              </button>
            </li>
          ))}
        </ul>

        <form onSubmit={addEpisode} className="space-y-3 rounded-md border border-border bg-surface p-4">
          <h3 className="font-display text-lg">إضافة حلقة</h3>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="رقم الحلقة"
              value={epNumber}
              onChange={(e) => setEpNumber(e.target.value)}
              className="w-28 rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <input
              placeholder="عنوان الحلقة (اختياري)"
              value={epTitle}
              onChange={(e) => setEpTitle(e.target.value)}
              className="flex-1 rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <VideoInput value={epVideo} onChange={setEpVideo} folder="episodes" />
          <button disabled={addingEp} className="w-full rounded-full bg-accent py-2 text-sm font-medium text-white disabled:opacity-60">
            {addingEp ? 'جاري الإضافة...' : 'إضافة الحلقة'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminTitleEditPage() {
  return (
    <RequireAdmin>
      <AdminTitleEditInner />
    </RequireAdmin>
  );
}
