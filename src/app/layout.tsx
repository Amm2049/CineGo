import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
    default: "CineGo — Modern Cinema Experience",
    template: "%s | CineGo",
  },
  description:
    "Discover premier movies, reserve premium seats, and experience cinema with instant digital QR passes and personalized AI curation.",
  keywords: ["cinema", "movie tickets", "booking", "seat selection", "CineGo", "IMAX", "Dolby Atmos"],
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-[#03030d] text-[#ffffff] selection:bg-[#2500f0] selection:text-white relative">
        {/* Monochromatic #2500f0 Electric Cobalt Ambient Atmospheric Lighting */}
        <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
          {/* Intense Upper Electric Cobalt Core */}
          <div className="absolute -top-40 left-1/4 w-[750px] h-[750px] bg-[#2500f0]/28 rounded-full blur-[140px] opacity-90" />

          {/* Right Lateral Cobalt Glow */}
          <div className="absolute top-1/4 -right-40 w-[650px] h-[650px] bg-[#2500f0]/22 rounded-full blur-[150px] opacity-80" />

          {/* Lower Horizon Glow */}
          <div className="absolute bottom-5 left-10 w-[700px] h-[700px] bg-[#2500f0]/18 rounded-full blur-[160px] opacity-70" />
        </div>

        {children}
      </body>
    </html>
  );
}
