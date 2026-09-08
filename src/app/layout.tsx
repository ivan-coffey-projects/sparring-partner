import type { Metadata } from "next";
import { IBM_Plex_Mono, Manrope } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const description =
  "Self-hosted sales-training gym for live calls, SMS, email, and social DMs. Trainers author prospects and methodology scorecards; representatives get citation-backed debriefs. Never contacts real leads.";

export const metadata: Metadata = {
  title: { default: "Sparring Partner", template: "%s · Sparring Partner" },
  description,
  applicationName: "Sparring Partner",
  authors: [{ name: "Neonoodles" }],
  keywords: [
    "sales training",
    "sales enablement",
    "coaching",
    "self-hosted",
    "simulation",
  ],
  openGraph: {
    title: "Sparring Partner",
    description,
    type: "website",
    locale: "en_AU",
  },
  twitter: {
    card: "summary",
    title: "Sparring Partner",
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${manrope.variable} ${ibmPlexMono.variable} font-sans antialiased`}
      >
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
