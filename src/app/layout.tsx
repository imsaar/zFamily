import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { ConfirmProvider } from "@/components/ConfirmProvider";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "zFamily — Family Hub",
  description: "Family calendar, chores, meals, and weather at a glance.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#fafaf9",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full`}>
      <body className="flex flex-col overflow-hidden">
        <ConfirmProvider>{children}</ConfirmProvider>
      </body>
    </html>
  );
}
