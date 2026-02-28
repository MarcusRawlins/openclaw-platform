import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Summit HVAC Solutions | Richmond VA Heating & Cooling",
  description: "Richmond's trusted HVAC experts. AC repair, heating services, installation, and maintenance. 24/7 emergency service. Call (804) 555-1234 for a free estimate.",
  keywords: "HVAC, heating, cooling, AC repair, Richmond VA, air conditioning, furnace repair, HVAC installation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
