import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gối Khỏe - Phục hồi Dây chằng chéo & Sụn chêm",
  description: "Ứng dụng di động phục hồi chức năng sau mổ đứt dây chằng chéo trước (ACL) và sụn chêm",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Gối Khỏe",
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
      <body className="min-h-screen bg-slate-950 sm:bg-slate-900 flex justify-center text-slate-800 antialiased font-sans select-none sm:py-4">
        {/* Strict Mobile Shell Frame */}
        <div className="w-full max-w-[430px] min-h-screen sm:min-h-[844px] bg-[#F8FAFC] relative flex flex-col sm:rounded-[40px] shadow-2xl overflow-x-hidden sm:border sm:border-slate-800">
          {children}
        </div>
      </body>
    </html>
  );
}
