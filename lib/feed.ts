import type { SupabaseClient } from '@supabase/supabase-js';

export type FeedItem = {
  id: string;
  title: string;
  url: string;
  published_at: string;
  content_type: string;
  source_name: string;
  is_read: boolean;
};

export function sortFeedByRecency(items: FeedItem[]): FeedItem[] {
  return [...items].sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
}

export const FEED_PAGE_SIZE = 20;

export function feedPageCount(total: number, size: number = FEED_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / size));
}

export function feedPage<T>(items: T[], page: number, size: number = FEED_PAGE_SIZE): T[] {
  const last = feedPageCount(items.length, size);
  const safe = Math.min(Math.max(1, Math.trunc(page) || 1), last);
  return items.slice((safe - 1) * size, safe * size);
}

const AY_ADLARI = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

export type FeedDayGroup = { key: string; label: string; items: FeedItem[] };

/** Yerel takvim gününe göre anahtar — gruplama kullanıcının gördüğü tarihe göre olmalı, UTC'ye göre değil. */
function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(d: Date, now: Date): string {
  const key = localDayKey(d);
  if (key === localDayKey(now)) return 'Bugün';
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (key === localDayKey(yesterday)) return 'Dün';
  const base = `${d.getDate()} ${AY_ADLARI[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/**
 * Girdi sırasını koruyarak içerikleri yayın gününe göre gruplar; çağırmadan önce
 * sortFeedByRecency uygulanmış olmalı. Geçersiz published_at değerleri atılmaz,
 * sonda "Tarihsiz" grubunda toplanır.
 */
export function groupFeedByDay(items: FeedItem[], now: Date = new Date()): FeedDayGroup[] {
  const groups = new Map<string, FeedDayGroup>();
  const undated: FeedItem[] = [];

  for (const item of items) {
    const d = new Date(item.published_at);
    if (isNaN(d.getTime())) {
      undated.push(item);
      continue;
    }
    const key = localDayKey(d);
    let group = groups.get(key);
    if (!group) {
      group = { key, label: dayLabel(d, now), items: [] };
      groups.set(key, group);
    }
    group.items.push(item);
  }

  // Array.from, spread değil: tsconfig hedefi Map iterator'ünü spread etmeye izin vermiyor.
  const result = Array.from(groups.values());
  if (undated.length > 0) result.push({ key: 'undated', label: 'Tarihsiz', items: undated });
  return result;
}

export type FeedThumbnail = { src: string; fallback: string | null };

/**
 * İçerik URL'sinden YouTube kapak görseli üretir; YouTube değilse null.
 *
 * Shorts için mqdefault.jpg gri kenarlıkları görselin İÇİNE gömülü döndürüyor
 * (object-fit bunu düzeltmiyor), o yüzden orijinal en-boy oranlı oardefault.jpg
 * kullanılıp 16:9'a kırpılıyor. oardefault normal videolarda 404 verdiği için
 * tür URL'den ayırt ediliyor — kör deneme her normal video başına bir 404 demek.
 */
export function youtubeThumbnail(url: string): FeedThumbnail | null {
  const shorts = url.match(/youtube\.com\/shorts\/([\w-]{11})/);
  if (shorts) {
    return {
      src: `https://i.ytimg.com/vi/${shorts[1]}/oardefault.jpg`,
      fallback: `https://i.ytimg.com/vi/${shorts[1]}/mqdefault.jpg`,
    };
  }
  const watch = url.match(/[?&]v=([\w-]{11})/);
  if (watch) {
    return { src: `https://i.ytimg.com/vi/${watch[1]}/mqdefault.jpg`, fallback: null };
  }
  return null;
}

export async function markAsRead(supabase: SupabaseClient, userId: string, contentItemId: string) {
  const { error } = await supabase
    .from('user_content_status')
    .upsert(
      { user_id: userId, content_item_id: contentItemId, read_at: new Date().toISOString() },
      { onConflict: 'user_id,content_item_id' }
    );
  if (error) throw error;
}
