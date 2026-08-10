const DOT_CLASSES: Record<string, string> = {
  blog: 'bg-source-blog',
  youtube: 'bg-source-youtube',
  x: 'bg-source-x',
  academic: 'bg-source-academic',
};

export default function SourceTypeDot({ type }: { type: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${DOT_CLASSES[type] ?? 'bg-muted'}`}
    />
  );
}
