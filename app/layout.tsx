import type React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { initializeDatabase } from "@/lib/database";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Cash-Box",
  description: "Create professional receipts for your business",
  generator: "v0.dev",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await initializeDatabase();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
