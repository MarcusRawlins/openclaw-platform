import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Copper Table | Farm-to-Table Southern Cuisine | Richmond, VA",
  description: "Experience authentic farm-to-table Southern cuisine at The Copper Table in Richmond, VA. Locally sourced ingredients, upscale casual dining, and unforgettable flavors.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Lato:wght@300;400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
