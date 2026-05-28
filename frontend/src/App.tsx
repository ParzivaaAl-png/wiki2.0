import * as React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { BookOpen, ShieldAlert } from 'lucide-react';
import { ThemeProvider } from './components/theme-provider';
import { ThemeToggle } from './components/theme-toggle';
import { SearchModal } from './components/search-modal';

// Import Pages
import Home from './pages/Home';
import ArticlePage from './pages/Article';
import CategoryPage from './pages/Category';
import AdminPage from './pages/Admin';
import EditorPage from './pages/Editor';

function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-200/50 dark:border-neutral-800/50 glass-header shadow-sm transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
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
            to="/admin" 
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200/50 dark:border-neutral-800/50 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors shadow-sm"
          >
            <ShieldAlert className="w-4 h-4 text-neutral-400" />
            Admin
          </Link>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <div className="flex flex-col min-h-screen bg-background text-foreground">
          <Header />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/articles/:slug" element={<ArticlePage />} />
              <Route path="/categories/:slug" element={<CategoryPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/admin/editor/new" element={<EditorPage />} />
              <Route path="/admin/editor/:id" element={<EditorPage />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}
