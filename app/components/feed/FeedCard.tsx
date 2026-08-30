'use client';

import { motion } from 'framer-motion';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { cleanSummary, estimateReadingMinutes, type FeedItem } from '@/lib/feed';
import { cn } from '@/lib/cn';
import SourceTypeDot from '@/app/components/SourceTypeDot';
import FeedThumbnail from '@/app/components/FeedThumbnail';
import QuickActions from './QuickActions';
import { categoryAccent } from './feedTheme';

type Props = {
  item: FeedItem;
  isFocused: boolean;
  onRead: (item: FeedItem) => void;
  onToggleSave: (item: FeedItem) => void;
};

const cardVariants = {
  rest: { scale: 1 },
  hover: { scale: 1.02 },
};

// Height 0 → 'auto': framer-motion ölçüp interpolasyon yapıyor, overflow-hidden
// dış sarmalayıcıda ŞART yoksa geçiş sırasında içerik taşar.
const revealVariants = {
  rest: { height: 0, opacity: 0, marginTop: 0 },
  hover: { height: 'auto', opacity: 1, marginTop: 10 },
};

const actionsVariants = {
  rest: { opacity: 0, y: -4 },
  hover: { opacity: 1, y: 0 },
};

/**
 * Okunmuşken özet gizleniyor (bkz. eski akış): satırın işi "açayım mı?"
 * sorusuna cevap vermek, karar verilmişse özet yalnızca gürültü.
 */
function ozet(item: FeedItem): string | null {
  return item.is_read ? null : cleanSummary(item.summary);
}

export default function FeedCard({ item, isFocused, onRead, onToggleSave }: Props) {
  const accent = categoryAccent(item.content_type);
  const summary = ozet(item);
  const dakika = item.content_type === 'blog' ? estimateReadingMinutes(item.summary) : null;

  /* "Yukarıda kaldı" sönükleşmesi: kart viewport'un ÜSTÜNDEN çıktığında %60
     saydamlığa iniyor, geri kaydırınca eski haline dönüyor. Yalnızca görsel —
     içeriği okundu SAYMIYOR (bkz. FeedGrid/sayfa notu: kaydırmayla otomatik
     okundu işaretlemek, kullanıcının okumadığı 287 içeriği geri alınamaz
     biçimde okundu yapardı). */
  const ref = useRef<HTMLElement>(null);
  const [gecildi, setGecildi] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const gozlemci = new IntersectionObserver(
      ([giris]) => setGecildi(!giris.isIntersecting && giris.boundingClientRect.top < 0),
      { threshold: 0 },
    );
    gozlemci.observe(el);
    return () => gozlemci.disconnect();
  }, []);

  return (
    <motion.article
      ref={ref}
      layout
      initial="rest"
      // Variant ADI (nesne değil) şart: alt katmanlar (özet açılışı, hızlı
      // aksiyonlar) bu etiketi ebeveynden miras alıyor. Sönükleşme bu yüzden
      // framer'ın animate'ine değil, CSS geçişine bağlandı.
      animate={isFocused ? 'hover' : 'rest'}
      whileHover="hover"
      whileFocus="hover"
      variants={cardVariants}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      tabIndex={0}
      className={cn(
        'group relative mb-4 block break-inside-avoid rounded-lg border border-border bg-surface p-3.5 outline-none transition-[colors,opacity] duration-300',
        'hover:[border-color:var(--cat-hover)] focus-visible:[border-color:var(--cat-hover)]',
        isFocused && 'ring-2 ring-accent shadow-[0_0_20px_rgba(108,108,229,0.35)]',
      )}
      style={{ '--cat-hover': accent.hoverBorder, opacity: gecildi && !isFocused ? 0.6 : 1 } as CSSProperties}
    >
      <a
        href={item.url}
        target="_blank"
        rel="noreferrer"
        onClick={() => onRead(item)}
        className="block"
      >
        <FeedThumbnail url={item.url} contentType={item.content_type} sourceName={item.source_name} variant="card" />

        <div className={item.is_read ? 'mt-3 opacity-40 transition-opacity' : 'mt-3'}>
          <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide" style={{ color: accent.badge }}>
            <SourceTypeDot type={item.content_type} />
            {accent.label}
            {dakika !== null && <span className="text-muted normal-case tracking-normal">· {dakika} dk okuma</span>}
          </p>

          <p
            className={cn(
              'mt-1.5 text-[15px] leading-snug transition-colors',
              item.is_read ? 'font-normal text-muted' : 'font-medium text-foreground',
            )}
          >
            {item.title}
          </p>

          <p className="mt-1 font-mono text-xs text-muted">{item.source_name}</p>
        </div>

        {summary && (
          <motion.div variants={revealVariants} className="overflow-hidden">
            <p className="line-clamp-3 text-[13.5px] leading-relaxed text-muted">{summary}</p>
            <span className="mt-2 inline-block text-xs font-medium text-accent">
              Özet çıkar / Hızlı oku →
            </span>
          </motion.div>
        )}
      </a>

      <motion.div variants={actionsVariants} className="absolute right-2.5 top-2.5">
        <QuickActions
          isSaved={item.is_saved}
          onToggleSave={() => onToggleSave(item)}
          onArchive={() => onRead(item)}
        />
      </motion.div>
    </motion.article>
  );
}
