'use client';

import { useState } from 'react';
import Image from 'next/image';
import { uploadFile } from '@/lib/storageUpload';

export default function ImageInput({ value, onChange, folder }) {
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setProgress(0);
    try {
      const url = await uploadFile(folder, file, setProgress);
      onChange(url);
    } catch {
      setError('فشل رفع الصورة');
    } finally {
      setProgress(null);
    }
  }

  return (
    <div>
      <input type="file" accept="image/*" onChange={handleFile} className="text-sm text-muted" />
      {progress !== null && <p className="mt-1 text-xs text-accent">جاري الرفع... {progress}%</p>}
      {error && <p className="mt-1 text-xs text-accent">{error}</p>}
      {value && (
        <div className="relative mt-2 h-24 w-24 overflow-hidden rounded-md border border-border">
          <Image src={value} alt="" fill className="object-cover" />
        </div>
      )}
    </div>
  );
}
