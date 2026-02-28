import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sarah Mitchell | Luxury Real Estate Agent | Greensboro, NC",
  description: "Your trusted partner in luxury real estate. Over 15 years of experience helping buyers and sellers in Greensboro and the Triad area. $450M+ in total sales.",
  keywords: "luxury real estate, Greensboro NC, real estate agent, homes for sale, luxury homes, Sarah Mitchell",
  openGraph: {
    title: "Sarah Mitchell | Luxury Real Estate Agent",
    description: "Your trusted partner in luxury real estate in Greensboro, NC",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://images.unsplash.com" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
