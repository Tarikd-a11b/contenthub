/**
 * Gün başlığı artık sticky: NavBar (sticky DEĞİL, normal akışta) kaydırılıp
 * geçildikten sonra bu etiket viewport'un üstüne kilitlenir, sıradaki gün
 * grubu geldiğinde bir sonraki etiket onu iter — iOS Fotoğraflar'daki gibi
 * yığılan tarih başlıkları.
 */
export default function TimeMarker({ label }: { label: string }) {
  return (
    <div className="sticky top-0 z-10 bg-background/95 pb-2 pt-6 backdrop-blur-sm">
      <h2 className="font-mono text-[clamp(1.15rem,2.2vw,1.6rem)] font-medium leading-none tracking-tight text-muted">
        {label}
      </h2>
    </div>
  );
}
