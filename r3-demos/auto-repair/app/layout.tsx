import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Precision Auto Care | Richmond, VA Auto Repair Shop",
  description: "ASE-certified auto repair in Richmond, VA. Oil changes, brakes, engine repair, and more. Honest service, expert care since 2008. Call (804) 555-7890.",
  keywords: "auto repair Richmond VA, mechanic Richmond, oil change Richmond, brake service, engine repair",
  openGraph: {
    title: "Precision Auto Care | Richmond, VA",
    description: "Honest Service. Expert Care. ASE-certified mechanics serving Richmond since 2008.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
