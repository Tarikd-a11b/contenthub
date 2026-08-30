import { describe, it, expect, vi } from 'vitest';
import {
  sortFeedByRecency,
  markAsRead,
  markManyAsRead,
  groupFeedByDay,
  youtubeThumbnail,
  feedPage,
  feedPageCount,
  decodeEntities,
  cleanSummary,
  estimateReadingMinutes,
  filterFeed,
  typeCounts,
  FILTRE_YOK,
  toggleSaved,
  type FeedItem,
} from '@/lib/feed';

/** Yerel öğlen — gün sınırına ±12 saatlik hiçbir zaman diliminde taşmaz, test makineden bağımsız kalır. */
function localNoon(y: number, m: number, d: number): string {
  return new Date(y, m, d, 12, 0, 0).toISOString();
}

function item(id: string, published_at: string, url = 'https://example.com/' + id): FeedItem {
  return { id, title: 'T' + id, url, published_at, content_type: 'youtube', source_name: 'S', is_read: false, summary: null, is_saved: false };
}

describe('sortFeedByRecency', () => {
  it('orders items newest first', () => {
    const items: FeedItem[] = [
      { id: '1', title: 'Old', url: 'https://a', published_at: '2026-01-01T00:00:00Z', content_type: 'blog', source_name: 'A', is_read: false, summary: null, is_saved: false },
      { id: '2', title: 'New', url: 'https://b', published_at: '2026-08-01T00:00:00Z', content_type: 'blog', source_name: 'B', is_read: false, summary: null, is_saved: false },
    ];
    expect(sortFeedByRecency(items).map((i) => i.id)).toEqual(['2', '1']);
  });
});

describe('groupFeedByDay', () => {
  const now = new Date(2026, 7, 10, 15, 0, 0); // 10 Ağustos 2026, yerel

  it('labels today and yesterday by name and older days by date', () => {
    const groups = groupFeedByDay(
      [
        item('a', localNoon(2026, 7, 10)),
        item('b', localNoon(2026, 7, 9)),
        item('c', localNoon(2026, 7, 7)),
      ],
      now
    );
    expect(groups.map((g) => g.label)).toEqual(['Bugün', 'Dün', '7 Ağustos']);
  });

  it('appends the year only when it differs from the current one', () => {
    const groups = groupFeedByDay([item('a', localNoon(2025, 11, 24))], now);
    expect(groups[0].label).toBe('24 Aralık 2025');
  });

  it('collects same-day items into one group and preserves input order', () => {
    const groups = groupFeedByDay(
      [
        item('a', new Date(2026, 7, 10, 9, 0).toISOString()),
        item('b', new Date(2026, 7, 10, 8, 0).toISOString()),
        item('c', localNoon(2026, 7, 9)),
      ],
      now
    );
    expect(groups).toHaveLength(2);
    expect(groups[0].items.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('keeps items with an unparseable date in a trailing group instead of dropping them', () => {
    const groups = groupFeedByDay([item('a', localNoon(2026, 7, 10)), item('bad', 'not-a-date')], now);
    expect(groups.map((g) => g.label)).toEqual(['Bugün', 'Tarihsiz']);
    expect(groups[1].items.map((i) => i.id)).toEqual(['bad']);
  });

  it('returns no groups for an empty feed', () => {
    expect(groupFeedByDay([], now)).toEqual([]);
  });
});

describe('youtubeThumbnail', () => {
  it('uses the original-aspect image for Shorts, since mqdefault bakes in grey bars', () => {
    expect(youtubeThumbnail('https://www.youtube.com/shorts/XYfv0T2k4h8')).toEqual({
      src: 'https://i.ytimg.com/vi/XYfv0T2k4h8/oardefault.jpg',
      fallback: 'https://i.ytimg.com/vi/XYfv0T2k4h8/mqdefault.jpg',
    });
  });

  it('uses mqdefault for regular videos, where oardefault 404s', () => {
    expect(youtubeThumbnail('https://www.youtube.com/watch?v=I07RBedXRYA')).toEqual({
      src: 'https://i.ytimg.com/vi/I07RBedXRYA/mqdefault.jpg',
      fallback: null,
    });
  });

  it('finds the id when v= is not the first query parameter', () => {
    expect(youtubeThumbnail('https://www.youtube.com/watch?list=PL123&v=I07RBedXRYA')?.src).toContain('I07RBedXRYA');
  });

  it('returns null for non-YouTube urls', () => {
    expect(youtubeThumbnail('https://yanisvaroufakis.eu/2026/08/01/post/')).toBeNull();
  });
});

describe('feedPage', () => {
  const items = Array.from({ length: 45 }, (_, i) => item(String(i), localNoon(2026, 7, 10)));

  it('counts pages, rounding a partial last page up', () => {
    expect(feedPageCount(45)).toBe(3);
    expect(feedPageCount(40)).toBe(2);
  });

  it('reports one page for an empty feed so the control never reads "Sayfa 1 / 0"', () => {
    expect(feedPageCount(0)).toBe(1);
  });

  it('slices the requested page', () => {
    expect(feedPage(items, 1).map((i) => i.id)[0]).toBe('0');
    expect(feedPage(items, 2).map((i) => i.id)[0]).toBe('20');
    expect(feedPage(items, 3)).toHaveLength(5);
  });

  it('clamps out-of-range pages instead of returning nothing', () => {
    expect(feedPage(items, 99)).toHaveLength(5);
    expect(feedPage(items, 0).map((i) => i.id)[0]).toBe('0');
  });
});

describe('markAsRead', () => {
  it('upserts a read status row', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn().mockReturnValue({ upsert }) };
    // deno-lint-ignore no-explicit-any
    await markAsRead(supabase as any, 'user-1', 'item-1');
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', content_item_id: 'item-1' }),
      { onConflict: 'user_id,content_item_id' }
    );
  });
});

describe('markManyAsRead', () => {
  it('marks every id in a SINGLE upsert call', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn().mockReturnValue({ upsert }) };

    // deno-lint-ignore no-explicit-any
    await markManyAsRead(supabase as any, 'user-1', ['a', 'b', 'c']);

    expect(upsert).toHaveBeenCalledTimes(1);
    const [rows, opts] = upsert.mock.calls[0];
    expect(rows).toHaveLength(3);
    expect(rows.map((r: { content_item_id: string }) => r.content_item_id)).toEqual(['a', 'b', 'c']);
    expect(rows.every((r: { user_id: string; read_at: string }) => r.user_id === 'user-1' && !!r.read_at)).toBe(true);
    expect(opts).toEqual({ onConflict: 'user_id,content_item_id' });
  });

  it('does not touch the network for an empty list', async () => {
    const supabase = { from: vi.fn() };
    // deno-lint-ignore no-explicit-any
    await markManyAsRead(supabase as any, 'user-1', []);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('throws when supabase reports an error', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: { message: 'nope' } });
    const supabase = { from: vi.fn().mockReturnValue({ upsert }) };
    // deno-lint-ignore no-explicit-any
    await expect(markManyAsRead(supabase as any, 'user-1', ['a'])).rejects.toBeTruthy();
  });
});

describe('decodeEntities', () => {
  // Bu iki dize CANLI veritabanindan alindi (2026-08-25) - akista harfi harfine
  // boyle goruluyordu.
  it('canlida gorulen sayisal varliklari cozer', () => {
    expect(decodeEntities('Mr Burnham &#8211; Unherd op-ed')).toBe('Mr Burnham – Unherd op-ed');
    expect(decodeEntities('24&#124;7 News')).toBe('24|7 News');
  });

  it('onaltilik ve adli varliklari cozer', () => {
    expect(decodeEntities('a &#x2014; b')).toBe('a — b');
    expect(decodeEntities('Tom &amp; Jerry')).toBe('Tom & Jerry');
    expect(decodeEntities('&ldquo;alinti&rdquo;')).toBe('“alinti”');
  });

  it('varlik yoksa ayni dizeyi dondurur', () => {
    const d = 'Moxo360 Testi Sertifikasyon Egitimi';
    expect(decodeEntities(d)).toBe(d);
    expect(decodeEntities('')).toBe('');
  });

  it('tanimadigi ya da bozuk varligi OLDUGU GIBI birakir', () => {
    // Yarim cozulmus baslik, hic cozulmemis olandan daha kafa karistirici.
    expect(decodeEntities('&bilinmeyen; x')).toBe('&bilinmeyen; x');
    expect(decodeEntities('&#99999999; x')).toBe('&#99999999; x');
    expect(decodeEntities('& yalniz')).toBe('& yalniz');
  });

  it('HTML etiketini METIN olarak birakir - enjeksiyon yolu acmaz', () => {
    // Girdi dis kaynaktan geliyor; cozucu yalnizca varlik kacislarini acar,
    // etiket uretmez. React bunu metin olarak basar.
    expect(decodeEntities('&lt;script&gt;alert(1)&lt;/script&gt;'))
      .toBe('<script>alert(1)</script>');
  });
});

describe('cleanSummary', () => {
  it('HTML etiketlerini soyup duz metin birakir', () => {
    expect(cleanSummary('<p>Merhaba <a href="/x">dunya</a>.</p>')).toBe('Merhaba dunya .');
  });

  it('script ve style GOVDESINI de atar', () => {
    // Yalnizca etiketi soymak govdedeki kodu METIN olarak ekranda birakirdi.
    expect(cleanSummary('a <script>var x = 1;</script> b')).toBe('a b');
    expect(cleanSummary('a <style>.k{color:red}</style> b')).toBe('a b');
  });

  it('varliklari cozer ve bosluklari tekler', () => {
    expect(cleanSummary('Mr  Burnham &#8211;\n\n Unherd')).toBe('Mr Burnham – Unherd');
  });

  it('bos ya da yalnizca-etiket girdide null doner', () => {
    expect(cleanSummary(null)).toBeNull();
    expect(cleanSummary('')).toBeNull();
    expect(cleanSummary('<div></div>')).toBeNull();
  });

  it('siniri asinca KELIME ortasindan kesmez', () => {
    const uzun = 'kelime '.repeat(40).trim();
    const c = cleanSummary(uzun, 30)!;
    expect(c.endsWith('…')).toBe(true);
    expect(c.length).toBeLessThanOrEqual(31);
    // Kirpilan kisim tam kelimelerden olusmali
    expect(c.slice(0, -1).trim().split(' ').every((k) => k === 'kelime')).toBe(true);
  });

  it('tek uzun kelimede sert keser - hic gostermemekten iyidir', () => {
    const c = cleanSummary('a'.repeat(100), 20)!;
    expect(c).toBe('a'.repeat(20) + '…');
  });

  it('sinirin altindaki metne ... eklemez', () => {
    expect(cleanSummary('kisa metin', 180)).toBe('kisa metin');
  });
});

describe('estimateReadingMinutes', () => {
  it('returns null when there is no summary text', () => {
    expect(estimateReadingMinutes(null)).toBeNull();
    expect(estimateReadingMinutes('<div></div>')).toBeNull();
  });

  it('rounds to whole minutes at ~200 words/min, minimum 1', () => {
    expect(estimateReadingMinutes('kelime ')).toBe(1);
    expect(estimateReadingMinutes('kelime '.repeat(400))).toBe(2);
  });
});

describe('cleanSummary — gercek besleme verisi', () => {
  // Asagidaki iki dize 2026-08-25'te GERCEK beslemelerden cekildi. Amac: iki
  // kaynak turunun ozeti bambaska bicimde veriyor olmasi (biri HTML govdesi,
  // digeri satir sonlu duz metin) ve ikisinin de ayni temiz ciktiya inmesi.
  it('blog ozetindeki HTML govdesini duz metne indirir', () => {
    const ham = '<p>In the lead-up to the Brexit referendum, Remainers deployed Project Fear.</p>';
    expect(cleanSummary(ham)).toBe('In the lead-up to the Brexit referendum, Remainers deployed Project Fear.');
  });

  it('YouTube ozetindeki satir sonlarini teker', () => {
    const ham = 'In math you can\'t truly pick things at random.\n\nSo if we can\'t pick randomly?';
    expect(cleanSummary(ham)).toBe('In math you can\'t truly pick things at random. So if we can\'t pick randomly?');
  });
});

describe('filterFeed', () => {
  const okundu = { ...item('a', localNoon(2026, 7, 24)), is_read: true, content_type: 'youtube' };
  const yeniYt = { ...item('b', localNoon(2026, 7, 24)), content_type: 'youtube' };
  const yeniBlog = { ...item('c', localNoon(2026, 7, 24)), content_type: 'blog' };
  const hepsi = [okundu, yeniYt, yeniBlog];

  it('filtre yokken hepsini dondurur', () => {
    expect(filterFeed(hepsi, FILTRE_YOK).map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('okunmamis filtresi okunmuslari atar', () => {
    expect(filterFeed(hepsi, { ...FILTRE_YOK, unreadOnly: true, types: [] }).map((i) => i.id)).toEqual(['b', 'c']);
  });

  it('tur filtresi yalnizca o turu birakir', () => {
    expect(filterFeed(hepsi, { ...FILTRE_YOK, unreadOnly: false, types: ['blog'] }).map((i) => i.id)).toEqual(['c']);
  });

  it('iki filtre birlikte calisir', () => {
    expect(filterFeed(hepsi, { ...FILTRE_YOK, unreadOnly: true, types: ['youtube'] }).map((i) => i.id)).toEqual(['b']);
  });

  it('BOS tur listesi "hepsi" demektir, "hicbiri" degil', () => {
    // Son rozeti de kapatinca akis bosalmamali, filtre kalkmali.
    expect(filterFeed(hepsi, { ...FILTRE_YOK, unreadOnly: false, types: [] })).toHaveLength(3);
  });

  it('eslesme yoksa bos dizi doner, patlamaz', () => {
    expect(filterFeed(hepsi, { ...FILTRE_YOK, unreadOnly: false, types: ['academic'] })).toEqual([]);
    expect(filterFeed([], FILTRE_YOK)).toEqual([]);
  });
});

describe('typeCounts', () => {
  it('tur basina sayar', () => {
    const items = [
      { ...item('a', localNoon(2026, 7, 24)), content_type: 'youtube' },
      { ...item('b', localNoon(2026, 7, 24)), content_type: 'youtube' },
      { ...item('c', localNoon(2026, 7, 24)), content_type: 'blog' },
    ];
    expect(typeCounts(items)).toEqual({ youtube: 2, blog: 1 });
  });

  it('bos akista bos nesne doner', () => {
    expect(typeCounts([])).toEqual({});
  });
});

describe('filterFeed — kaydedilenler', () => {
  const kayitli = { ...item('k', localNoon(2026, 7, 24)), is_saved: true };
  const kayitsiz = { ...item('n', localNoon(2026, 7, 24)) };
  const kayitliOkunmus = { ...item('o', localNoon(2026, 7, 24)), is_saved: true, is_read: true };
  const hepsi = [kayitli, kayitsiz, kayitliOkunmus];

  it('savedOnly yalnizca kaydedilenleri birakir', () => {
    expect(filterFeed(hepsi, { ...FILTRE_YOK, savedOnly: true }).map((i) => i.id)).toEqual(['k', 'o']);
  });

  it('kaydedilenler + okunmamis birlikte daraltir', () => {
    expect(
      filterFeed(hepsi, { ...FILTRE_YOK, savedOnly: true, unreadOnly: true }).map((i) => i.id),
    ).toEqual(['k']);
  });

  it('savedOnly kapaliyken kaydedilme durumu hicbir seyi elemez', () => {
    expect(filterFeed(hepsi, FILTRE_YOK)).toHaveLength(3);
  });
});

describe('toggleSaved', () => {
  it('kaydederken saved_at yazar', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn().mockReturnValue({ upsert }) };
    // deno-lint-ignore no-explicit-any
    await toggleSaved(supabase as any, 'user-1', 'item-1', true);
    expect(supabase.from).toHaveBeenCalledWith('user_content_status');
    const [satir, secenek] = upsert.mock.calls[0];
    expect(satir.user_id).toBe('user-1');
    expect(satir.content_item_id).toBe('item-1');
    expect(typeof satir.saved_at).toBe('string');
    expect(secenek).toEqual({ onConflict: 'user_id,content_item_id' });
  });

  it('kaydi kaldirirken saved_at NULL yazar - satiri silmez', () => {
    // Satiri silmek read_at'i de gotururdu; kaydi kaldirmak okundu bilgisini
    // silmemeli.
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn().mockReturnValue({ upsert }) };
    // deno-lint-ignore no-explicit-any
    return toggleSaved(supabase as any, 'user-1', 'item-1', false).then(() => {
      expect(upsert.mock.calls[0][0].saved_at).toBeNull();
    });
  });

  it('hata firlatir', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: { message: 'nope' } });
    const supabase = { from: vi.fn().mockReturnValue({ upsert }) };
    // deno-lint-ignore no-explicit-any
    await expect(toggleSaved(supabase as any, 'u', 'i', true)).rejects.toBeTruthy();
  });
});
