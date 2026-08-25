'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { decodeEntities } from '@/lib/feed';
import { unfollowSource } from '@/lib/profile';
import {
  genelOzet,
  kaynakOzetleri,
  sessizKaynaklar,
  haftalikAkis,
  turDagilimi,
  cubukYuzdesi,
  sureMetni,
  SESSIZ_GUN,
  type KarneSatiri,
  type KaynakOzeti,
  type HaftaKutusu,
} from '@/lib/stats';
import NavBar from '@/app/components/NavBar';

/* Akıştaki 300'lük pencere burada YETMEZ: karne "akışının tamamı" hakkında bir
   iddia, en yeni 300 kayıt hakkında değil. Kırpılmış veriyle "%2'sini okudun"
   demek yanlış olurdu. */
const KARNE_LIMIT = 2000;
const HAFTA_SAYISI = 12;

const TUR_ADI: Record<string, string> = {
  youtube: 'Video', blog: 'Blog', x: 'X', academic: 'Akademik',
};

const TUR_RENK: Record<string, string> = {
  youtube: 'bg-source-youtube', blog: 'bg-source-blog',
  x: 'bg-source-x', academic: 'bg-source-academic',
};

/* Soluk hâl için AYRI sınıf gerekiyor, `opacity-*` DEĞİL: CSS'te opacity tüm alt
   ağaca uygulanır ve çocuk ebeveyninden daha opak olamaz — iç içe çubuklarda
   "okunan" bölüm dış çubukla aynı saydamlıkta çizilip kayboluyordu. `/30` ise
   yalnızca arka plan RENGİNE alfa uygular. */
const TUR_RENK_SOLUK: Record<string, string> = {
  youtube: 'bg-source-youtube/30', blog: 'bg-source-blog/30',
  x: 'bg-source-x/30', academic: 'bg-source-academic/30',
};

export default function KarnePage() {
  const supabase = createClient();
  const [satirlar, setSatirlar] = useState<KarneSatiri[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [takipSayisi, setTakipSayisi] = useState(0);
  const [birakilan, setBirakilan] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      if (!data.user) setLoading(false);
    });
  }, [supabase]);

  useEffect(() => {
    if (!userId) return;

    async function load() {
      try {
        const { data: follows, error: fErr } = await supabase
          .from('follows').select('source_id').eq('user_id', userId);
        if (fErr) setError(fErr.message);
        const sourceIds = (follows ?? []).map((f) => f.source_id);
        setTakipSayisi(sourceIds.length);
        if (sourceIds.length === 0) return setSatirlar([]);

        const { data: rows, error: cErr } = await supabase
          .from('content_items')
          .select('id, source_id, content_type, published_at, sources(name)')
          .in('source_id', sourceIds)
          .limit(KARNE_LIMIT);
        if (cErr) setError(cErr.message);

        const ids = (rows ?? []).map((r) => r.id);
        const { data: durum, error: dErr } = ids.length > 0
          ? await supabase
              .from('user_content_status')
              .select('content_item_id, read_at, saved_at')
              .eq('user_id', userId)
              .in('content_item_id', ids)
          : { data: [], error: null };
        if (dErr) setError(dErr.message);

        const okunan = new Set((durum ?? []).filter((d) => d.read_at).map((d) => d.content_item_id));
        const kayitli = new Set((durum ?? []).filter((d) => d.saved_at).map((d) => d.content_item_id));

        setSatirlar(
          (rows ?? []).map((r) => ({
            source_id: r.source_id,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            source_name: decodeEntities((r.sources as any)?.name ?? 'Bilinmeyen kaynak'),
            content_type: r.content_type,
            published_at: r.published_at,
            is_read: okunan.has(r.id),
            is_saved: kayitli.has(r.id),
          })),
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [supabase, userId]);

  // Takibi bırakılan kaynak listeden ANINDA düşüyor; sayfayı yeniden yüklemek
  // gerekmesin diye bütün türetilenler bu süzgeçten geçiyor.
  const aktif = useMemo(
    () => satirlar.filter((s) => !birakilan.has(s.source_id)),
    [satirlar, birakilan],
  );

  const ozet = useMemo(() => genelOzet(aktif), [aktif]);
  const kaynaklar = useMemo(() => kaynakOzetleri(aktif), [aktif]);
  const sessizler = useMemo(() => sessizKaynaklar(kaynaklar), [kaynaklar]);
  const haftalar = useMemo(() => haftalikAkis(aktif, new Date(), HAFTA_SAYISI), [aktif]);
  const turler = useMemo(() => turDagilimi(aktif), [aktif]);

  // Okuma karşılaştırması ORANA göre sıralanıyor, adede göre değil: her besleme
  // çekilişte ~15 içerik döndürdüğü için kaynak adetleri birbirine çok yakın
  // çıkıyor (33/24/20/18…) ve sıralama olarak neredeyse hiçbir şey ayırt etmiyor.
  const oranaGore = useMemo(
    () => [...kaynaklar].sort((a, b) => b.okumaOrani - a.okumaOrani || b.toplam - a.toplam),
    [kaynaklar],
  );

  async function takibiBirak(k: KaynakOzeti) {
    if (!userId) return;
    setBirakilan((o) => new Set(o).add(k.id));
    try {
      await unfollowSource(supabase, userId, k.id);
      setTakipSayisi((n) => Math.max(0, n - 1));
    } catch (err) {
      setBirakilan((o) => { const y = new Set(o); y.delete(k.id); return y; });
      setError(err instanceof Error ? err.message : 'Takip bırakılamadı');
    }
  }

  return (
    <div>
      <NavBar />
      <div className="mx-auto mt-10 max-w-5xl px-6 pb-24">
        <h1 className="text-2xl font-medium tracking-tight">Okuma karnesi</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          Takip listesi kendiliğinden bakımlı kalmıyor. Bu sayfa neyin geldiğini, neyi
          açtığını ve hangi kaynakların çoktan sustuğunu gösterir.
        </p>

        {error && (
          <p className="mt-4 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}

        {loading ? (
          <Iskelet />
        ) : ozet.toplam === 0 ? (
          <BosKarne />
        ) : (
          <>
            <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-4">
              {/* "Takip edilen" DEĞİL: bu sayı içerik ÜRETEN kaynakları sayıyor.
                  Aradaki fark tam da karnenin söylemesi gereken şey. */}
              <Sayi
                etiket="İçerik gelen kaynak"
                deger={ozet.kaynakSayisi}
                alt={takipSayisi > ozet.kaynakSayisi ? `/ ${takipSayisi} takip` : undefined}
              />
              <Sayi etiket="Akıştaki içerik" deger={ozet.toplam} />
              <Sayi etiket="Okudun" deger={ozet.okunan} alt={`%${ozet.okumaYuzdesi}`} />
              <Sayi etiket="Sonra oku" deger={ozet.kaydedilen} />
            </dl>

            <HaftalikAkis haftalar={haftalar} />

            <SessizKaynaklar
              sessizler={sessizler}
              toplamKaynak={kaynaklar.length}
              onBirak={takibiBirak}
            />

            <OkumaKarsilastirmasi kaynaklar={oranaGore} />

            <section className="mt-16 border-t border-border pt-10">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
                Tür dağılımı
              </h2>
              <dl className="mt-8 grid gap-6 sm:grid-cols-2">
                {turler.map((t) => (
                  <div key={t.tur} className="flex items-baseline gap-3">
                    <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${TUR_RENK[t.tur] ?? 'bg-muted'}`} />
                    <dt className="text-sm">{TUR_ADI[t.tur] ?? t.tur}</dt>
                    <dd className="ml-auto font-mono text-xs text-muted">
                      {t.toplam} içerik · {t.okunan} okundu
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Haftalık akış: sayfanın tek dikey grafiği ───────────────────────────── */
function HaftalikAkis({ haftalar }: { haftalar: HaftaKutusu[] }) {
  const enBuyuk = Math.max(...haftalar.map((h) => h.toplam), 0);
  const toplam = haftalar.reduce((t, h) => t + h.toplam, 0);
  const okunan = haftalar.reduce((t, h) => t + h.okunan, 0);

  return (
    <section className="mt-16">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
        Son {haftalar.length} hafta
      </h2>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
        Bu dönemde {toplam} içerik geldi, {okunan} tanesini açtın. Sütunun parlak alt
        bölümü okuduğun kısım.
      </p>

      <div className="mt-8 flex h-40 items-end gap-2 sm:gap-3">
        {haftalar.map((h) => (
          <div key={h.baslangic} className="flex h-full flex-1 flex-col justify-end gap-2">
            {/* Boş haftada bile 2px'lik taban çiziliyor: kayıp sütun ile sıfır
                sütunu farklı şeyler, eksen sürekli görünmeli. */}
            <div
              className="w-full rounded-sm bg-accent/30"
              style={{
                height: `${cubukYuzdesi(h.toplam, enBuyuk)}%`,
                minHeight: '2px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
              }}
              title={`${h.etiket}: ${h.toplam} içerik, ${h.okunan} okundu`}
            >
              <div
                className="w-full rounded-sm bg-accent"
                style={{
                  height: `${cubukYuzdesi(h.okunan, h.toplam)}%`,
                  minHeight: h.okunan > 0 ? '3px' : 0,
                }}
              />
            </div>
            <span className="text-center font-mono text-[9px] leading-none text-muted">
              {h.etiket}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Sessiz kaynaklar: karnenin en eyleme dönük bölümü ───────────────────── */
function SessizKaynaklar({
  sessizler, toplamKaynak, onBirak,
}: {
  sessizler: KaynakOzeti[];
  toplamKaynak: number;
  onBirak: (k: KaynakOzeti) => void;
}) {
  return (
    <section className="mt-16 border-t border-border pt-10">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
        Sessiz kaynaklar
      </h2>
      {sessizler.length === 0 ? (
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
          {toplamKaynak} kaynağın hepsi son {SESSIZ_GUN} gün içinde yayın yapmış. Liste temiz.
        </p>
      ) : (
        <>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
            {sessizler.length} kaynak {SESSIZ_GUN} günden uzun süredir sessiz. Akışında yer
            kaplıyorlar ama yeni bir şey getirmiyorlar.
          </p>
          <ul className="mt-8 divide-y divide-border">
            {sessizler.map((k) => (
              <li key={k.id} className="flex items-center gap-4 py-3.5">
                <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${TUR_RENK[k.tur] ?? 'bg-muted'}`} />
                <span className="min-w-0 flex-1 truncate text-sm">{k.ad}</span>
                <span className="shrink-0 font-mono text-xs text-muted">{sureMetni(k.gunOnce)}</span>
                <button
                  type="button"
                  onClick={() => onBirak(k)}
                  className="shrink-0 rounded-md border border-border px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:border-red-900 hover:text-red-300"
                >
                  Takibi bırak
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/* ── Okuma karşılaştırması ───────────────────────────────────────────────── */
function OkumaKarsilastirmasi({ kaynaklar }: { kaynaklar: KaynakOzeti[] }) {
  const enBuyuk = Math.max(...kaynaklar.map((k) => k.toplam), 0);

  return (
    <section className="mt-16 border-t border-border pt-10">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
        Neyi gerçekten okuyorsun
      </h2>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
        Okuma oranına göre sıralı. Soluk çubuk kaynağın ürettiği içerik; içindeki parlak
        bölüm senin açtığın kısım.
      </p>

      <ul className="mt-8 space-y-5">
        {kaynaklar.map((k) => (
          <li key={k.id}>
            <div className="flex items-baseline justify-between gap-4">
              <span className="truncate text-sm">{k.ad}</span>
              <span className="shrink-0 font-mono text-xs text-muted">
                {k.okunan > 0 ? `%${k.okumaOrani} · ${k.okunan}/${k.toplam}` : `hiç · ${k.toplam}`}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface">
              <div
                className={`h-full rounded-full ${TUR_RENK_SOLUK[k.tur] ?? 'bg-muted/30'}`}
                style={{ width: `${cubukYuzdesi(k.toplam, enBuyuk)}%` }}
              >
                {/* minWidth: sıfır OLMAYAN bir değer hiç görünmemeli değil. */}
                <div
                  className={`h-full rounded-full ${TUR_RENK[k.tur] ?? 'bg-muted'}`}
                  style={{
                    width: `${cubukYuzdesi(k.okunan, k.toplam)}%`,
                    minWidth: k.okunan > 0 ? '6px' : 0,
                  }}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Sayi({ etiket, deger, alt }: { etiket: string; deger: number; alt?: string }) {
  return (
    <div>
      <dd className="font-mono text-[clamp(1.6rem,3.4vw,2.4rem)] font-medium leading-none tracking-tight">
        {deger}
        {alt && <span className="ml-2 text-base text-muted">{alt}</span>}
      </dd>
      <dt className="mt-2 text-xs leading-relaxed text-muted">{etiket}</dt>
    </div>
  );
}

/** Karne yalnızca akış doluyken bir şey söyler; boşken kullanıcıyı akışa yollar. */
function BosKarne() {
  return (
    <div className="mt-12 max-w-md">
      <p className="text-[15px] font-medium">Henüz karne çıkaracak veri yok.</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Karne, takip ettiğin kaynaklardan gelen içerikleri ve neleri açtığını karşılaştırır.
        Önce birkaç kaynak ekle.
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

function Iskelet() {
  return (
    <div className="mt-10 animate-pulse" aria-hidden>
      <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i}>
            <div className="h-8 w-16 rounded bg-surface" />
            <div className="mt-2 h-3 w-24 rounded bg-surface" />
          </div>
        ))}
      </div>
      <div className="mt-16 flex h-40 items-end gap-3">
        {[40, 70, 55, 90, 35, 60, 80, 45, 65, 50, 75, 55].map((h, i) => (
          <div key={i} className="flex-1 rounded-sm bg-surface" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}
