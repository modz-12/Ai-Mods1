'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || 'أنمي هب';

export default function Navbar() {
  const { user, isAdmin, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const links = [
    { href: '/titles', label: 'مسلسلات' },
    { href: '/reels', label: 'ريلز' },
    { href: '/albums', label: 'ألبومات' },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-display text-xl text-ink">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" />
          {SITE_NAME}
        </Link>

        <nav className="hidden gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-full px-3 py-1.5 text-sm text-muted transition hover:text-ink"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="mr-auto flex items-center gap-2">
          {user ? (
            <>
              <Link href="/favorites" className="hidden text-sm text-muted hover:text-ink sm:inline">
                المفضلة
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="hidden rounded-full bg-surface2 px-3 py-1.5 text-sm text-ink sm:inline"
                >
                  لوحة التحكم
                </Link>
              )}
              <button
                onClick={logout}
                className="rounded-full border border-border px-3 py-1.5 text-sm text-muted hover:text-ink"
              >
                خروج
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm text-muted hover:text-ink">
                دخول
              </Link>
              <Link href="/signup" className="rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-white">
                حساب جديد
              </Link>
            </>
          )}

          <button className="ml-1 text-ink md:hidden" onClick={() => setOpen((v) => !v)} aria-label="القائمة">
            ☰
          </button>
        </div>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-border px-4 py-2 md:hidden">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-md px-2 py-2 text-sm text-muted hover:text-ink">
              {l.label}
            </Link>
          ))}
          <Link href="/favorites" className="rounded-md px-2 py-2 text-sm text-muted hover:text-ink">
            المفضلة
          </Link>
        </nav>
      )}
    </header>
  );
}
