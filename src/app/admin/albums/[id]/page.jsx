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
  increment,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import Image from 'next/image';
import RequireAdmin from '@/components/RequireAdmin';
import ImageInput from '@/components/ImageInput';
import LoadingSpinner from '@/components/LoadingSpinner';
import { uploadFile } from '@/lib/storageUpload';
import { db } from '@/lib/firebase';

function AdminAlbumEditInner() {
  const { id } = useParams();
  const router = useRouter();

  const [album, setAlbum] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null);

  async function load() {
    const aSnap = await getDoc(doc(db, 'albums', id));
    if (!aSnap.exists()) {
      setLoading(false);
      return;
    }
    setAlbum({ id: aSnap.id, ...aSnap.data() });
    const pSnap = await getDocs(query(collection(db, 'albums', id, 'photos'), orderBy('order', 'asc')));
    setPhotos(pSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function saveAlbum(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateDoc(doc(db, 'albums', id), {
        title: album.title,
        description: album.description || '',
        coverUrl: album.coverUrl || '',
        published: album.published,
      });
    } finally {
      setSaving(false);
    }
  }

  async function deleteAlbum() {
    if (!confirm('حذف الألبوم ده نهائي، متأكد؟')) return;
    await deleteDoc(doc(db, 'albums', id));
    router.push('/admin/albums');
  }

  async function handlePhotosSelected(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    let count = 0;
    for (const file of files) {
      count += 1;
      setProgress(`جاري رفع ${count} من ${files.length}`);
      const url = await uploadFile('albums-photos', file);
      await addDoc(collection(db, 'albums', id, 'photos'), {
        url,
        caption: '',
        order: photos.length + count,
        createdAt: serverTimestamp(),
      });
    }
    await updateDoc(doc(db, 'albums', id), { photoCount: increment(files.length) });
    setUploading(false);
    setProgress(null);
    e.target.value = '';
    load();
  }

  async function deletePhoto(photoId) {
    if (!confirm('حذف الصورة دي؟')) return;
    await deleteDoc(doc(db, 'albums', id, 'photos', photoId));
    await updateDoc(doc(db, 'albums', id), { photoCount: increment(-1) });
    load();
  }

  if (loading) return <LoadingSpinner />;
  if (!album) return <p className="py-10 text-center text-muted">الألبوم ده مش موجود</p>;

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form onSubmit={saveAlbum} className="h-fit space-y-3 rounded-md border border-border bg-surface p-4">
        <h1 className="font-display text-xl">بيانات الألبوم</h1>
        <input
          value={album.title}
          onChange={(e) => setAlbum({ ...album, title: e.target.value })}
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <textarea
          value={album.description || ''}
          onChange={(e) => setAlbum({ ...album, description: e.target.value })}
          rows={2}
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <div>
          <p className="mb-1 text-sm text-muted">صورة الغلاف</p>
          <ImageInput value={album.coverUrl} onChange={(url) => setAlbum({ ...album, coverUrl: url })} folder="albums-covers" />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={album.published} onChange={(e) => setAlbum({ ...album, published: e.target.checked })} />
          منشور
        </label>
        <div className="flex gap-2">
          <button disabled={saving} className="flex-1 rounded-full bg-accent py-2 text-sm font-medium text-white">
            {saving ? 'جاري الحفظ...' : 'حفظ'}
          </button>
          <button type="button" onClick={deleteAlbum} className="rounded-full border border-border px-4 text-sm text-muted hover:text-accent">
            حذف الألبوم
          </button>
        </div>
      </form>

      <div>
        <h2 className="mb-3 font-display text-xl">الصور ({photos.length})</h2>
        <div className="mb-4 rounded-md border border-border bg-surface p-4">
          <input type="file" accept="image/*" multiple onChange={handlePhotosSelected} className="text-sm text-muted" disabled={uploading} />
          {progress && <p className="mt-1 text-xs text-accent">{progress}</p>}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <div key={p.id} className="group relative aspect-square overflow-hidden rounded-md border border-border bg-surface2">
              <Image src={p.url} alt="" fill className="object-cover" />
              <button
                onClick={() => deletePhoto(p.id)}
                className="absolute inset-x-0 bottom-0 bg-black/70 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100"
              >
                حذف
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AdminAlbumEditPage() {
  return (
    <RequireAdmin>
      <AdminAlbumEditInner />
    </RequireAdmin>
  );
}
