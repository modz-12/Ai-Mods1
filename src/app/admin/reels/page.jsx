'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import RequireAdmin from '@/components/RequireAdmin';
import VideoInput from '@/components/VideoInput';
import LoadingSpinner from '@/components/LoadingSpinner';

function AdminReelsInner() {
  const { user } = useAuth();
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [video, setVideo] = useState(null);
  const [published, setPublished] = useState(true);

  async function load() {
    const snap = await getDocs(query(collection(db, 'reels'), orderBy('createdAt', 'desc')));
    setReels(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createReel(e) {
    e.preventDefault();
    if (!video?.videoUrl) {
      alert('ضيف الفيديو الأول');
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, 'reels'), {
        title: title.trim(),
        videoType: video.videoType,
        videoUrl: video.videoUrl,
        embedUrl: video.embedUrl,
        thumbnail: video.thumbnail,
        published,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });
      setTitle('');
      setVideo(null);
      setPublished(true);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(reel) {
    await updateDoc(doc(db, 'reels', reel.id), { published: !reel.published });
    load();
  }

  async function remove(id) {
    if (!confirm('حذف الريل ده؟')) return;
    await deleteDoc(doc(db, 'reels', id));
    load();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div>
        <h1 className="mb-4 font-display text-2xl">الريلز</h1>
        {loading ? (
          <LoadingSpinner />
        ) : (
          <ul className="space-y-2">
            {reels.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-md border border-border bg-surface p-3 text-sm">
                <span>{r.title || 'بدون عنوان'}</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => togglePublish(r)} className="text-muted hover:text-ink">
                    {r.published ? 'إخفاء' : 'نشر'}
                  </button>
                  <button onClick={() => remove(r.id)} className="text-muted hover:text-accent">
                    حذف
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={createReel} className="h-fit space-y-3 rounded-md border border-border bg-surface p-4">
        <h2 className="font-display text-lg">ريل جديد</h2>
        <input
          placeholder="عنوان (اختياري)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <VideoInput value={video} onChange={setVideo} folder="reels" />
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          نشر مباشرة
        </label>
        <button disabled={saving} className="w-full rounded-full bg-accent py-2 text-sm font-medium text-white disabled:opacity-60">
          {saving ? 'جاري الحفظ...' : 'إضافة'}
        </button>
      </form>
    </div>
  );
}

export default function AdminReelsPage() {
  return (
    <RequireAdmin>
      <AdminReelsInner />
    </RequireAdmin>
  );
}
