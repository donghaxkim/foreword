import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-ui"
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-brand",
  weight: ["500", "600"]
});

export const metadata: Metadata = {
  title: "Foreword",
  description: "A premium drafting surface for thoughtful writing."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${cormorant.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
