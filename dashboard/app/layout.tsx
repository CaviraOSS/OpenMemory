import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/sidebar";
import Navbar from "@/components/navbar";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "OpenMemory Dashboard",
    description: "Memory analytics and monitoring dashboard",
    icons: {
        icon: '/favicon.ico',
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-stone-300`}
                suppressHydrationWarning
            >
                <Sidebar />
                <Navbar />
                <main className="ml-20 mt-20 p-4 min-h-screen transition-all duration-300">
                    {children}
                </main>
            </body>
        </html>
    );
}
