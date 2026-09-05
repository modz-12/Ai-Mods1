'use client';

import { useState } from 'react';
import { uploadFile } from '@/lib/storageUpload';
import { resolveVideoLink } from '@/lib/linkUtils';

/**
 * value: { videoType: 'embed'|'upload', videoUrl, embedUrl, thumbnail }
 * onChange(value)
 */
export default function VideoInput({ value, onChange, folder }) {
  const [mode, setMode] = useState(value?.videoType === 'embed' ? 'link' : 'upload');
  const [linkValue, setLinkValue] = useState(value?.videoType === 'embed' ? value.videoUrl : '');
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setFileName(file.name);
    setProgress(0);
    try {
      const url = await uploadFile(folder, file, setProgress);
      onChange({ videoType: 'upload', videoUrl: url, embedUrl: null, thumbnail: null });
    } catch (err) {
      setError('فشل رفع الملف');
    } finally {
      setProgress(null);
    }
  }

  function handleLinkChange(v) {
    setLinkValue(v);
    if (!v) return;
    const resolved = resolveVideoLink(v);
    if (!resolved) {
      setError('مقدرتش أتعرف على نوع الرابط ده');
      return;
    }
    setError('');
    onChange({
      videoType: 'embed',
      videoUrl: v,
      embedUrl: resolved.embedUrl,
      thumbnail: resolved.thumbnail,
    });
  }

  return (
    <div>
      <div className="mb-2 flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={`rounded-full border px-3 py-1 ${mode === 'upload' ? 'border-accent text-accent' : 'border-border text-muted'}`}
        >
          رفع ملف
        </button>
        <button
          type="button"
          onClick={() => setMode('link')}
          className={`rounded-full border px-3 py-1 ${mode === 'link' ? 'border-accent text-accent' : 'border-border text-muted'}`}
        >
          رابط (يوتيوب/فيميو/مباشر)
        </button>
      </div>

      {mode === 'upload' ? (
        <div>
          <input type="file" accept="video/*" onChange={handleFile} className="text-sm text-muted" />
          {fileName && <p className="mt-1 text-xs text-muted">{fileName}</p>}
          {progress !== null && <p className="mt-1 text-xs text-accent">جاري الرفع... {progress}%</p>}
        </div>
      ) : (
        <input
          type="url"
          placeholder="https://youtube.com/watch?v=..."
          value={linkValue}
          onChange={(e) => handleLinkChange(e.target.value)}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
      )}

      {error && <p className="mt-1 text-xs text-accent">{error}</p>}
      {value?.videoUrl && !error && <p className="mt-1 text-xs text-teal">تم تجهيز الفيديو ✓</p>}
    </div>
  );
}
