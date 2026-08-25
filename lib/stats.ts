/* ══════════════════════════════════════════════════════════════
   Okuma karnesi — saf hesap katmanı.
   DOM YOK, ağ YOK. Buraya yalnızca test edilebilir saf fonksiyon girer.
   ══════════════════════════════════════════════════════════════ */

/** Karne için gereken en küçük satır. Feed'in FeedItem'ından bilinçli olarak
 *  ayrı: karne kaynak kırılımı ve yayın tarihi istiyor, akış istemiyordu. */
export type KarneSatiri = {
  source_id: string;
  source_name: string;
  content_type: string;
  is_read: boolean;
  is_saved: boolean;
  published_at: string | null;
};

export type KaynakOzeti = {
  id: string;
  ad: string;
  tur: string;
  toplam: number;
  okunan: number;
  /** Kaynağın en yeni içeriğinin günü, 'YYYY-MM-DD'. Hiç geçerli tarih yoksa null. */
  sonYayin: string | null;
  /** Bugünle son yayın arasındaki tam gün. Tarih yoksa null. */
  gunOnce: number | null;
  /** 0–100 arası tam sayı. */
  okumaOrani: number;
};

export type TurOzeti = { tur: string; toplam: number; okunan: number };

export type GenelOzet = {
  toplam: number;
  okunan: number;
  kaydedilen: number;
  kaynakSayisi: number;
  /** 0–100 arası tam sayı. Toplam 0 ise 0 — payda sıfırken NaN yayılmasın. */
  okumaYuzdesi: number;
};

export type HaftaKutusu = {
  /** Haftanın Pazartesi günü, 'YYYY-MM-DD'. */
  baslangic: string;
  /** Eksende görünen kısa etiket, örn. '18 Ağu'. */
  etiket: string;
  toplam: number;
  okunan: number;
};

/** Bu kadar gündür yayın yapmayan kaynak "sessiz" sayılıyor. Bir ayı geçmiş
 *  bir sessizlik, çoğu blog/kanal için artık düzenli olmadığının işareti. */
export const SESSIZ_GUN = 30;

const AY_KISA = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

/** Date → 'YYYY-MM-DD' YEREL saatle. toISOString() UTC verir ve UTC+3'te günü
 *  bir geri kaydırır — bu projede daha önce yaşandı, tekrar etmesin. */
function iso(d: Date): string {
  const y = d.getFullYear();
  const a = String(d.getMonth() + 1).padStart(2, '0');
  const g = String(d.getDate()).padStart(2, '0');
  return `${y}-${a}-${g}`;
}

/** Yerel gece yarısına indirger — gün farkı hesabı saat farkından etkilenmesin. */
function gunBasi(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Verilen günü içeren haftanın PAZARTESİ'si. Türkiye'de hafta Pazartesi başlar. */
function haftaBasi(d: Date): Date {
  const g = gunBasi(d);
  // getDay() 0=Pazar; +6 %7 ile 0=Pazartesi'ye kaydırılıyor.
  g.setDate(g.getDate() - ((g.getDay() + 6) % 7));
  return g;
}

function gunFarki(a: Date, b: Date): number {
  return Math.round((gunBasi(a).getTime() - gunBasi(b).getTime()) / 86400000);
}

export function genelOzet(satirlar: KarneSatiri[]): GenelOzet {
  const toplam = satirlar.length;
  const okunan = satirlar.filter((s) => s.is_read).length;
  return {
    toplam,
    okunan,
    kaydedilen: satirlar.filter((s) => s.is_saved).length,
    kaynakSayisi: new Set(satirlar.map((s) => s.source_id)).size,
    okumaYuzdesi: toplam === 0 ? 0 : Math.round((okunan / toplam) * 100),
  };
}

/**
 * Kaynak başına özet: kaç içerik, kaçını açtın, en son ne zaman yayın yaptı.
 *
 * `toplam` bilinçli olarak İKİNCİL bir ölçü: her besleme çekilişte ~15 içerik
 * döndürdüğü için kaynak adetleri birbirine çok yakın çıkıyor (33/24/20/18…) ve
 * "kim akışını dolduruyor" sorusuna sanıldığı kadar iyi cevap vermiyor. Asıl
 * ayırt edici olan `gunOnce` — yıllardır sessiz bir kaynak akışta yer işgal
 * ediyor ve kullanıcının bunu görmesi gerek.
 */
export function kaynakOzetleri(satirlar: KarneSatiri[], now: Date = new Date()): KaynakOzeti[] {
  type Ara = KaynakOzeti & { _enYeni: number | null };
  const harita = new Map<string, Ara>();

  for (const s of satirlar) {
    let k = harita.get(s.source_id);
    if (!k) {
      k = {
        id: s.source_id, ad: s.source_name, tur: s.content_type,
        toplam: 0, okunan: 0, sonYayin: null, gunOnce: null, okumaOrani: 0, _enYeni: null,
      };
      harita.set(s.source_id, k);
    }
    k.toplam += 1;
    if (s.is_read) k.okunan += 1;

    const t = s.published_at ? Date.parse(s.published_at) : NaN;
    // Geçersiz tarih SESSİZCE atlanıyor: bir satırın bozuk tarihi yüzünden
    // kaynağın tamamını "tarihsiz" saymak yanlış olurdu.
    if (Number.isFinite(t) && (k._enYeni === null || t > k._enYeni)) k._enYeni = t;
  }

  return Array.from(harita.values())
    .map(({ _enYeni, ...k }) => ({
      ...k,
      sonYayin: _enYeni === null ? null : iso(new Date(_enYeni)),
      gunOnce: _enYeni === null ? null : gunFarki(now, new Date(_enYeni)),
      okumaOrani: k.toplam === 0 ? 0 : Math.round((k.okunan / k.toplam) * 100),
    }))
    .sort((a, b) => b.toplam - a.toplam || a.ad.localeCompare(b.ad, 'tr'));
}

/**
 * Sessiz kaynaklar: eşikten uzun süredir yayın yapmayanlar, EN ESKİDEN yeniye.
 * Tarihi hiç olmayan kaynaklar da sessiz sayılır (en sona konur) — içeriği var
 * ama ne zaman geldiği bilinmiyorsa bu da gözden geçirmeyi hak eder.
 */
export function sessizKaynaklar(ozetler: KaynakOzeti[], esik: number = SESSIZ_GUN): KaynakOzeti[] {
  return ozetler
    .filter((k) => k.gunOnce === null || k.gunOnce >= esik)
    .sort((a, b) => (b.gunOnce ?? Infinity) - (a.gunOnce ?? Infinity));
}

/**
 * Son N haftanın içerik akışı, en eskiden yeniye.
 *
 * Boş haftalar ATLANMAZ, sıfır değeriyle döner: eksende delik bırakmak grafiği
 * yalancı yapar — sessiz bir hafta ile hiç olmayan bir hafta aynı görünürdü.
 */
export function haftalikAkis(
  satirlar: KarneSatiri[],
  now: Date = new Date(),
  haftaSayisi = 12,
): HaftaKutusu[] {
  const kutular: HaftaKutusu[] = [];
  const buHafta = haftaBasi(now);

  for (let i = haftaSayisi - 1; i >= 0; i--) {
    const b = new Date(buHafta.getFullYear(), buHafta.getMonth(), buHafta.getDate() - i * 7);
    kutular.push({
      baslangic: iso(b),
      etiket: `${b.getDate()} ${AY_KISA[b.getMonth()]}`,
      toplam: 0,
      okunan: 0,
    });
  }

  const indeks = new Map(kutular.map((k, i) => [k.baslangic, i]));
  for (const s of satirlar) {
    if (!s.published_at) continue;
    const t = Date.parse(s.published_at);
    if (!Number.isFinite(t)) continue;
    const i = indeks.get(iso(haftaBasi(new Date(t))));
    if (i === undefined) continue; // pencere dışında (daha eski ya da gelecek tarihli)
    kutular[i].toplam += 1;
    if (s.is_read) kutular[i].okunan += 1;
  }

  return kutular;
}

/** Tür kırılımı. Toplama göre azalan, eşitlikte tür adına göre. */
export function turDagilimi(satirlar: KarneSatiri[]): TurOzeti[] {
  const harita = new Map<string, TurOzeti>();
  for (const s of satirlar) {
    let t = harita.get(s.content_type);
    if (!t) {
      t = { tur: s.content_type, toplam: 0, okunan: 0 };
      harita.set(s.content_type, t);
    }
    t.toplam += 1;
    if (s.is_read) t.okunan += 1;
  }
  return Array.from(harita.values()).sort((a, b) => b.toplam - a.toplam || a.tur.localeCompare(b.tur));
}

/**
 * Bir değerin en büyüğe göre yüzdesi — çubuk boyları için.
 * En büyük 0 ise 0 döner (sıfıra bölme yok). Sonuç 0–100 arası kırpılır.
 */
export function cubukYuzdesi(deger: number, enBuyuk: number): number {
  if (enBuyuk <= 0) return 0;
  return Math.max(0, Math.min(100, (deger / enBuyuk) * 100));
}

/** '2756 gün' okunaksız; insan ölçeğine çevirir. */
export function sureMetni(gun: number | null): string {
  if (gun === null) return 'tarih yok';
  if (gun <= 0) return 'bugün';
  if (gun === 1) return 'dün';
  if (gun < 30) return `${gun} gün önce`;
  if (gun < 365) return `${Math.round(gun / 30)} ay önce`;
  const yil = gun / 365;
  return `${yil < 10 ? yil.toFixed(1) : Math.round(yil)} yıl önce`;
}
