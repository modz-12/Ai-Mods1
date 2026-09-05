'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { collection, addDoc, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import RequireAdmin from '@/components/RequireAdmin';
import ImageInput from '@/components/ImageInput';
import LoadingSpinner from '@/components/LoadingSpinner';

function AdminAlbumsInner() {
  const { user } = useAuth();
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [published, setPublished] = useState(false);

  async function load() {
    const snap = await getDocs(query(collection(db, 'albums'), orderBy('createdAt', 'desc')));
    setAlbums(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createAlbum(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'albums'), {
        title: title.trim(),
        description: description.trim(),
        coverUrl,
        photoCount: 0,
        published,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });
      setTitle('');
      setDescription('');
      setCoverUrl('');
      setPublished(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!confirm('حذف الألبوم ده؟')) return;
    await deleteDoc(doc(db, 'albums', id));
    load();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div>
        <h1 className="mb-4 font-display text-2xl">الألبومات</h1>
        {loading ? (
          <LoadingSpinner />
        ) : (
          <ul className="space-y-2">
            {albums.map((a) => (
              <li key={a.id} className="flex items-center gap-3 rounded-md border border-border bg-surface p-3">
                <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded bg-surface2">
                  {a.coverUrl && <Image src={a.coverUrl} alt={a.title} fill className="object-cover" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="text-xs text-muted">{a.published ? 'منشور' : 'مسودة'} · {a.photoCount || 0} صورة</p>
                </div>
                <Link href={`/admin/albums/${a.id}`} className="text-sm text-accent">
                  تعديل / صور
                </Link>
                <button onClick={() => remove(a.id)} className="text-sm text-muted hover:text-accent">
                  حذف
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={createAlbum} className="h-fit space-y-3 rounded-md border border-border bg-surface p-4">
        <h2 className="font-display text-lg">ألبوم جديد</h2>
        <input
          placeholder="عنوان الألبوم"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <textarea
          placeholder="الوصف"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <div>
          <p className="mb-1 text-sm text-muted">صورة الغلاف</p>
          <ImageInput value={coverUrl} onChange={setCoverUrl} folder="albums-covers" />
        </div>
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

export default function AdminAlbumsPage() {
  return (
    <RequireAdmin>
      <AdminAlbumsInner />
    </RequireAdmin>
  );
}
