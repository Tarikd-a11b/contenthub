import { describe, it, expect } from 'vitest';
import {
  genelOzet,
  kaynakOzetleri,
  sessizKaynaklar,
  haftalikAkis,
  turDagilimi,
  cubukYuzdesi,
  sureMetni,
  SESSIZ_GUN,
  type KarneSatiri,
} from '@/lib/stats';

/** Yerel öğlen — gün sınırına ±12 saatlik hiçbir zaman diliminde taşmaz. */
function ogle(y: number, ay: number, g: number): string {
  return new Date(y, ay, g, 12, 0, 0).toISOString();
}

function satir(
  source_id: string,
  source_name: string,
  content_type: string,
  opts: { okundu?: boolean; kayitli?: boolean; tarih?: string | null } = {},
): KarneSatiri {
  return {
    source_id,
    source_name,
    content_type,
    is_read: opts.okundu ?? false,
    is_saved: opts.kayitli ?? false,
    published_at: opts.tarih === undefined ? ogle(2026, 7, 24) : opts.tarih,
  };
}

const SIMDI = new Date(2026, 7, 25, 12, 0, 0); // 25 Ağustos 2026, Salı

describe('genelOzet', () => {
  it('toplam, okunan, kaydedilen ve kaynak sayisini cikarir', () => {
    const s = [
      satir('a', 'A', 'youtube', { okundu: true }),
      satir('a', 'A', 'youtube', { kayitli: true }),
      satir('b', 'B', 'blog'),
      satir('b', 'B', 'blog'),
    ];
    expect(genelOzet(s)).toEqual({
      toplam: 4, okunan: 1, kaydedilen: 1, kaynakSayisi: 2, okumaYuzdesi: 25,
    });
  });

  it('bos listede SIFIRA BOLME yapmaz', () => {
    expect(genelOzet([])).toEqual({
      toplam: 0, okunan: 0, kaydedilen: 0, kaynakSayisi: 0, okumaYuzdesi: 0,
    });
  });
});

describe('kaynakOzetleri', () => {
  it('toplam, okunan, okuma orani ve son yayini cikarir', () => {
    const s = [
      satir('a', 'Veritasium', 'youtube', { okundu: true, tarih: ogle(2026, 7, 20) }),
      satir('a', 'Veritasium', 'youtube', { tarih: ogle(2026, 7, 24) }),
      satir('a', 'Veritasium', 'youtube', { tarih: ogle(2026, 7, 10) }),
    ];
    const [k] = kaynakOzetleri(s, SIMDI);
    expect(k.toplam).toBe(3);
    expect(k.okunan).toBe(1);
    expect(k.okumaOrani).toBe(33);
    expect(k.sonYayin).toBe('2026-08-24');  // EN YENI tarih alinmali
    expect(k.gunOnce).toBe(1);
  });

  it('bozuk tarihli satiri ATLAR, kaynagi tarihsiz saymaz', () => {
    const s = [
      satir('a', 'A', 'blog', { tarih: 'bu bir tarih degil' }),
      satir('a', 'A', 'blog', { tarih: ogle(2026, 7, 24) }),
    ];
    expect(kaynakOzetleri(s, SIMDI)[0].sonYayin).toBe('2026-08-24');
  });

  it('hic gecerli tarih yoksa sonYayin ve gunOnce null olur', () => {
    const k = kaynakOzetleri([satir('a', 'A', 'blog', { tarih: null })], SIMDI)[0];
    expect(k.sonYayin).toBeNull();
    expect(k.gunOnce).toBeNull();
  });

  it('toplama gore azalan, esitlikte ada gore siralar', () => {
    const s = [
      satir('z', 'Zebra', 'blog'),
      satir('a', 'Ahmet', 'blog'),
      satir('c', 'Cem', 'blog'), satir('c', 'Cem', 'blog'),
    ];
    expect(kaynakOzetleri(s, SIMDI).map((k) => k.ad)).toEqual(['Cem', 'Ahmet', 'Zebra']);
  });
});

describe('sessizKaynaklar', () => {
  const olustur = (ad: string, gunOnce: number | null) => ({
    id: ad, ad, tur: 'blog', toplam: 1, okunan: 0, sonYayin: null, gunOnce, okumaOrani: 0,
  });

  it('esigin altindakileri eler', () => {
    const liste = [olustur('taze', 2), olustur('sinirda', SESSIZ_GUN), olustur('eski', 400)];
    expect(sessizKaynaklar(liste).map((k) => k.ad)).toEqual(['eski', 'sinirda']);
  });

  it('EN ESKIDEN yeniye siralar - en cok dikkat isteyen ustte', () => {
    const liste = [olustur('a', 40), olustur('b', 2756), olustur('c', 90)];
    expect(sessizKaynaklar(liste).map((k) => k.ad)).toEqual(['b', 'c', 'a']);
  });

  it('tarihi olmayan kaynak da sessiz sayilir ve EN USTE gelir', () => {
    const liste = [olustur('tarihsiz', null), olustur('eski', 100)];
    expect(sessizKaynaklar(liste).map((k) => k.ad)).toEqual(['tarihsiz', 'eski']);
  });

  it('hepsi tazeyse bos dizi doner', () => {
    expect(sessizKaynaklar([olustur('a', 1), olustur('b', 5)])).toEqual([]);
  });
});

describe('haftalikAkis', () => {
  it('istenen sayida kutu dondurur, BOS haftalari atlamaz', () => {
    // Delik birakmak grafigi yalanci yapar: sessiz hafta ile olmayan hafta
    // ayni gorunurdu.
    const k = haftalikAkis([], SIMDI, 12);
    expect(k).toHaveLength(12);
    expect(k.every((x) => x.toplam === 0)).toBe(true);
  });

  it('kutular PAZARTESI baslar ve eskiden yeniye siralanir', () => {
    const k = haftalikAkis([], SIMDI, 3);
    // 25 Agustos 2026 Sali -> haftasi 24 Agustos Pazartesi
    expect(k.map((x) => x.baslangic)).toEqual(['2026-08-10', '2026-08-17', '2026-08-24']);
  });

  it('icerigi dogru haftaya koyar ve okunani ayri sayar', () => {
    const s = [
      satir('a', 'A', 'blog', { tarih: ogle(2026, 7, 24), okundu: true }), // bu hafta
      satir('a', 'A', 'blog', { tarih: ogle(2026, 7, 25) }),               // bu hafta
      satir('a', 'A', 'blog', { tarih: ogle(2026, 7, 18) }),               // gecen hafta
    ];
    const k = haftalikAkis(s, SIMDI, 3);
    expect(k[2]).toMatchObject({ baslangic: '2026-08-24', toplam: 2, okunan: 1 });
    expect(k[1]).toMatchObject({ baslangic: '2026-08-17', toplam: 1, okunan: 0 });
    expect(k[0].toplam).toBe(0);
  });

  it('pencere disindaki ve tarihsiz icerigi sessizce atlar', () => {
    const s = [
      satir('a', 'A', 'blog', { tarih: ogle(2019, 1, 7) }),  // cok eski
      satir('a', 'A', 'blog', { tarih: null }),
      satir('a', 'A', 'blog', { tarih: 'bozuk' }),
    ];
    const k = haftalikAkis(s, SIMDI, 4);
    expect(k.reduce((t, x) => t + x.toplam, 0)).toBe(0);
  });

  it('yil sinirini asan pencerede kutu uretir', () => {
    const k = haftalikAkis([], new Date(2027, 0, 5, 12), 4);
    expect(k[0].baslangic).toBe('2026-12-14');
    expect(k[3].baslangic).toBe('2027-01-04');
  });
});

describe('sureMetni', () => {
  it('insan olcegine cevirir', () => {
    expect(sureMetni(0)).toBe('bugün');
    expect(sureMetni(1)).toBe('dün');
    expect(sureMetni(14)).toBe('14 gün önce');
    expect(sureMetni(34)).toBe('1 ay önce');
    expect(sureMetni(2756)).toBe('7.6 yıl önce');  // gercek veri: Oguz Ergin (2756/365 = 7,55)
    expect(sureMetni(null)).toBe('tarih yok');
  });
});

describe('turDagilimi', () => {
  it('tur basina toplar ve azalan siralar', () => {
    const s = [
      satir('a', 'A', 'youtube', { okundu: true }),
      satir('b', 'B', 'youtube'),
      satir('c', 'C', 'blog', { okundu: true }),
    ];
    expect(turDagilimi(s)).toEqual([
      { tur: 'youtube', toplam: 2, okunan: 1 },
      { tur: 'blog', toplam: 1, okunan: 1 },
    ]);
  });
});

describe('cubukYuzdesi', () => {
  it('en buyuge gore oranlar ve 0-100 araligina kirpar', () => {
    expect(cubukYuzdesi(50, 100)).toBe(50);
    expect(cubukYuzdesi(150, 100)).toBe(100);
    expect(cubukYuzdesi(-5, 100)).toBe(0);
  });

  it('en buyuk 0 iken SIFIRA BOLMEZ', () => {
    expect(cubukYuzdesi(5, 0)).toBe(0);
  });
});
