import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { SiteChrome } from "@/components/site-chrome";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "FLY — The Internet’s Fly CNS",
  description: "Every neuron is real. Every connection is real. Find yours. Male CNS v1.0.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  openGraph: {
    title: "FLY — The Internet’s Fly CNS",
    description: "Every neuron is real. Every connection is real. Find yours.",
    images: ["/api/og?kind=site"],
  },
  twitter: {
    card: "summary_large_image",
    title: "FLY — The Internet’s Fly CNS",
    description: "Every neuron is real. Every connection is real. Find yours.",
    images: ["/api/og?kind=site"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sans.className} ${sans.variable} ${mono.variable} antialiased`}>
        <Providers>
          <SiteChrome>{children}</SiteChrome>
        </Providers>
      </body>
    </html>
  );
}
