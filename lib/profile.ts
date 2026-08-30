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
      // Gerçek YouTube handle'ı '/' içermez. Discovery bazen bu alana çıplak bir
      // site/yol yazıyor ("preposterousuniverse.com/podcast",
      // "youtube.com/CosmologyTalks") — @handle gibi paketlemek kırık bir
      // youtube.com/@... linki üretir (canlıda bulundu, bkz. proje notları).
      if (handle.includes('/')) return null;
      return `https://www.youtube.com/@${encodeURIComponent(handle)}`;
    case 'x':
      // Aynı sınıf sorun x tipinde de mümkün (bkz. youtube dalındaki not) —
      // gerçek bir X handle'ı da '/' içermez.
      if (handle.includes('/')) return null;
      return `https://x.com/${encodeURIComponent(handle)}`;
    case 'blog':
    case 'academic':
      return `https://${raw}`;
    default:
      return null;
  }
}

// DİKKAT: `profiles` tablosu bu Supabase projesinde (tigawsmrndalzvuyjycc) BAŞKA bir
// uygulamayla (FocusAid) ORTAK. 2026-08-24'te FocusAid tarafında çalıştırılan bir
// hizalama betiği `profiles.user_id` sütununu `id` olarak yeniden adlandırdı ve bu
// sayfayı kırdı ("column profiles.user_id does not exist"). Anahtar sütun artık `id`.
// Diğer tablolar (follows, user_interests, user_content_status, source_suggestions)
// hâlâ `user_id` kullanıyor — onları buna uydurmaya ÇALIŞMA.
export async function updateProfileName(supabase: SupabaseClient, userId: string, name: string) {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, name }, { onConflict: 'id' });
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

export type SourceCategory = 'youtube' | 'blog' | 'x' | 'academic' | 'mixed';

export const CATEGORY_LABELS: Record<SourceCategory, string> = {
  youtube: 'YouTube',
  blog: 'Blog',
  x: 'X',
  academic: 'Akademik',
  mixed: 'Birden fazla platform',
};

const CATEGORY_ORDER: SourceCategory[] = ['youtube', 'blog', 'x', 'academic', 'mixed'];

export type FollowedPerson = {
  key: string;
  name: string;
  category: SourceCategory;
  platforms: FollowedSource[];
};

/**
 * Kaynak isimlerine eklenen platform belirteçlerini atar (" Blog", " - English",
 * "(Brian Greene)" gibi). Gerçek veride aynı kişi bu yüzden bambaşka string'lerle
 * kayıtlı: "Barış Özcan" (youtube) / "Barış Özcan Blog" (blog), "Yanis Varoufakis
 * Blog" (blog) / "Yanis Varoufakis - English" (x). Kaba isim eşleşmesi (sadece
 * trim+lowercase) bu ikisini birleştiremiyordu — bu yüzden ek adım gerekti.
 */
function stripSourceNameSuffix(name: string): string {
  const stripped = name
    .replace(/\s+-\s+.+$/, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/\s+(blog|blogu|kanalı|kanali|kanal|podcast|dergisi|sayfası|on x)$/i, '')
    .trim();
  return stripped || name.trim();
}

/**
 * Aynı kişiye ait kaynakları (ör. bir kişinin hem YouTube hem blog kaydı) tek
 * karta indirger. İsim eşleşmesi kaba bir sezgi ama bu tabloda kişi/kaynak
 * ayrımını tutan başka bir alan yok (bkz. proje notları — şema değişikliği
 * gerektirmeden çözüm).
 */
export function groupFollowedSources(sources: FollowedSource[]): FollowedPerson[] {
  const byName = new Map<string, FollowedSource[]>();
  for (const source of sources) {
    const key = stripSourceNameSuffix(source.name).toLowerCase();
    const group = byName.get(key);
    if (group) {
      group.push(source);
    } else {
      byName.set(key, [source]);
    }
  }

  const people = Array.from(byName.entries()).map(([key, platforms]): FollowedPerson => {
    const types = new Set(platforms.map((p) => p.type));
    const category = (types.size === 1 ? platforms[0].type : 'mixed') as SourceCategory;
    return { key, name: stripSourceNameSuffix(platforms[0].name), category, platforms };
  });

  return people.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
}

export type FollowedCategoryGroup = { category: SourceCategory; label: string; people: FollowedPerson[] };

export function groupPeopleByCategory(people: FollowedPerson[]): FollowedCategoryGroup[] {
  return CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    people: people.filter((p) => p.category === category),
  })).filter((group) => group.people.length > 0);
}
