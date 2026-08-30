import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import FeedCard from '@/app/components/feed/FeedCard';
import type { FeedItem } from '@/lib/feed';

/**
 * Kaydırınca-okundu davranışının GÜVENLİK KORUMALARINI doğrular.
 *
 * Bu mantık geri alınamayan bir yazma tetikliyor (okundu işaretleme), ve
 * tarayıcı otomasyonuyla doğrulanamıyor: otomasyon sekmesi `document.hidden`
 * raporladığı için IntersectionObserver hiç tetiklenmiyor. Bu yüzden gözlemci
 * burada taklit ediliyor ve girişler elle besleniyor.
 */

type IOCallback = (entries: Array<{ isIntersecting: boolean; boundingClientRect: { top: number } }>) => void;

let gozlemciler: IOCallback[] = [];

class SahteIntersectionObserver {
  constructor(cb: IOCallback) {
    gozlemciler.push(cb);
  }
  observe() {}
  disconnect() {}
  unobserve() {}
}

/** Kartın ekranda göründüğünü bildirir. */
function gorunurYap() {
  act(() => {
    gozlemciler.forEach((cb) => cb([{ isIntersecting: true, boundingClientRect: { top: 100 } }]));
  });
}

/** Kartın viewport'un ÜSTÜNDEN çıktığını bildirir. */
function yukaridanCik() {
  act(() => {
    gozlemciler.forEach((cb) => cb([{ isIntersecting: false, boundingClientRect: { top: -50 } }]));
  });
}

/** Kartın viewport'un ALTINDA olduğunu bildirir (henüz görülmedi). */
function asagidaKal() {
  act(() => {
    gozlemciler.forEach((cb) => cb([{ isIntersecting: false, boundingClientRect: { top: 900 } }]));
  });
}

function item(over: Partial<FeedItem> = {}): FeedItem {
  return {
    id: 'item-1',
    title: 'Başlık',
    url: 'https://example.com/a',
    published_at: new Date().toISOString(),
    content_type: 'blog',
    source_name: 'Kaynak',
    is_read: false,
    summary: 'özet metni',
    is_saved: false,
    ...over,
  };
}

function ekle(props: Partial<React.ComponentProps<typeof FeedCard>> = {}) {
  const onScrolledPast = vi.fn();
  render(
    <FeedCard
      item={item()}
      isFocused={false}
      onRead={vi.fn()}
      onToggleSave={vi.fn()}
      onScrolledPast={onScrolledPast}
      {...props}
    />,
  );
  return onScrolledPast;
}

beforeEach(() => {
  gozlemciler = [];
  vi.stubGlobal('IntersectionObserver', SahteIntersectionObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('FeedCard — kaydırınca okundu koruması', () => {
  it('GÖRÜLMEDEN yukarıda kalan kartı okundu bildirmez', () => {
    // Gerçek senaryo: tarayıcı kaydırma konumunu geri yüklediğinde bazı kartlar
    // hiç görünmeden viewport'un üstünde kalır. Bunları okundu saymak, kullanıcının
    // hiç görmediği içeriği geri alınamaz biçimde okundu yapardı.
    const onScrolledPast = ekle();
    yukaridanCik();
    expect(onScrolledPast).not.toHaveBeenCalled();
  });

  it('görülüp yukarıdan çıkınca BİR KEZ bildirir', () => {
    const onScrolledPast = ekle();
    gorunurYap();
    yukaridanCik();
    expect(onScrolledPast).toHaveBeenCalledTimes(1);
  });

  it('aşağı-yukarı kaydırmada tekrar tekrar bildirmez', () => {
    const onScrolledPast = ekle();
    gorunurYap();
    yukaridanCik();
    gorunurYap();
    yukaridanCik();
    gorunurYap();
    yukaridanCik();
    expect(onScrolledPast).toHaveBeenCalledTimes(1);
  });

  it('zaten okunmuş kartı yeniden bildirmez', () => {
    const onScrolledPast = ekle({ item: item({ is_read: true }) });
    gorunurYap();
    yukaridanCik();
    expect(onScrolledPast).not.toHaveBeenCalled();
  });

  it('henüz görünmemiş (aşağıdaki) kart için bildirmez', () => {
    const onScrolledPast = ekle();
    asagidaKal();
    expect(onScrolledPast).not.toHaveBeenCalled();
  });
});
