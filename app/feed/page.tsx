'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  sortFeedByRecency,
  markAsRead,
  markManyAsRead,
  groupFeedByDay,
  feedPage,
  feedPageCount,
  decodeEntities,
  FEED_FETCH_LIMIT,
  toggleSaved,
  filterFeed,
  typeCounts,
  FILTRE_YOK,
  type FeedFilter,
  type FeedItem,
} from '@/lib/feed';
import NavBar from '@/app/components/NavBar';
import FeedGrid from '@/app/components/feed/FeedGrid';

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
  const pageItems = useMemo(() => feedPage(suzulmus, page), [suzulmus, page]);
  const groups = useMemo(() => groupFeedByDay(pageItems), [pageItems]);
  const okunmamis = items.filter((i) => !i.is_read).length;
  const turSayilari = useMemo(() => typeCounts(items), [items]);
  const kayitliSayisi = items.filter((i) => i.is_saved).length;
  const filtreliMi = filtre.unreadOnly || filtre.savedOnly || filtre.types.length > 0;

  // Filtre değişince sayfa 1'e dönmeli; yoksa 4. sayfadayken daraltma yapınca
  // boş bir sayfaya bakıyor olurdun.
  useEffect(() => { setPage(1); }, [filtre]);

  // Klavye gezinmesi: J/K odağı taşır, E arşivler (okundu say), S kaydeder,
  // Enter açar. Yazı kutusu odaktayken (bu sayfada yok ama ileride olabilir)
  // müdahale etmiyor.
  const [odakIndeksi, setOdakIndeksi] = useState(0);
  useEffect(() => {
    setOdakIndeksi((i) => (pageItems.length === 0 ? 0 : Math.min(i, pageItems.length - 1)));
  }, [pageItems.length]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const etiket = (document.activeElement?.tagName || '').toLowerCase();
      if (etiket === 'input' || etiket === 'textarea' || pageItems.length === 0) return;

      const secili = pageItems[odakIndeksi];
      switch (e.key.toLowerCase()) {
        case 'j':
          e.preventDefault();
          setOdakIndeksi((i) => Math.min(i + 1, pageItems.length - 1));
          break;
        case 'k':
          e.preventDefault();
          setOdakIndeksi((i) => Math.max(i - 1, 0));
          break;
        case 'e':
          if (secili) handleRead(secili);
          break;
        case 's':
          if (secili) handleSave(secili);
          break;
        case 'enter':
          if (secili) {
            handleRead(secili);
            window.open(secili.url, '_blank', 'noreferrer');
          }
          break;
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageItems, odakIndeksi]);

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

  /* ── Kaydırınca otomatik okundu ────────────────────────────────────────────
     Ekranda görünüp yukarıdan çıkan kartlar okundu sayılıyor. Geri alınamayan
     bir işlem olduğu için iki koruma var: (1) kart GERÇEKTEN görünmüş olmalı
     (FeedCard'daki `goruldu` kontrolü), (2) kullanıcı bunu kapatabiliyor ve
     tercih localStorage'da kalıcı.

     Yazmalar 800ms'lik bir pencerede biriktirilip TEK upsert'e indiriliyor:
     hızlı kaydırmada 20 karta 20 ayrı istek atmak yerine bir istek. */
  const [otomatikOkundu, setOtomatikOkundu] = useState(false);
  useEffect(() => {
    try {
      setOtomatikOkundu(window.localStorage.getItem('contenthub:autoRead') === 'acik');
    } catch {
      /* localStorage kapalı olabilir (gizli sekme, site verisi engelli) — varsayılan kapalı. */
    }
  }, []);

  function otomatikOkunduDegistir(acik: boolean) {
    setOtomatikOkundu(acik);
    try {
      window.localStorage.setItem('contenthub:autoRead', acik ? 'acik' : 'kapali');
    } catch {
      /* yazılamazsa tercih yalnızca bu oturum için geçerli olur */
    }
  }

  const bekleyen = useRef<Set<string>>(new Set());
  const zamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScrolledPast = useCallback(
    (item: FeedItem) => {
      if (!userId || !otomatikOkundu) return;
      bekleyen.current.add(item.id);
      if (zamanlayici.current) clearTimeout(zamanlayici.current);
      zamanlayici.current = setTimeout(async () => {
        const idler = Array.from(bekleyen.current);
        bekleyen.current.clear();
        if (idler.length === 0) return;
        // İyimser güncelleme: sayaç anında düşsün. Hata olursa geri alınıyor.
        setItems((prev) => prev.map((i) => (idler.includes(i.id) ? { ...i, is_read: true } : i)));
        try {
          await markManyAsRead(supabase, userId, idler);
        } catch (err) {
          setItems((prev) => prev.map((i) => (idler.includes(i.id) ? { ...i, is_read: false } : i)));
          setError(err instanceof Error ? err.message : 'Otomatik okundu işaretlenemedi');
        }
      }, 800);
    },
    [supabase, userId, otomatikOkundu],
  );

  // Sayfa kapanırken/ayrılırken bekleyen zamanlayıcıyı temizle.
  useEffect(() => () => { if (zamanlayici.current) clearTimeout(zamanlayici.current); }, []);

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
            otomatikOkundu={otomatikOkundu}
            setOtomatikOkundu={otomatikOkunduDegistir}
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
            <FeedGrid
              groups={groups}
              focusedId={pageItems[odakIndeksi]?.id ?? null}
              onRead={handleRead}
              onToggleSave={handleSave}
              onScrolledPast={handleScrolledPast}
            />

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
  otomatikOkundu, setOtomatikOkundu,
}: {
  filtre: FeedFilter;
  setFiltre: (f: FeedFilter) => void;
  turDegistir: (tur: string) => void;
  turSayilari: Record<string, number>;
  okunmamis: number;
  kayitli: number;
  otomatikOkundu: boolean;
  setOtomatikOkundu: (acik: boolean) => void;
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

      {/* Geri alınamayan bir davranış olduğu için kapatılabilir ve VARSAYILAN
          KAPALI: kullanıcı açtığında ne olacağını bilerek açsın. */}
      <button
        type="button"
        role="switch"
        aria-checked={otomatikOkundu}
        onClick={() => setOtomatikOkundu(!otomatikOkundu)}
        title="Açıkken, ekranda görünüp yukarı kaydırdığın içerikler okundu sayılır"
        className={`${temel} ml-auto ${otomatikOkundu ? acik : kapali}`}
      >
        <span
          aria-hidden
          className={`h-1.5 w-1.5 rounded-full ${otomatikOkundu ? 'bg-accent' : 'bg-muted'}`}
        />
        Kaydırınca okundu
      </button>
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
