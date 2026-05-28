import type { Metadata } from 'next';
import { Inter, Outfit } from 'next/font/google';
import Link from 'next/link';
import { BookOpen, ShieldAlert } from 'lucide-react';
import { ThemeProvider } from '../components/theme-provider';
import { ThemeToggle } from '../components/theme-toggle';
import { SearchModal } from '../components/search-modal';
import './globals.css';

const inter = Inter({ 
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
});

const outfit = Outfit({ 
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Wiki 2.0 — Tech Documentation & Instant Knowledge',
  description: 'A modern, premium minimalist documentation wiki built with Next.js, Express, and Elasticsearch. Experience instant typo-tolerant search and a sleek design.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${outfit.variable}`}>
      <body className="min-h-screen bg-background text-foreground selection:bg-neutral-200 dark:selection:bg-indigo-950 font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          {/* Header */}
          <header className="sticky top-0 z-40 w-full border-b border-neutral-200/50 dark:border-neutral-800/50 glass-header shadow-sm transition-all duration-300">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
              
              {/* Brand Logo */}
              <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/10 group-hover:shadow-indigo-500/20 transition-all duration-300">
                  <BookOpen className="w-4.5 h-4.5" />
                </div>
                <span className="font-outfit text-lg font-bold tracking-tight bg-gradient-to-r from-neutral-900 to-neutral-700 dark:from-white dark:to-neutral-300 bg-clip-text text-transparent group-hover:opacity-95 transition-all">
                  Wiki 2.0
                </span>
              </Link>

              {/* Navigation Actions */}
              <div className="flex items-center gap-3">
                <SearchModal />
                
                <Link 
                  href="/admin" 
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200/50 dark:border-neutral-800/50 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors shadow-sm"
                >
                  <ShieldAlert className="w-4 h-4 text-neutral-400" />
                  Admin
                </Link>

                <ThemeToggle />
              </div>
            </div>
          </header>

          {/* Main Area */}
          <main className="flex-1">
            {children}
          </main>
          
        </ThemeProvider>
      </body>
    </html>
  );
}
