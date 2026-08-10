import type { SupabaseClient } from '@supabase/supabase-js';

export type FollowedSource = {
  id: string;
  name: string;
  type: string;
  url_or_handle: string;
};

/**
 * Kaynağın kendi sayfasının adresini üretir; adres kurulamıyorsa null.
 *
 * `url_or_handle` tek biçimde saklanmıyor — türe ve kaydı kimin oluşturduğuna göre
 * dört ayrı biçim geliyor: tam URL (`https://29mayis.academia.edu/esg`), @'li handle
 * (`@veritasium`), çıplak handle (`kirkdokuzW`) ve protokolsüz alan adı
 * (`yanisvaroufakis.eu`). Discovery ayrıca kırpılmış değer yazabiliyor (`UCmZUV...`);
 * öylesine bir kaynağı linklemek kullanıcıyı 404'e yollar, o yüzden null dönüyoruz.
 */
export function sourceProfileUrl(type: string, urlOrHandle: string): string | null {
  const raw = urlOrHandle.trim();
  if (!raw || raw.includes('...')) return null;
  if (/^https?:\/\//i.test(raw)) return raw;

  const handle = raw.replace(/^@/, '');
  if (!handle) return null;

  switch (type) {
    case 'youtube':
      if (/^UC[\w-]{22}$/.test(handle)) return `https://www.youtube.com/channel/${handle}`;
      // UC ile başlayıp geçerli uzunlukta olmayan değer bozuk bir channel id demek.
      if (/^UC/.test(handle)) return null;
      return `https://www.youtube.com/@${encodeURIComponent(handle)}`;
    case 'x':
      return `https://x.com/${encodeURIComponent(handle)}`;
    case 'blog':
    case 'academic':
      return `https://${raw}`;
    default:
      return null;
  }
}

export async function updateProfileName(supabase: SupabaseClient, userId: string, name: string) {
  const { error } = await supabase
    .from('profiles')
    .upsert({ user_id: userId, name }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function unfollowSource(supabase: SupabaseClient, userId: string, sourceId: string) {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('user_id', userId)
    .eq('source_id', sourceId);
  if (error) throw error;
}
