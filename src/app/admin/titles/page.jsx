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

function AdminTitlesInner() {
  const { user } = useAuth();
  const [titles, setTitles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [genres, setGenres] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [published, setPublished] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    const snap = await getDocs(query(collection(db, 'titles'), orderBy('createdAt', 'desc')));
    setTitles(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createTitle(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'titles'), {
        name: name.trim(),
        description: description.trim(),
        genres: genres.split(',').map((g) => g.trim()).filter(Boolean),
        coverUrl,
        published,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });
      setName('');
      setDescription('');
      setGenres('');
      setCoverUrl('');
      setPublished(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!confirm('متأكد إنك عايز تحذف المسلسل ده؟')) return;
    await deleteDoc(doc(db, 'titles', id));
    load();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div>
        <h1 className="mb-4 font-display text-2xl">المسلسلات</h1>
        {loading ? (
          <LoadingSpinner />
        ) : (
          <ul className="space-y-2">
            {titles.map((t) => (
              <li key={t.id} className="flex items-center gap-3 rounded-md border border-border bg-surface p-3">
                <div className="relative h-14 w-10 flex-shrink-0 overflow-hidden rounded bg-surface2">
                  {t.coverUrl && <Image src={t.coverUrl} alt={t.name} fill className="object-cover" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-muted">{t.published ? 'منشور' : 'مسودة'}</p>
                </div>
                <Link href={`/admin/titles/${t.id}`} className="text-sm text-accent">
                  تعديل / حلقات
                </Link>
                <button onClick={() => remove(t.id)} className="text-sm text-muted hover:text-accent">
                  حذف
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={createTitle} className="h-fit space-y-3 rounded-md border border-border bg-surface p-4">
        <h2 className="font-display text-lg">مسلسل جديد</h2>
        <input
          placeholder="اسم المسلسل"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <textarea
          placeholder="الوصف"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <input
          placeholder="التصنيفات (مفصولة بفاصلة)"
          value={genres}
          onChange={(e) => setGenres(e.target.value)}
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <div>
          <p className="mb-1 text-sm text-muted">صورة الغلاف</p>
          <ImageInput value={coverUrl} onChange={setCoverUrl} folder="titles-covers" />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          نشر مباشرة
        </label>
        <button
          disabled={saving}
          className="w-full rounded-full bg-accent py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? 'جاري الحفظ...' : 'إضافة'}
        </button>
      </form>
    </div>
  );
}

export default function AdminTitlesPage() {
  return (
    <RequireAdmin>
      <AdminTitlesInner />
    </RequireAdmin>
  );
}
