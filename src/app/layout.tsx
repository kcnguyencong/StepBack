import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AXVYRA — Rebuild. Rise. Return.",
  description: "Ứng dụng di động phục hồi chức năng sau mổ đứt dây chằng chéo trước (ACL) và sụn chêm",
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
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Readex+Pro:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-slate-950 sm:bg-slate-900 flex justify-center text-slate-800 antialiased select-none sm:py-4">
        {/* Strict Mobile Shell Frame */}
        <div className="w-full max-w-[430px] min-h-screen sm:min-h-[844px] bg-[#F8FAFC] relative flex flex-col sm:rounded-[40px] shadow-2xl overflow-x-hidden sm:border sm:border-slate-800">
          {children}
        </div>
      </body>
    </html>
  );
}
