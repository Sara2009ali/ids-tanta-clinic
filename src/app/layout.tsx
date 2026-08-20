import type { Metadata } from "next";
import { Inter, Geist_Mono, Newsreader, Noto_Sans_Arabic } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { LocaleProvider } from "@/components/locale-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { getLocale } from "@/lib/i18n/server";
import { directionFor } from "@/lib/i18n/cookie";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans-latin",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Editorial serif reserved for headings and hero figures only — pairing it
// with the neutral sans grotesk for body/UI chrome is what gives the product
// a designed, premium feel instead of reading as one more Inter-everywhere
// admin template. Kept to a narrow weight range; italic isn't used anywhere.
const newsreader = Newsreader({
  variable: "--font-serif-latin",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// Neither Inter nor Newsreader ships Arabic glyphs — this is the Arabic
// fallback for both body text and headings when dir="rtl" (see globals.css's
// `[dir="rtl"]` block, which swaps --font-sans/--font-serif to lead with
// this stack). No separate Arabic serif is loaded: headings fall back to
// this sans face in Arabic rather than a mismatched/absent serif.
const notoSansArabic = Noto_Sans_Arabic({
  variable: "--font-sans-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Dentra",
  description: "Dental practice management, done right.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      dir={directionFor(locale)}
      suppressHydrationWarning
      className={`${inter.variable} ${notoSansArabic.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <LocaleProvider>
            <TooltipProvider>{children}</TooltipProvider>
            <Toaster />
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
