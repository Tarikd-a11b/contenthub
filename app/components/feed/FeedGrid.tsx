'use client';

import { AnimatePresence } from 'framer-motion';
import type { FeedDayGroup, FeedItem } from '@/lib/feed';
import TimeMarker from './TimeMarker';
import FeedCard from './FeedCard';

type Props = {
  groups: FeedDayGroup[];
  focusedId: string | null;
  onRead: (item: FeedItem) => void;
  onToggleSave: (item: FeedItem) => void;
};

/**
 * Dinamik masonry: gerçek bir masonry kütüphanesi yerine CSS multi-column
 * kullanılıyor (bağımlılık eklemeden akıcı sıvı yeniden dizilim). Kartların
 * `layout` animasyonu framer-motion'ın ölçtüğü gerçek DOM konumlarına göre
 * çalıştığı için altta grid ya da columns olması fark etmiyor.
 */
export default function FeedGrid({ groups, focusedId, onRead, onToggleSave }: Props) {
  return (
    <div className="mt-2">
      {groups.map((group) => (
        <section key={group.key} className="grid grid-cols-1 items-start gap-x-8 sm:grid-cols-[10rem_1fr]">
          {/* Sarmalayıcı ŞART: sticky bir eleman, kendi kapsayan bloğundan KISA
              olmalı ki kayacak yeri olsun. TimeMarker doğrudan grid item olsaydı
              satır yüksekliğine gerilir ve sticky hiç tetiklenmezdi (canlıda
              böyleydi: etiket kaydırınca yukarı kaçıyordu). */}
          <div className="h-full">
            <TimeMarker label={group.label} />
          </div>

          <div className="min-w-0 columns-1 gap-4 pt-6 sm:columns-2 xl:columns-3">
            <AnimatePresence initial={false}>
              {group.items.map((item) => (
                <FeedCard
                  key={item.id}
                  item={item}
                  isFocused={item.id === focusedId}
                  onRead={onRead}
                  onToggleSave={onToggleSave}
                />
              ))}
            </AnimatePresence>
          </div>
        </section>
      ))}
    </div>
  );
}
