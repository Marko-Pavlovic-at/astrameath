import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Astrameath",
    template: "%s — Astrameath",
  },
  description: "Level up your life.",
};

export const viewport: Viewport = {
  themeColor: "#06080f",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* svh, not dvh: dvh changes as the mobile URL bar slides, relaying out
          the page mid-scroll and dragging the fixed bottom bars with it */}
      <body className="min-h-svh bg-bg font-sans text-fg">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
