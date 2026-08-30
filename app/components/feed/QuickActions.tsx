'use client';

import { Bookmark, Archive } from 'lucide-react';
import { cn } from '@/lib/cn';

type Props = {
  isSaved: boolean;
  onToggleSave: () => void;
  onArchive: () => void;
};

/** Kart odaklandığında/hover'landığında beliren "sonra oku" + "okundu say" katmanı. */
export default function QuickActions({ isSaved, onToggleSave, onArchive }: Props) {
  return (
    <div className="flex gap-1">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleSave();
        }}
        aria-pressed={isSaved}
        title={isSaved ? 'Kaydı kaldır (S)' : 'Daha sonra oku (S)'}
        className={cn(
          'rounded-md bg-background/80 p-1.5 backdrop-blur transition-colors',
          isSaved ? 'text-accent' : 'text-muted hover:text-foreground',
        )}
      >
        <Bookmark size={14} fill={isSaved ? 'currentColor' : 'none'} />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onArchive();
        }}
        title="Okundu say / arşivle (E)"
        className="rounded-md bg-background/80 p-1.5 text-muted backdrop-blur transition-colors hover:text-foreground"
      >
        <Archive size={14} />
      </button>
    </div>
  );
}
