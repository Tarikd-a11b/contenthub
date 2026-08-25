'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { decodeEntities } from '@/lib/feed';
import {
  genelOzet,
  kaynakOzetleri,
  turDagilimi,
  cubukYuzdesi,
  type KarneSatiri,
} from '@/lib/stats';
import NavBar from '@/app/components/NavBar';

/* Akıştaki 300'lük pencere burada YETMEZ: karne "akışının tamamı" hakkında bir
   iddia, en yeni 300 kayıt hakkında değil. Kırpılmış bir veriyle "%2'sini
   okudun" demek yanlış olurdu. */
const KARNE_LIMIT = 2000;

const TUR_ADI: Record<string, string> = {
  youtube: 'Video',
  blog: 'Blog',
  x: 'X',
  academic: 'Akademik',
};

const TUR_RENK: Record<string, string> = {
  youtube: 'bg-source-youtube',
  blog: 'bg-source-blog',
  x: 'bg-source-x',
  academic: 'bg-source-academic',
};

/* Soluk hâl için AYRI sınıf gerekiyor, `opacity-30` DEĞİL: CSS'te opacity tüm
   alt ağaca uygulanır ve çocuk ebeveyninden daha opak olamaz. Dış çubuğa
   opacity verince içindeki "okunan" bölümü de soluklaşıyor, ikisi birebir aynı
   görünüyordu — grafiğin bütün karşılaştırması kayboluyordu. `/30` ise yalnızca
   arka plan RENGİNE alfa uygular, çocuğu etkilemez. */
const TUR_RENK_SOLUK: Record<string, string> = {
  youtube: 'bg-source-youtube/30',
  blog: 'bg-source-blog/30',
  x: 'bg-source-x/30',
  academic: 'bg-source-academic/30',
};

export default function KarnePage() {
  const supabase = createClient();
  const [satirlar, setSatirlar] = useState<KarneSatiri[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [takipSayisi, setTakipSayisi] = useState(0);
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
          .select('id, source_id, content_type, sources(name)')
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

  const ozet = useMemo(() => genelOzet(satirlar), [satirlar]);
  const kaynaklar = useMemo(() => kaynakOzetleri(satirlar), [satirlar]);
  const turler = useMemo(() => turDagilimi(satirlar), [satirlar]);
  const enBuyuk = kaynaklar[0]?.toplam ?? 0;

  return (
    <div>
      <NavBar />
      <div className="mx-auto mt-10 max-w-5xl px-6 pb-24">
        <h1 className="text-2xl font-medium tracking-tight">Okuma karnesi</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
          Akışını kimin doldurduğu ile kimi okuduğun aynı şey değil. Aradaki fark,
          takip listeni gözden geçirmen gerektiğini söyler.
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
                  Aradaki fark tam da karnenin söylemesi gereken şey — takip
                  ettiğin bazı kaynaklardan hiç içerik gelmiyor. */}
              <Sayi
                etiket="İçerik gelen kaynak"
                deger={ozet.kaynakSayisi}
                alt={takipSayisi > ozet.kaynakSayisi ? `/ ${takipSayisi} takip` : undefined}
              />
              <Sayi etiket="Akıştaki içerik" deger={ozet.toplam} />
              <Sayi etiket="Okudun" deger={ozet.okunan} alt={`%${ozet.okumaYuzdesi}`} />
              <Sayi etiket="Sonra oku" deger={ozet.kaydedilen} />
            </dl>

            <section className="mt-16">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
                Akışını kim dolduruyor
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
                Soluk çubuk kaynağın ürettiği içerik; içindeki parlak bölüm senin açtığın kısım.
              </p>

              <ul className="mt-8 space-y-5">
                {kaynaklar.map((k) => (
                  <li key={k.id}>
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="truncate text-sm">{k.ad}</span>
                      <span className="shrink-0 font-mono text-xs text-muted">
                        {k.okunan > 0 ? `${k.okunan} / ${k.toplam}` : k.toplam}
                      </span>
                    </div>
                    {/* Çubuk iki katmanlı: dış katman kaynağın toplamı (tür rengi,
                        soluk), iç katman okuduğun kısım (aynı renk, tam yoğunluk).
                        Ayrı iki çubuk yerine iç içe: karşılaştırma böyle tek
                        bakışta okunuyor. */}
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface">
                      <div
                        className={`h-full rounded-full ${TUR_RENK_SOLUK[k.tur] ?? 'bg-muted/30'}`}
                        style={{ width: `${cubukYuzdesi(k.toplam, enBuyuk)}%` }}
                      >
                        {/* minWidth: sıfır OLMAYAN bir değer hiç görünmemeli değil.
                            5 okuma / 225 içerikte oran %2 ve çubuk fiilen kayboluyordu;
                            kesin sayı zaten sağda yazılı, çubuk yalnızca işaret ediyor. */}
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
      <div className="mt-16 space-y-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i}>
            <div className="h-3.5 w-40 rounded bg-surface" />
            <div className="mt-2 h-1.5 w-full rounded-full bg-surface" />
          </div>
        ))}
      </div>
    </div>
  );
}
