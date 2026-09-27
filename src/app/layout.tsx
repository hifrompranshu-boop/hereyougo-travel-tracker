import type { Metadata } from "next";
import Script from "next/script";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
});

export const metadata: Metadata = {
  title: "Voyage — AI Itinerary Planner",
  description: "Plan your perfect trip with AI-powered day-by-day itineraries",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('voyage-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}})()`,
          }}
        />
      </head>
      <body
        className="app-canvas flex min-h-full flex-col font-sans text-foreground"
        suppressHydrationWarning
      >
                <Providers>{children}</Providers>
        <Script
          src="/maya-widget.js"
          strategy="afterInteractive"
          data-maya-widget=""
          data-phone="15551609401"
          data-message="Hi Maya - I found you on hereyougo.me."
          data-label="Chat with Maya"
          data-brand="Maya"
          data-mode="chat"
          data-accent="#25D366"
          data-backend-base-url="https://movements-andrew-demonstration-spray.trycloudflare.com"
        />
      </body>
    </html>
  );
}
