import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AXVYRA — Rebuild. Rise. Return.",
  description: "Ứng dụng phục hồi chức năng sau phẫu thuật Dây chằng chéo trước (ACL) & Sụn chêm",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AXVYRA",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0C0D11",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="dark bg-[#050508]">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script src="https://accounts.google.com/gsi/client" async defer></script>
      </head>
      <body className="min-h-screen bg-[#050508] sm:bg-[#050508] flex justify-center text-slate-100 antialiased select-none sm:py-6">
        {/* Strict iPhone 16 Pro Mobile Frame Container */}
        <div className="w-full max-w-[430px] min-h-screen sm:min-h-[880px] bg-[#0C0D11] relative flex flex-col sm:rounded-[50px] shadow-2xl overflow-hidden sm:border sm:border-white/10">
          {children}
        </div>
      </body>
    </html>
  );
}
