import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/PwaRegister";
import { body, pixel } from "./fonts";

export const metadata: Metadata = {
  title: "Kernel Clash — an operating-systems creature battler",
  description: "A creature-battler that teaches operating systems from system calls to interview level. Answer right to land your moves.",
  // iPhone "Add to Home Screen": open full-screen like an app
  appleWebApp: { capable: true, title: "Kernel Clash", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#100e24",
  // let fixed bottom bars sit above the iPhone home indicator (safe-area insets)
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${pixel.variable} ${body.variable} h-full`}>
      <body className="min-h-full">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
