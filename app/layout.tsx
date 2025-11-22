import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Topbar from "../components/Topbar";
import Sidebar from "../components/Sidebar";
import Footer from "../components/Footer";
import { AuthProvider } from "./context/AuthContext";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "IB Fresh Fish - Trading Tools",
  description: "Inventory and Sales Management System for Fish Trading",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        <AuthProvider>
          <div className="flex min-h-screen flex-col">
            <Topbar />
            <div className="flex flex-1">
              <Sidebar />
              <main className="flex-1 flex flex-col overflow-x-hidden" style={{ background: 'var(--background)' }}>
                <div className="flex-1 w-full max-w-[1600px] mx-auto">
                  {children}
                </div>
                <Footer />
              </main>
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
