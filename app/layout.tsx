import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Видео-чат WebRTC",
  description: "Простой видео-чат на WebRTC и Next.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
