import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AppRabbit | Sales Dashboard",
  description: "Pipeline, commissions, and payment tracking for AppRabbit",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground">
        <ThemeProvider>
          <Sidebar />
          <main className="md:pl-[240px]">
            <div className="px-4 pt-16 pb-6 md:px-6 md:pt-6 md:pb-6">
              {children}
            </div>
          </main>
        </ThemeProvider>
      </body>
    </html>
  );
}
