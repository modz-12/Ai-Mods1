'use client';

import Link from 'next/link';
import RequireAdmin from '@/components/RequireAdmin';

const sections = [
  { href: '/admin/titles', label: 'المسلسلات', desc: 'إضافة وتعديل المسلسلات والحلقات' },
  { href: '/admin/reels', label: 'الريلز', desc: 'إضافة وتعديل الريلز' },
  { href: '/admin/albums', label: 'الألبومات', desc: 'إضافة وتعديل ألبومات الصور' },
];

function Dashboard() {
  return (
    <div>
      <h1 className="mb-6 font-display text-2xl">لوحة التحكم</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-md border border-border bg-surface p-5 transition hover:border-accent"
          >
            <h2 className="font-display text-lg">{s.label}</h2>
            <p className="mt-1 text-sm text-muted">{s.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <RequireAdmin>
      <Dashboard />
    </RequireAdmin>
  );
}
