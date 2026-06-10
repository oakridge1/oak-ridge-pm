import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { COMPANY_NAME, COMPANY_DBA, BRAND_BLUE } from "@/lib/company";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${COMPANY_DBA} — Project Management`,
  description: `Internal project management for ${COMPANY_NAME}`,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: BRAND_BLUE,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geist.variable} h-full`}>
      <body className="h-full bg-[#f8f9fa] text-[#1a1a1a] antialiased">
        {children}
      </body>
    </html>
  );
}
