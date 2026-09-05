'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('كلمة السر لازم تكون ٦ حروف على الأقل');
      return;
    }
    setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      await setDoc(doc(db, 'users', cred.user.uid), {
        email,
        displayName: name,
        role: 'user',
        createdAt: serverTimestamp(),
      });
      router.push('/');
    } catch (err) {
      setError(err.code === 'auth/email-already-in-use' ? 'البريد ده مستخدم قبل كده' : 'حصل خطأ، حاول تاني');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm py-10">
      <h1 className="mb-6 font-display text-2xl">حساب جديد</h1>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          required
          placeholder="الاسم"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-md border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent"
        />
        <input
          type="email"
          required
          placeholder="البريد الإلكتروني"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent"
        />
        <input
          type="password"
          required
          placeholder="كلمة السر"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent"
        />
        {error && <p className="text-sm text-accent">{error}</p>}
        <button
          disabled={busy}
          className="mt-2 rounded-full bg-accent py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? 'جاري الإنشاء...' : 'إنشاء الحساب'}
        </button>
      </form>
      <p className="mt-4 text-sm text-muted">
        عندك حساب؟{' '}
        <Link href="/login" className="text-accent">
          سجّل دخول
        </Link>
      </p>
    </div>
  );
}
