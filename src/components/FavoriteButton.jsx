'use client';

import { useEffect, useState } from 'react';
import { doc, setDoc, deleteDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function FavoriteButton({ type, refId, title, cover }) {
  const { user } = useAuth();
  const router = useRouter();
  const [isFav, setIsFav] = useState(false);
  const [busy, setBusy] = useState(false);

  const favId = `${type}_${refId}`;

  useEffect(() => {
    if (!user) {
      setIsFav(false);
      return;
    }
    const ref = doc(db, 'favorites', user.uid, 'items', favId);
    const unsub = onSnapshot(ref, (snap) => setIsFav(snap.exists()));
    return unsub;
  }, [user, favId]);

  async function toggle() {
    if (!user) {
      router.push('/login');
      return;
    }
    setBusy(true);
    const ref = doc(db, 'favorites', user.uid, 'items', favId);
    try {
      if (isFav) {
        await deleteDoc(ref);
      } else {
        await setDoc(ref, { type, refId, title: title || '', cover: cover || '', addedAt: serverTimestamp() });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
        isFav ? 'border-accent bg-accent/10 text-accent' : 'border-border text-muted hover:text-ink'
      }`}
    >
      <span>{isFav ? '★' : '☆'}</span>
      {isFav ? 'في المفضلة' : 'أضف للمفضلة'}
    </button>
  );
}
