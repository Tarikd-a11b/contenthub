import { describe, it, expect } from 'vitest';
import {
  genelOzet,
  kaynakOzetleri,
  turDagilimi,
  cubukYuzdesi,
  type KarneSatiri,
} from '@/lib/stats';

function satir(
  source_id: string,
  source_name: string,
  content_type: string,
  is_read = false,
  is_saved = false,
): KarneSatiri {
  return { source_id, source_name, content_type, is_read, is_saved };
}

describe('genelOzet', () => {
  it('toplam, okunan, kaydedilen ve kaynak sayisini cikarir', () => {
    const s = [
      satir('a', 'A', 'youtube', true),
      satir('a', 'A', 'youtube', false, true),
      satir('b', 'B', 'blog'),
      satir('b', 'B', 'blog'),
    ];
    expect(genelOzet(s)).toEqual({
      toplam: 4,
      okunan: 1,
      kaydedilen: 1,
      kaynakSayisi: 2,
      okumaYuzdesi: 25,
    });
  });

  it('bos listede SIFIRA BOLME yapmaz', () => {
    // NaN bir yuzde alanina sizarsa ekranda "NaN%" yazar.
    expect(genelOzet([])).toEqual({
      toplam: 0, okunan: 0, kaydedilen: 0, kaynakSayisi: 0, okumaYuzdesi: 0,
    });
  });

  it('yuzdeyi tam sayiya yuvarlar', () => {
    const s = [satir('a', 'A', 'blog', true), satir('a', 'A', 'blog'), satir('a', 'A', 'blog')];
    expect(genelOzet(s).okumaYuzdesi).toBe(33);
  });
});

describe('kaynakOzetleri', () => {
  it('kaynak basina toplam ve okunani ayri sayar', () => {
    const s = [
      satir('a', 'Veritasium', 'youtube', true),
      satir('a', 'Veritasium', 'youtube'),
      satir('a', 'Veritasium', 'youtube'),
      satir('b', 'Blog', 'blog', true),
    ];
    expect(kaynakOzetleri(s)).toEqual([
      { id: 'a', ad: 'Veritasium', tur: 'youtube', toplam: 3, okunan: 1 },
      { id: 'b', ad: 'Blog', tur: 'blog', toplam: 1, okunan: 1 },
    ]);
  });

  it('toplama gore AZALAN siralar', () => {
    const s = [satir('a', 'A', 'blog'), satir('b', 'B', 'blog'), satir('b', 'B', 'blog')];
    expect(kaynakOzetleri(s).map((k) => k.id)).toEqual(['b', 'a']);
  });

  it('esitlikte ada gore siralar - liste her yuklemede oynamasin', () => {
    const s = [satir('z', 'Zebra', 'blog'), satir('a', 'Ahmet', 'blog')];
    expect(kaynakOzetleri(s).map((k) => k.ad)).toEqual(['Ahmet', 'Zebra']);
  });

  it('hic okunmamis kaynakta okunan 0 olur, kaynak DUSMEZ', () => {
    // Bu kaynaklar karnenin asil bulgusu: akisini dolduruyor ama acilmiyor.
    const s = [satir('a', 'A', 'youtube'), satir('a', 'A', 'youtube')];
    expect(kaynakOzetleri(s)).toEqual([
      { id: 'a', ad: 'A', tur: 'youtube', toplam: 2, okunan: 0 },
    ]);
  });

  it('bos listede bos dizi doner', () => {
    expect(kaynakOzetleri([])).toEqual([]);
  });
});

describe('turDagilimi', () => {
  it('tur basina toplar ve azalan siralar', () => {
    const s = [
      satir('a', 'A', 'youtube', true),
      satir('b', 'B', 'youtube'),
      satir('c', 'C', 'blog', true),
    ];
    expect(turDagilimi(s)).toEqual([
      { tur: 'youtube', toplam: 2, okunan: 1 },
      { tur: 'blog', toplam: 1, okunan: 1 },
    ]);
  });

  it('bos listede bos dizi doner', () => {
    expect(turDagilimi([])).toEqual([]);
  });
});

describe('cubukYuzdesi', () => {
  it('en buyuge gore oranlar', () => {
    expect(cubukYuzdesi(50, 100)).toBe(50);
    expect(cubukYuzdesi(100, 100)).toBe(100);
  });

  it('en buyuk 0 iken SIFIRA BOLMEZ', () => {
    expect(cubukYuzdesi(0, 0)).toBe(0);
    expect(cubukYuzdesi(5, 0)).toBe(0);
  });

  it('0-100 araligina kirpar', () => {
    // Genislik yuzdesi asla %100'u asmamali, yoksa cubuk kabindan tasar.
    expect(cubukYuzdesi(150, 100)).toBe(100);
    expect(cubukYuzdesi(-5, 100)).toBe(0);
  });
});
