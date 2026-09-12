import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Sidebar } from "@/components/nav/Sidebar";
import { THEME_SCRIPT } from "@/components/theme/theme-store";
import "./globals.css";

const fontSans = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const fontMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "TimeFlow",
  description: "Personal time management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fontSans.variable} ${fontMono.variable} h-full antialiased`}
      // The theme script below writes `class="dark"` onto this element before
      // React hydrates, so the client tree legitimately differs from the SSR
      // HTML here. Without this, React warns on every load in dark mode.
      suppressHydrationWarning
    >
      <head>
        {/* Plain <script>, not next/script: this has to run synchronously,
            before first paint. Deferring it (any next/script strategy does)
            would flash the light palette at dark-mode users on every load. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex h-screen overflow-hidden">
        <Sidebar />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
