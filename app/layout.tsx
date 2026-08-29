import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

// Manşet: Archivo'nun genişlik ekseniyle gazete gotiği duruşu.
const archivo = localFont({
  src: "./fonts/Archivo.ttf",
  variable: "--font-archivo",
  weight: "100 900",
  display: "swap",
});
// Gövde/okuma: bu bir okuma ürünü, o yüzden serif. Roman + italik ayrı dosya.
const newsreader = localFont({
  src: [
    { path: "./fonts/Newsreader.ttf", style: "normal", weight: "200 800" },
    { path: "./fonts/Newsreader-Italic.ttf", style: "italic", weight: "200 800" },
  ],
  variable: "--font-newsreader",
  display: "swap",
});

const SITE = "https://contenthub-self-nine.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  // `default` + `template`: alt sayfalar kendi başlığını verirse "X · ContentHub"
  // olur, vermezse tam başlık düşer. Sekmede ve paylaşımda ad hep görünür.
  title: {
    default: "ContentHub — takip ettiklerin, sırasıyla",
    template: "%s · ContentHub",
  },
  description:
    "İlgi alanlarını seç, takip etmeye değer kaynakları öğren, hepsini tek bir zaman sıralı akışta oku.",
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: SITE,
    siteName: "ContentHub",
    title: "ContentHub — takip ettiklerin, sırasıyla",
    description:
      "Kaynakları sen seçersin, sıralamayı zaman yapar. Öneri motoru yok, sonsuz kaydırma yok.",
  },
  twitter: {
    card: "summary_large_image",
    title: "ContentHub — takip ettiklerin, sırasıyla",
    description: "Kaynakları sen seçersin, sıralamayı zaman yapar.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${archivo.variable} ${newsreader.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
