import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ContentHub — takip ettiklerin, sırasıyla',
  description:
    'İlgi alanlarını seç, takip etmeye değer kaynakları öğren, hepsini tek bir zaman sıralı akışta oku. Algoritma yok.',
};

/* Örnek akış GERÇEK verilerden alındı (2026-08-25, canlı veritabanı). Uydurma
   başlık yok: sayfanın iddiası "bu çalışıyor" olduğu için örneğin de gerçek
   olması gerekiyor. Blog başlıklarındaki tire kaynak RSS'inde `&#8211;` olarak
   geliyor — burada çözülmüş hâli yazılı (akıştaki çözme hatası ayrı iş). */
type Girdi = { baslik: string; kaynak: string; tur: 'youtube' | 'blog' };

const AKIS: { gun: string; tarih: string; girdiler: Girdi[] }[] = [
  {
    gun: '24 AĞU',
    tarih: '2026-08-24',
    girdiler: [
      { baslik: 'Yabancı dilde seküler kelimesini çok duymuyorum!', kaynak: 'Mahalle Yanarken', tur: 'youtube' },
      { baslik: '“Bizim millet çocuk yaşta köreltiliyor” — Coşkun Aral & Emrah Safa Gürkan', kaynak: 'OMNIBUS', tur: 'youtube' },
      { baslik: 'It’s impossible to choose a number at random', kaynak: 'Veritasium', tur: 'youtube' },
    ],
  },
  {
    gun: '23 AĞU',
    tarih: '2026-08-23',
    girdiler: [
      { baslik: 'Ölüyü gömemezsen ne yaparsın? — Coşkun Aral & Emrah Safa Gürkan', kaynak: 'OMNIBUS', tur: 'youtube' },
      { baslik: 'Moxo360 Testi Sertifikasyon Eğitimi', kaynak: 'Moxo Türkiye', tur: 'youtube' },
    ],
  },
  {
    gun: '22 TEM',
    tarih: '2026-07-22',
    girdiler: [
      { baslik: 'Don’t fall for Project Smear, Mr Burnham – Unherd op-ed', kaynak: 'Yanis Varoufakis Blog', tur: 'blog' },
      { baslik: 'AI and the false consciousness trap – Unherd', kaynak: 'Yanis Varoufakis Blog', tur: 'blog' },
    ],
  },
];

const NOKTA: Record<Girdi['tur'], string> = {
  youtube: 'bg-source-youtube',
  blog: 'bg-source-blog',
};

/* Numaralı: bu gerçekten bir sıra. Kaynak önerisi gelmeden akış dolmuyor,
   ilgi alanı seçilmeden öneri gelmiyor. Sıra bilgi taşıyor, süs değil. */
const ADIMLAR = [
  {
    baslik: 'İlgi alanlarını seç',
    metin: 'Kozmolojiden siber güvenliğe, ne okumak istediğini sen söylersin. Liste sabit değil, sonradan değiştirirsin.',
  },
  {
    baslik: 'Önerileri gözden geçir',
    metin: 'Claude web’de arayıp o alanlarda takip edilmeye değer kişi ve yayınları bulur. Her öneriyi tek tek onaylar ya da geçersin.',
  },
  {
    baslik: 'Akışını oku',
    metin: 'Onayladığın kaynaklar dört saatte bir taranır. Yeni ne çıktıysa yayımlanma sırasına göre akışta görünür.',
  },
];

export default function Landing() {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      {/* ── üst şerit ──────────────────────────────────────────── */}
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <span className="font-mono text-sm tracking-tight">
            ContentHub<span className="text-accent">.</span>
          </span>
          <Link
            href="/feed"
            className="rounded-lg border border-border px-4 py-2 font-mono text-xs text-muted transition-colors hover:border-accent hover:text-foreground"
          >
            Giriş yap
          </Link>
        </div>
      </header>

      {/* ── hero ───────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pb-20 pt-24 sm:pt-32">
        <h1 className="ch-yukselt max-w-3xl text-[clamp(2.3rem,6.6vw,4.8rem)] font-extralight leading-[1.04] tracking-[-0.035em]">
          Takip ettiklerin ne yayımladıysa,
          <br />
          <span className="font-mono font-medium tracking-[-0.05em] text-accent">sırasıyla.</span>
        </h1>
        <p className="ch-yukselt ch-gecikme-1 mt-8 max-w-xl text-[17px] leading-relaxed text-muted">
          Kaynakları sen seçersin, sıralamayı zaman yapar. Öneri motoru yok, sonsuz kaydırma yok —
          sadece takip ettiğin insanların yeni işleri.
        </p>
        <div className="ch-yukselt ch-gecikme-2 mt-10 flex flex-wrap items-center gap-3">
          <Link
            href="/feed"
            className="rounded-lg bg-accent px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Akışını kur
          </Link>
          <a
            href="https://github.com/Tarikd-a11b/contenthub"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-border px-5 py-3 font-mono text-xs text-muted transition-colors hover:border-accent hover:text-foreground"
          >
            Kaynak kodu
          </a>
        </div>
      </section>

      {/* ── zaman omurgası ─────────────────────────────────────── */}
      <section className="border-y border-border bg-surface/40">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <p className="mb-10 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">
            Örnek akış · 33 kaynak · 237 içerik
          </p>

          {AKIS.map((grup) => (
            <div key={grup.gun} className="grid grid-cols-1 gap-x-10 sm:grid-cols-[9rem_1fr]">
              {/* Tarih sayfanın en büyük tipografisi. Bilinçli tersine çevirme:
                  ürünün tek iddiası sıralamayı zamanın yapması, o yüzden en çok
                  yer kaplayan şey başlık değil tarih. */}
              <div className="pt-6">
                <time
                  dateTime={grup.tarih}
                  className="block font-mono text-[clamp(1.35rem,3vw,2rem)] font-medium leading-none tracking-tight text-muted"
                >
                  {grup.gun}
                </time>
              </div>

              <ul className="border-l border-border pl-6 sm:pl-8">
                {grup.girdiler.map((g) => (
                  <li key={g.baslik} className="relative py-4">
                    <span
                      aria-hidden
                      className={`absolute top-[1.6rem] h-1.5 w-1.5 rounded-full -left-[1.6875rem] sm:-left-[2.1875rem] ${NOKTA[g.tur]}`}
                    />
                    <p className="text-[15px] font-medium leading-snug">{g.baslik}</p>
                    <p className="mt-1.5 font-mono text-xs tracking-wide text-muted">{g.kaynak}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── nasıl çalışır ──────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 py-20 sm:py-24">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Nasıl çalışır</h2>
        <ol className="mt-10 grid gap-10 sm:grid-cols-3 sm:gap-8">
          {ADIMLAR.map((adim, i) => (
            <li key={adim.baslik}>
              <span className="font-mono text-xs text-accent">{String(i + 1).padStart(2, '0')}</span>
              <h3 className="mt-3 text-lg font-medium tracking-tight">{adim.baslik}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{adim.metin}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── kaynak türleri ─────────────────────────────────────── */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-5xl px-6 py-20 sm:py-24">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Kaynak türleri</h2>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">
            Akıştaki her satırın yanındaki renk, içeriğin nereden geldiğini söyler.
          </p>
          <dl className="mt-10 grid gap-8 sm:grid-cols-2">
            <div className="flex gap-4">
              <span aria-hidden className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-source-youtube" />
              <div>
                <dt className="text-[15px] font-medium">YouTube kanalları</dt>
                <dd className="mt-1 text-sm leading-relaxed text-muted">
                  Kanal adresini verirsin, yeni videolar kapak görselleriyle akışa düşer.
                </dd>
              </div>
            </div>
            <div className="flex gap-4">
              <span aria-hidden className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-source-blog" />
              <div>
                <dt className="text-[15px] font-medium">Bloglar ve bültenler</dt>
                <dd className="mt-1 text-sm leading-relaxed text-muted">
                  RSS yayını olan her site çalışır; adresi verirsin, yayını ContentHub bulur.
                </dd>
              </div>
            </div>
          </dl>
          <p className="mt-10 border-t border-border pt-6 font-mono text-xs leading-relaxed text-muted">
            X ve akademik yayınlar için kaynak eklenebiliyor, içerik çekme henüz çalışmıyor.
          </p>
        </div>
      </section>

      {/* ── alt ────────────────────────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-10 font-mono text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>ContentHub · Next.js, Supabase, Claude</span>
          <a
            href="https://github.com/Tarikd-a11b/contenthub"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-foreground"
          >
            github.com/Tarikd-a11b/contenthub
          </a>
        </div>
      </footer>
    </main>
  );
}
