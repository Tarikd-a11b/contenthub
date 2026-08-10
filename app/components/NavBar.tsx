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
    <nav className="mx-auto flex max-w-2xl items-center gap-4 border-b p-4 text-sm">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={pathname === link.href ? 'font-semibold' : 'text-gray-500'}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
