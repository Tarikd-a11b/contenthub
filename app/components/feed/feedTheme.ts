/**
 * Akış redesign'ının vurgu paleti. Bilerek uygulamanın geri kalanındaki
 * `source-*` tailwind token'larından (tailwind.config.ts) AYRI tutuluyor —
 * o token'lar profil/keşfet/karne'de hâlâ kullanılıyor, bu daha canlı palet
 * yalnızca akış kartlarının yeni görsel dili için.
 */
export const CATEGORY_ACCENT: Record<string, { badge: string; hoverBorder: string; label: string }> = {
  youtube: { badge: '#FF4D4D', hoverBorder: 'rgba(255, 77, 77, 0.3)', label: 'Video' },
  blog: { badge: '#F59E0B', hoverBorder: 'rgba(245, 158, 11, 0.3)', label: 'Blog' },
  academic: { badge: '#10B981', hoverBorder: 'rgba(16, 185, 129, 0.3)', label: 'Akademik' },
  x: { badge: '#B4B4C4', hoverBorder: 'rgba(180, 180, 196, 0.3)', label: 'X' },
};

export function categoryAccent(type: string) {
  return CATEGORY_ACCENT[type] ?? { badge: '#84848E', hoverBorder: 'rgba(132, 132, 142, 0.3)', label: type };
}
