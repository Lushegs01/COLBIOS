import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});

const SITE_URL = "https://colbios-dues.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "COLBIOS Dues | Pay Student Dues Online",
  description:
    "Securely pay your COLBIOS student dues online and get instant payment confirmation.",
  openGraph: {
    title: "COLBIOS Dues | Pay Student Dues Online",
    description:
      "Securely pay your COLBIOS student dues online and get instant payment confirmation.",
    url: SITE_URL,
    siteName: "COLBIOS Dues",
    locale: "en_NG",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "COLBIOS Dues | Pay Student Dues Online",
    description:
      "Securely pay your COLBIOS student dues online and get instant payment confirmation.",
  },
};

export const viewport: Viewport = {
  themeColor: "#FAFAF8",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
