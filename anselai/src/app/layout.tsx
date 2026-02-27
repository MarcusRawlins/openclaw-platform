import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AnselAI",
  description: "Photography CRM",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <nav className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-8">
                <Link href="/" className="text-xl font-bold text-gray-900">
                  AnselAI
                </Link>
                <div className="flex gap-6">
                  <Link
                    href="/contacts"
                    className="text-gray-700 hover:text-gray-900 font-medium"
                  >
                    Contacts
                  </Link>
                  <Link
                    href="/pipeline"
                    className="text-gray-700 hover:text-gray-900 font-medium"
                  >
                    Pipeline
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
