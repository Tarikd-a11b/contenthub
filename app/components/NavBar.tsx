'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/feed', label: 'Akış' },
  { href: '/discover', label: 'Keşfet' },
  { href: '/profile', label: 'Profil' },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-border">
      <div className="mx-auto flex max-w-2xl items-center gap-6 px-4 py-4 text-sm">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
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
    </nav>
  );
}
