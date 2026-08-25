/* ══════════════════════════════════════════════════════════════
   Okuma karnesi — saf hesap katmanı.
   DOM YOK, ağ YOK. Buraya yalnızca test edilebilir saf fonksiyon girer.
   ══════════════════════════════════════════════════════════════ */

/** Karne için gereken en küçük satır. Feed'in FeedItem'ından bilinçli olarak
 *  ayrı: karne kaynak kırılımı istiyor (source_id), akış istemiyordu. */
export type KarneSatiri = {
  source_id: string;
  source_name: string;
  content_type: string;
  is_read: boolean;
  is_saved: boolean;
};

export type KaynakOzeti = {
  id: string;
  ad: string;
  tur: string;
  toplam: number;
  okunan: number;
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
 * Kaynak başına "akışını ne kadar dolduruyor" ve "ne kadarını açtın".
 *
 * Bu ikisinin AYRILMASI karnenin bütün fikri: en çok içerik üreten kaynak ile
 * en çok okuduğun kaynak aynı olmak zorunda değil, ve ayrıldıklarında bu
 * takip listeni gözden geçirmen gerektiğini söyler.
 *
 * Sıralama toplama göre azalan; eşitlikte ada göre alfabetik, çünkü sırf
 * nesne anahtarlarının sırasına bağlı bir liste her yüklemede farklı
 * dizilebilir ve kullanıcı listenin "oynadığını" görür.
 */
export function kaynakOzetleri(satirlar: KarneSatiri[]): KaynakOzeti[] {
  const harita = new Map<string, KaynakOzeti>();
  for (const s of satirlar) {
    let k = harita.get(s.source_id);
    if (!k) {
      k = { id: s.source_id, ad: s.source_name, tur: s.content_type, toplam: 0, okunan: 0 };
      harita.set(s.source_id, k);
    }
    k.toplam += 1;
    if (s.is_read) k.okunan += 1;
  }
  // Array.from: projenin derleme hedefi Map iteratorunu yaymaya izin vermiyor.
  return Array.from(harita.values()).sort((a, b) => b.toplam - a.toplam || a.ad.localeCompare(b.ad, 'tr'));
}

/** Tür kırılımı. Aynı sıralama kuralı: toplama göre azalan, sonra tür adına göre. */
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
 * Bir değerin en büyüğe göre yüzdesi — çubuk genişlikleri için.
 * En büyük 0 ise 0 döner (sıfıra bölme yok). Sonuç 0–100 arası kırpılır.
 */
export function cubukYuzdesi(deger: number, enBuyuk: number): number {
  if (enBuyuk <= 0) return 0;
  return Math.max(0, Math.min(100, (deger / enBuyuk) * 100));
}
