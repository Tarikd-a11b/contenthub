'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  sortFeedByRecency,
  markAsRead,
  groupFeedByDay,
  feedPage,
  feedPageCount,
  decodeEntities,
  cleanSummary,
  FEED_FETCH_LIMIT,
  toggleSaved,
  filterFeed,
  typeCounts,
  FILTRE_YOK,
  type FeedFilter,
  type FeedItem,
} from '@/lib/feed';
import NavBar from '@/app/components/NavBar';
import SourceTypeDot from '@/app/components/SourceTypeDot';
import FeedThumbnail from '@/app/components/FeedThumbnail';

export default function FeedPage() {
  const supabase = createClient();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filtre, setFiltre] = useState<FeedFilter>(FILTRE_YOK);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      // Oturum yoksa load() hiç çalışmaz; yükleniyor durumunu burada kapatmazsak iskelet asılı kalır.
      if (!data.user) setLoading(false);
    });
  }, [supabase]);

  useEffect(() => {
    if (!userId) return;

    async function load() {
      try {
        const { data: follows, error: followsError } = await supabase.from('follows').select('source_id').eq('user_id', userId);
        if (followsError) setError(followsError.message);
        const sourceIds = (follows ?? []).map((f) => f.source_id);
        if (sourceIds.length === 0) return setItems([]);

        const { data: contentRows, error: contentError } = await supabase
          .from('content_items')
          .select('id, title, url, published_at, content_type, summary, sources(name)')
          .in('source_id', sourceIds)
          .order('published_at', { ascending: false })
          .limit(FEED_FETCH_LIMIT);
        if (contentError) setError(contentError.message);

        const contentIds = (contentRows ?? []).map((row) => row.id);

        const { data: statusRows, error: statusError } = contentIds.length > 0
          ? await supabase
              .from('user_content_status')
              .select('content_item_id, read_at, saved_at')
              .eq('user_id', userId)
              .in('content_item_id', contentIds)
          : { data: [], error: null };
        if (statusError) setError(statusError.message);
        const readIds = new Set((statusRows ?? []).filter((r) => r.read_at).map((r) => r.content_item_id));
        // Aynı satırda yaşıyorlar (bkz. göç 0003): tek sorgu, iki küme.
        const savedIds = new Set(
          (statusRows ?? []).filter((r) => (r as { saved_at?: string | null }).saved_at).map((r) => r.content_item_id),
        );

        const feedItems: FeedItem[] = (contentRows ?? []).map((row) => ({
          id: row.id,
          // Besleme başlıkları HTML varlıklarıyla geliyor ("&#8211;"), ekranda
          // harfi harfine görünüyorlardı. Çözme burada, veri katmanının hemen
          // ardında yapılıyor — böylece aşağıdaki her kullanım temiz metin görür.
          title: decodeEntities(row.title),
          url: row.url,
          published_at: row.published_at,
          content_type: row.content_type,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          source_name: decodeEntities((row.sources as any)?.name ?? ''),
          is_read: readIds.has(row.id),
          // Ham saklanıyor; etiket soyma ve kısaltma gösterim anında yapılıyor
          // (bkz. cleanSummary), böylece kural tek yerde durur.
          summary: row.summary ?? null,
          is_saved: savedIds.has(row.id),
        }));

        setItems(sortFeedByRecency(feedItems));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [supabase, userId]);

  // Filtre sayfalamadan ÖNCE uygulanmalı: sonra uygulasaydık "Sayfa 1/5" derken
  // sayfada üç satır kalırdı ve sayaç yalan söylerdi.
  const suzulmus = useMemo(() => filterFeed(items, filtre), [items, filtre]);
  const totalPages = feedPageCount(suzulmus.length);
  const groups = useMemo(() => groupFeedByDay(feedPage(suzulmus, page)), [suzulmus, page]);
  const okunmamis = items.filter((i) => !i.is_read).length;
  const turSayilari = useMemo(() => typeCounts(items), [items]);
  const kayitliSayisi = items.filter((i) => i.is_saved).length;
  const filtreliMi = filtre.unreadOnly || filtre.savedOnly || filtre.types.length > 0;

  // Filtre değişince sayfa 1'e dönmeli; yoksa 4. sayfadayken daraltma yapınca
  // boş bir sayfaya bakıyor olurdun.
  useEffect(() => { setPage(1); }, [filtre]);

  function turDegistir(tur: string) {
    setFiltre((o) => ({
      ...o,
      types: o.types.includes(tur) ? o.types.filter((t) => t !== tur) : [...o.types, tur],
    }));
  }

  function goToPage(next: number) {
    setPage(Math.min(Math.max(1, next), totalPages));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSave(item: FeedItem) {
    if (!userId) return;
    const yeni = !item.is_saved;
    // İyimser güncelleme: kaydetme anlık hissedilmeli. Hata olursa geri alınıyor,
    // yoksa arayüz sunucuda olmayan bir durumu gösterir.
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_saved: yeni } : i)));
    try {
      await toggleSaved(supabase, userId, item.id, yeni);
    } catch (err) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_saved: !yeni } : i)));
      setError(err instanceof Error ? err.message : 'Kaydedilemedi');
    }
  }

  async function handleRead(item: FeedItem) {
    if (!userId) return;
    try {
      await markAsRead(supabase, userId, item.id);
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_read: true } : i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
    }
  }

  return (
    <div>
      <NavBar />
      <div className="mx-auto mt-10 max-w-5xl px-6 pb-24">
        <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <h1 className="text-2xl font-medium tracking-tight">Akış</h1>
          {!loading && items.length > 0 && (
            <p className="font-mono text-xs text-muted">
              {filtreliMi
                ? `${suzulmus.length} / ${items.length} içerik`
                : okunmamis > 0
                  ? `${okunmamis} okunmamış · ${items.length} içerik`
                  : `${items.length} içerik · hepsi okundu`}
            </p>
          )}
        </header>

        {!loading && items.length > 0 && (
          <FiltreSeridi
            filtre={filtre}
            setFiltre={setFiltre}
            turDegistir={turDegistir}
            turSayilari={turSayilari}
            okunmamis={okunmamis}
            kayitli={kayitliSayisi}
          />
        )}

        {error && (
          <p className="mt-4 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}

        {loading ? (
          <FeedSkeleton />
        ) : items.length === 0 ? (
          <BosDurum />
        ) : suzulmus.length === 0 ? (
          <SonucYok onTemizle={() => setFiltre(FILTRE_YOK)} />
        ) : (
          <>
            <div className="mt-10">
              {groups.map((group) => (
                /* Landing sayfasıyla aynı dil: gün, satırların solunda yapısal bir
                   işaret olarak duruyor. Sıralamayı zaman yaptığı için tarih
                   başlıktan daha büyük — okuyucu önce güne, sonra içeriğe bakıyor. */
                /* Kolon 10rem: "23 Ağustos" 8rem'e sığmayıp iki satıra kırılıyordu. */
                <section key={group.key} className="grid grid-cols-1 gap-x-8 sm:grid-cols-[10rem_1fr]">
                  <div className="pt-6">
                    <h2 className="font-mono text-[clamp(1.15rem,2.2vw,1.6rem)] font-medium leading-none tracking-tight text-muted">
                      {group.label}
                    </h2>
                  </div>

                  <ul className="border-l border-border pl-5 sm:pl-7">
                    {group.items.map((item) => (
                      /* Kaydet düğmesi <a>'nın İÇİNE konamaz (geçersiz HTML ve
                         tıklama çakışır); kardeş olarak konumlandırılıyor. */
                      <li key={item.id} className="relative">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => handleRead(item)}
                          className="group/satir -mx-3 flex gap-4 rounded-lg py-3.5 pl-3 pr-12 transition-colors hover:bg-surface"
                        >
                          <div className={item.is_read ? 'opacity-40 transition-opacity' : ''}>
                            <FeedThumbnail url={item.url} contentType={item.content_type} sourceName={item.source_name} />
                          </div>
                          <div className="min-w-0 flex-1">
                            {/* Okunmuş içerik silinmiyor, ağırlığını kaybediyor:
                                başlık sönükleşiyor ama okunur kalıyor. Eskiden tüm
                                satır %50 saydamdı ve kaynak adı da okunmaz oluyordu. */}
                            <p
                              className={`text-[15px] leading-snug transition-colors ${
                                item.is_read ? 'font-normal text-muted' : 'font-medium text-foreground'
                              }`}
                            >
                              {item.title}
                            </p>
                            {ozet(item) && (
                              /* line-clamp-2: özet uzunluğu kaynaktan kaynağa çok
                                 değişiyor; satır sayısını sabitlemek listenin ritmini
                                 koruyor. Okunmuşlarda büsbütün gizleniyor — o satır
                                 artık karar vermene yaramaz, yalnızca yer kaplar. */
                              <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-relaxed text-muted">
                                {ozet(item)}
                              </p>
                            )}
                            <p className="mt-1.5 flex items-center gap-2 font-mono text-xs tracking-wide text-muted">
                              <SourceTypeDot type={item.content_type} />
                              {item.source_name}
                            </p>
                          </div>
                        </a>
                        <button
                          type="button"
                          onClick={() => handleSave(item)}
                          aria-pressed={item.is_saved}
                          aria-label={item.is_saved ? 'Kaydı kaldır' : 'Sonra oku'}
                          title={item.is_saved ? 'Kaydı kaldır' : 'Sonra oku'}
                          className={`absolute right-1 top-4 rounded-md p-2 transition-colors ${
                            item.is_saved
                              ? 'text-accent'
                              : 'text-transparent hover:text-muted focus-visible:text-muted group-hover/satir:text-muted'
                          }`}
                        >
                          <BookmarkIkonu dolu={item.is_saved} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            {totalPages > 1 && (
              <nav className="mt-14 flex items-center justify-center gap-5 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => goToPage(page - 1)}
                  disabled={page === 1}
                  className="rounded px-2 py-1 text-muted transition-colors hover:text-foreground disabled:opacity-30 disabled:hover:text-muted"
                >
                  ← Önceki
                </button>
                <span className="text-muted">
                  Sayfa {page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => goToPage(page + 1)}
                  disabled={page === totalPages}
                  className="rounded px-2 py-1 text-muted transition-colors hover:text-foreground disabled:opacity-30 disabled:hover:text-muted"
                >
                  Sonraki →
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* Kaydedilmemişken ikon görünmez (text-transparent), satırın üstüne gelince
   belirir — listenin sakinliğini bozmasın. Kaydedilmişse HER ZAMAN görünür,
   çünkü artık bir durum bildiriyor, bir eylem sunmuyor. */
function BookmarkIkonu({ dolu }: { dolu: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden
      fill={dolu ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 2.5h9v11l-4.5-3.2-4.5 3.2z" />
    </svg>
  );
}

/* Tür etiketleri kullanıcının dilinde. Veritabanındaki değer ('youtube') bir
   sistem terimi; rozette görünen ad kullanıcının tanıdığı sözcük olmalı. */
const TUR_ADI: Record<string, string> = {
  youtube: 'Video',
  blog: 'Blog',
  x: 'X',
  academic: 'Akademik',
};

const TUR_NOKTA: Record<string, string> = {
  youtube: 'bg-source-youtube',
  blog: 'bg-source-blog',
  x: 'bg-source-x',
  academic: 'bg-source-academic',
};

function FiltreSeridi({
  filtre, setFiltre, turDegistir, turSayilari, okunmamis, kayitli,
}: {
  filtre: FeedFilter;
  setFiltre: (f: FeedFilter) => void;
  turDegistir: (tur: string) => void;
  turSayilari: Record<string, number>;
  okunmamis: number;
  kayitli: number;
}) {
  // Yalnızca GERÇEKTEN içeriği olan türler rozet alıyor. Akışında hiç akademik
  // içerik yokken o rozeti göstermek, tıklayınca boş ekran veren bir vaat olurdu.
  const turler = Object.keys(turSayilari).sort((a, b) => turSayilari[b] - turSayilari[a]);
  const filtreliMi = filtre.unreadOnly || filtre.savedOnly || filtre.types.length > 0;

  const temel =
    'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-xs transition-colors';
  const acik = 'border-accent bg-accent/10 text-foreground';
  const kapali = 'border-border text-muted hover:border-muted hover:text-foreground';

  return (
    <div className="mt-6 flex flex-wrap items-center gap-2">
      <button
        type="button"
        aria-pressed={filtre.unreadOnly}
        onClick={() => setFiltre({ ...filtre, unreadOnly: !filtre.unreadOnly })}
        className={`${temel} ${filtre.unreadOnly ? acik : kapali}`}
      >
        Okunmamış
        <span className="text-muted">{okunmamis}</span>
      </button>

      {/* Rozet YALNIZCA kaydedilmiş içerik varken çıkıyor: hiç kaydetmemiş
          birine "Kaydedilenler 0" göstermek boş bir kapı olurdu. */}
      {kayitli > 0 && (
        <button
          type="button"
          aria-pressed={filtre.savedOnly}
          onClick={() => setFiltre({ ...filtre, savedOnly: !filtre.savedOnly })}
          className={`${temel} ${filtre.savedOnly ? acik : kapali}`}
        >
          <BookmarkIkonu dolu={filtre.savedOnly} />
          Kaydedilenler
          <span className="text-muted">{kayitli}</span>
        </button>
      )}

      {turler.map((tur) => {
        const secili = filtre.types.includes(tur);
        return (
          <button
            key={tur}
            type="button"
            aria-pressed={secili}
            onClick={() => turDegistir(tur)}
            className={`${temel} ${secili ? acik : kapali}`}
          >
            <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${TUR_NOKTA[tur] ?? 'bg-muted'}`} />
            {TUR_ADI[tur] ?? tur}
            <span className="text-muted">{turSayilari[tur]}</span>
          </button>
        );
      })}

      {filtreliMi && (
        <button
          type="button"
          onClick={() => setFiltre(FILTRE_YOK)}
          className="ml-1 font-mono text-xs text-muted underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          Filtreyi temizle
        </button>
      )}
    </div>
  );
}

/** Filtre sonucu boşsa: akış boş DEĞİL, daraltma çok dar. İki durumu ayırmak
 *  önemli — "hiç içerik yok" ile "bu filtreyle içerik yok" farklı sorunlar. */
function SonucYok({ onTemizle }: { onTemizle: () => void }) {
  return (
    <div className="mt-12 max-w-md">
      <p className="text-[15px] font-medium">Bu filtreyle içerik yok.</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Akışında içerik var ama seçtiğin daraltmaya uyanı yok.
      </p>
      <button
        type="button"
        onClick={onTemizle}
        className="mt-6 rounded-lg border border-border px-4 py-2.5 text-sm transition-colors hover:border-accent"
      >
        Filtreyi temizle
      </button>
    </div>
  );
}

/** Okunmuş içerikte özet gösterilmiyor: satırın işi "açayım mı?" sorusuna cevap
 *  vermek; o karar verilmişse özet yalnızca gürültü. */
function ozet(item: FeedItem): string | null {
  return item.is_read ? null : cleanSummary(item.summary);
}

/** Boş ekran bir çıkmaz değil, bir davet: ne olduğunu söyler ve tek bir yol gösterir. */
function BosDurum() {
  return (
    <div className="mt-12 max-w-md">
      <p className="text-[15px] font-medium">Akışın henüz boş.</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Akış, takip ettiğin kaynaklar yeni bir şey yayımladıkça dolar. Kaynakları Keşfet
        sayfasından ekleyebilirsin — ilgi alanlarına göre öneri gelir.
      </p>
      <Link
        href="/discover"
        className="mt-6 inline-block rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        Kaynak ekle
      </Link>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="mt-10 grid grid-cols-1 gap-x-8 sm:grid-cols-[10rem_1fr]" aria-hidden>
      <div className="pt-6">
        <div className="h-5 w-20 animate-pulse rounded bg-surface" />
      </div>
      <div className="border-l border-border pl-5 sm:pl-7">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex animate-pulse gap-4 py-3.5">
            <div className="h-[72px] w-32 shrink-0 rounded-md bg-surface" />
            <div className="flex-1 space-y-2.5 py-1.5">
              <div className="h-3.5 w-4/5 rounded bg-surface" />
              <div className="h-3 w-1/3 rounded bg-surface" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
