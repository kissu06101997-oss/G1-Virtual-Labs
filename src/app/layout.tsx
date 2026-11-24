import type { Metadata } from "next";
import { Inter, Noto_Sans_Telugu } from "next/font/google";
import { getRequestLocale } from "@/lib/auth";
import "./globals.css";
import "./public-surfaces.css";
import "./creator-surfaces.css";
import "./homepage.css";
import "./premium-surfaces.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

const notoTelugu = Noto_Sans_Telugu({
  subsets: ["telugu"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-telugu",
  display: "swap",
});

export const metadata: Metadata = {
  title: "G1 Virtual Labs — Virtual Science Laboratories",
  description:
    "Explore Chemistry, Biology and Physics through guided practicals and interactive scientific inquiry.",
  openGraph: {
    siteName: "G1 Virtual Labs",
    title: "G1 Virtual Labs — Virtual Science Laboratories",
    description:
      "Explore Chemistry, Biology and Physics through guided practicals and interactive scientific inquiry.",
    type: "website",
  },
  icons: {
    icon: { url: "/brand/g1-virtual-labs-icon.svg", type: "image/svg+xml", sizes: "any" },
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();
  const langAttr = locale === "te-IN" ? "te" : "en";

  return (
    <html lang={langAttr} className={`${inter.variable} ${notoTelugu.variable}`}>
      <body className="antialiased">
        <a href="#main-content" className="skip-link">
          {locale === "te-IN" ? "ప్రధాన కంటెంట్‌కు వెళ్ళండి" : "Skip to main content"}
        </a>
        <div className="g1-bg-wave" aria-hidden="true" />
        <div className="relative z-10 flex min-h-screen flex-col">{children}</div>
      </body>
    </html>
  );
}
