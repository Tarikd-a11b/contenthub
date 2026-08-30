'use client';

import { useState } from 'react';
import { youtubeThumbnail } from '@/lib/feed';

const INITIAL_CLASSES: Record<string, string> = {
  blog: 'text-source-blog',
  youtube: 'text-source-youtube',
  x: 'text-source-x',
  academic: 'text-source-academic',
};

const BOX_BY_VARIANT: Record<'row' | 'card', string> = {
  row: 'h-[72px] w-32 shrink-0 rounded-md border border-border bg-surface',
  // 'card': masonry redesign'ında tam genişlik, orana göre yükseklik.
  card: 'aspect-video w-full rounded-md border border-border bg-surface',
};

type Props = { url: string; contentType: string; sourceName: string; variant?: 'row' | 'card' };

export default function FeedThumbnail({ url, contentType, sourceName, variant = 'row' }: Props) {
  const thumb = youtubeThumbnail(url);
  const [src, setSrc] = useState<string | null>(thumb?.src ?? null);
  const box = BOX_BY_VARIANT[variant];

  if (!src) {
    const initial = sourceName.trim().charAt(0).toLocaleUpperCase('tr-TR') || '·';
    return (
      <div className={`${box} flex items-center justify-center`} aria-hidden>
        <span className={`font-mono text-lg ${INITIAL_CLASSES[contentType] ?? 'text-muted'}`}>{initial}</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- next/image ister ki her kaynak
    // alan adı next.config'de kayıtlı olsun; kapaklar tek bir CDN'den (i.ytimg.com) ve
    // zaten doğru boyutta geliyor, optimizasyon katmanı buraya değer katmıyor.
    <img
      src={src}
      alt=""
      loading="lazy"
      className={`${box} object-cover`}
      onError={() => setSrc(thumb?.fallback && src !== thumb.fallback ? thumb.fallback : null)}
    />
  );
}
