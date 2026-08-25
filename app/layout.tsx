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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
