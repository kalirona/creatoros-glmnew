import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { ClerkProvider } from "@clerk/nextjs";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CreatorOS — The All-in-One Platform for Creators",
  description: "Sell courses, products, and memberships. Build a community. Grow your audience. Create content 10x faster with AI. Everything a creator needs, in one premium platform.",
  keywords: ["creator platform", "online courses", "digital products", "membership", "community", "email marketing", "AI tools"],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
        >
          <ThemeProvider>
            {children}
            <Toaster />
            <SonnerToaster position="bottom-right" richColors closeButton />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
