import type { Metadata } from "next";
import { Be_Vietnam_Pro, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-sans",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

// Runs before React hydrates so the theme is applied before first paint.
// Mirrors the resolution logic in ThemeProvider.
const NO_FLASH_THEME_SCRIPT = `(function(){try{var p=localStorage.getItem('karaoke_theme')||'system';var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var t=d?'dark':'light';document.documentElement.setAttribute('data-theme',t);document.documentElement.style.colorScheme=t;}catch(e){document.documentElement.setAttribute('data-theme','dark');document.documentElement.style.colorScheme='dark';}})();`;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const APP_DESCRIPTION =
  "Ứng dụng chọn bài hát Karaoke thời gian thực từ điện thoại lên TV cực kỳ mượt mà.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    template: "%s | Karaoke Party",
    default: "Karaoke Party - Hát cùng nhau",
  },
  description: APP_DESCRIPTION,
  keywords: [
    "Karaoke",
    "YouTube beat",
    "Party",
    "Real-time",
    "Chọn bài trên điện thoại",
  ],
  manifest: "/favicon/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon/favicon.ico", sizes: "any" },
      { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/favicon/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    type: "website",
    siteName: "Karaoke Party",
    title: "Karaoke Party - Hát cùng nhau",
    description: APP_DESCRIPTION,
    images: [
      { url: "/og-image.jpg", width: 1200, height: 630, alt: "Karaoke Party" },
    ],
    locale: "vi_VN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Karaoke Party - Hát cùng nhau",
    description: APP_DESCRIPTION,
    images: ["/og-image.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      data-theme="dark"
      className={`${beVietnamPro.variable} ${spaceGrotesk.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
