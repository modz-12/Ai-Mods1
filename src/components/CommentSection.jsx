'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

/**
 * pathSegments: مصفوفة أجزاء المسار لغاية الـ comments subcollection
 * مثال: ['titles', titleId, 'comments'] أو ['reels', reelId, 'comments']
 */
export default function CommentSection({ pathSegments }) {
  const { user, profile, isAdmin } = useAuth();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const collectionRef = collection(db, ...pathSegments);

  useEffect(() => {
    const q = query(collectionRef, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathSegments.join('/')]);

  async function submit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setError('');
    try {
      await addDoc(collectionRef, {
        userId: user.uid,
        userName: profile?.displayName || user.email,
        text: text.trim(),
        createdAt: serverTimestamp(),
      });
      setText('');
    } catch (err) {
      setError('حصل خطأ، حاول تاني');
    }
  }

  async function remove(id) {
    const ref = doc(db, ...pathSegments, id);
    await deleteDoc(ref);
  }

  return (
    <div className="mt-8">
      <h3 className="mb-3 font-display text-lg">التعليقات</h3>

      {user ? (
        <form onSubmit={submit} className="mb-5 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="اكتب تعليق..."
            className="flex-1 rounded-full border border-border bg-surface px-4 py-2 text-sm outline-none focus:border-accent"
            maxLength={1000}
          />
          <button className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white">
            نشر
          </button>
        </form>
      ) : (
        <p className="mb-5 text-sm text-muted">
          <Link href="/login" className="text-accent">
            سجّل دخول
          </Link>{' '}
          عشان تقدر تعلّق.
        </p>
      )}

      {error && <p className="mb-3 text-sm text-accent">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted">جاري التحميل...</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted">لسه مفيش تعليقات، كن أول واحد.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="rounded-md border border-border bg-surface p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink">{c.userName}</span>
                {(user?.uid === c.userId || isAdmin) && (
                  <button onClick={() => remove(c.id)} className="text-xs text-muted hover:text-accent">
                    حذف
                  </button>
                )}
              </div>
              <p className="mt-1 text-sm text-muted">{c.text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
