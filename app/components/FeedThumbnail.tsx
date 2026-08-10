'use client';

import { useState } from 'react';
import { youtubeThumbnail } from '@/lib/feed';

const INITIAL_CLASSES: Record<string, string> = {
  blog: 'text-source-blog',
  youtube: 'text-source-youtube',
  x: 'text-source-x',
  academic: 'text-source-academic',
};

const BOX = 'h-[72px] w-32 shrink-0 rounded-md border border-border bg-surface';

type Props = { url: string; contentType: string; sourceName: string };

export default function FeedThumbnail({ url, contentType, sourceName }: Props) {
  const thumb = youtubeThumbnail(url);
  const [src, setSrc] = useState<string | null>(thumb?.src ?? null);

  if (!src) {
    const initial = sourceName.trim().charAt(0).toLocaleUpperCase('tr-TR') || '·';
    return (
      <div className={`${BOX} flex items-center justify-center`} aria-hidden>
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
      className={`${BOX} object-cover`}
      onError={() => setSrc(thumb?.fallback && src !== thumb.fallback ? thumb.fallback : null)}
    />
  );
}
