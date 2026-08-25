'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/feed', label: 'Akış' },
  { href: '/discover', label: 'Keşfet' },
  { href: '/karne', label: 'Karne' },
  { href: '/profile', label: 'Profil' },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-border">
      {/* Genişlik ve marka açılış sayfasıyla aynı: uygulamaya giren biri aynı
          yerde kaldığını hissetsin. Önceden marka hiç yoktu ve şerit 2xl'di. */}
      <div className="mx-auto flex max-w-5xl items-center gap-8 px-6 py-4">
        <Link href="/" className="font-mono text-sm tracking-tight">
          ContentHub<span className="text-accent">.</span>
        </Link>

        <div className="flex items-center gap-6 text-sm">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={
                  active
                    ? 'border-b-2 border-accent pb-1 font-medium text-foreground'
                    : 'border-b-2 border-transparent pb-1 text-muted transition-colors hover:text-foreground'
                }
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
