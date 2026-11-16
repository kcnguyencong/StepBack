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
  themeColor: "#EBF4F6",
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
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,600;1,700&display=swap"
          rel="stylesheet"
        />
        <script src="https://accounts.google.com/gsi/client" async defer></script>
      </head>
      <body className="min-h-screen bg-slate-900 sm:bg-slate-950 flex justify-center text-slate-800 antialiased select-none sm:py-6">
        {/* Strict iPhone 16 Pro Mobile Frame Container */}
        <div className="w-full max-w-[430px] min-h-screen sm:min-h-[880px] bg-[#F2F7F9] relative flex flex-col sm:rounded-[50px] shadow-2xl overflow-hidden sm:border-4 sm:border-slate-800/80">
          {children}
        </div>
      </body>
    </html>
  );
}
