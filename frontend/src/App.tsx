import * as React from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { BookOpen, ShieldAlert, LogIn } from 'lucide-react';
import { ThemeProvider } from './components/theme-provider';
import { ThemeToggle } from './components/theme-toggle';
import { SearchModal } from './components/search-modal';
import { NewsBell } from './components/news-bell';
import { AuthProvider, useAuth } from './lib/auth-context';
import { ErrorBoundary } from './components/error-boundary';
import { motion, AnimatePresence } from 'framer-motion';
import { BookSidebar } from './components/book-sidebar';

// Import Pages
import Home from './pages/Home';
import ArticlePage from './pages/Article';
import AdminPage from './pages/Admin';
import EditorPage from './pages/Editor';
import LoginPage from './pages/Login';

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: ('Admin' | 'Editor' | 'User')[] }) {
  const { user, isLoading, isAdmin, isEditor, isUser } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles) {
    const hasRole = allowedRoles.some(role => {
      if (role === 'Admin') return isAdmin;
      if (role === 'Editor') return isEditor;
      if (role === 'User') return isUser;
      return false;
    });

    if (!hasRole) {
      return (
        <div className="max-w-md mx-auto my-20 p-6 text-center border border-red-500/10 dark:border-red-500/20 bg-red-500/5 rounded-xl shadow-lg">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Доступ ограничен</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
            У вашей учетной записи ({user.role}) недостаточно прав для просмотра этой страницы.
          </p>
        </div>
      );
    }
  }

  return <>{children}</>;
}

function Header() {
  const { user, logout, isStaff } = useAuth();
  const location = useLocation();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-200/50 dark:border-neutral-800/50 glass-header shadow-sm transition-all duration-350">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
        
        <Link to="/" className={`flex items-center gap-2 shrink-0 group ${user ? 'ml-11 lg:ml-0' : ''}`}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/10 group-hover:shadow-indigo-500/20 transition-all duration-300">
            <BookOpen className="w-4.5 h-4.5" />
          </div>
          <span className="hidden sm:inline font-outfit text-lg font-bold tracking-tight bg-gradient-to-r from-neutral-900 to-neutral-700 dark:from-white dark:to-neutral-300 bg-clip-text text-transparent group-hover:opacity-95 transition-all">
            Wiki 2.0
          </span>
        </Link>
 
        {/* Navigation Actions */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          {user && <SearchModal />}
          {user && <NewsBell />}
          
          {user ? (
            <div className="flex items-center gap-1.5 sm:gap-3">
              {isStaff && (
                <Link 
                  to="/admin" 
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200/50 dark:border-neutral-800/50 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors shadow-sm"
                >
                  <ShieldAlert className="w-4 h-4 text-neutral-400" />
                  Админ-панель
                </Link>
              )}
              {isStaff && (
                <Link 
                  to="/admin" 
                  className="sm:hidden p-2 rounded-lg border border-neutral-200/50 dark:border-neutral-800/50 text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors"
                >
                  <ShieldAlert className="w-4 h-4" />
                </Link>
              )}
              
              <div className="hidden md:flex flex-col text-right">
                <span className="text-xs font-bold text-neutral-950 dark:text-neutral-100">{user.name}</span>
                <span className="text-[9px] text-neutral-400 uppercase font-bold tracking-wider">{user.role}</span>
              </div>
 
              <button 
                onClick={() => logout()}
                className="px-2 sm:px-3 py-1.5 rounded-lg border border-neutral-200/50 dark:border-neutral-800/50 text-xs sm:text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-900/50 text-neutral-500 hover:text-red-500 transition-colors shadow-sm"
              >
                Выйти
              </button>
            </div>
          ) : (
            location.pathname !== '/login' && (
              <Link 
                to="/login"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20"
              >
                <LogIn className="w-4.5 h-4.5" />
                <span className="hidden sm:inline">Войти</span>
              </Link>
            )
          )}
 
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function AnimatedPage({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
      className="w-full"
    >
      {children}
    </motion.div>
  );
}

function AppContent() {
  const location = useLocation();
  const { user, isUser } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  React.useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  // Effect to disable context menu, copy, print, and developer hotkeys for regular users (role === 'User')
  React.useEffect(() => {
    if (!isUser) return;

    const preventDefault = (e: Event) => e.preventDefault();

    window.addEventListener('contextmenu', preventDefault);
    window.addEventListener('copy', preventDefault);
    window.addEventListener('cut', preventDefault);

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent Copy / Cut
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'x')) {
        e.preventDefault();
      }
      // Prevent Print
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
      }
      // Prevent Source View (Ctrl+U)
      if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault();
      }
      // Prevent DevTools (F12 or Ctrl+Shift+I / Cmd+Opt+I)
      if (e.key === 'F12' || 
          ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') ||
          ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'i') ||
          (e.metaKey && e.altKey && (e.key === 'i' || e.key === 'I'))) {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('contextmenu', preventDefault);
      window.removeEventListener('copy', preventDefault);
      window.removeEventListener('cut', preventDefault);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [user]);

  return (
    <div className={`flex flex-col min-h-screen bg-background text-foreground transition-all duration-300 ${user ? 'lg:pl-[56px] pl-0' : ''} ${isUser ? 'select-none' : ''}`}>
      <Header />
      {user && (
        <BookSidebar 
          isOpen={isSidebarOpen} 
          onToggle={() => setIsSidebarOpen(prev => !prev)} 
          onClose={() => setIsSidebarOpen(false)} 
        />
      )}
      <main className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            {/* Login Route (Public, but will redirect if user is already logged in) */}
            <Route 
              path="/login" 
              element={
                <AnimatedPage>
                  <LoginPage />
                </AnimatedPage>
              } 
            />

            {/* Protected Routes */}
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <AnimatedPage>
                    <Home />
                  </AnimatedPage>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/articles/:slug" 
              element={
                <ProtectedRoute>
                  <AnimatedPage>
                    <ArticlePage />
                  </AnimatedPage>
                </ProtectedRoute>
              } 
            />

            
            {/* Protected Admin/Editor Routes */}
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute allowedRoles={['Admin', 'Editor']}>
                  <AnimatedPage>
                    <AdminPage />
                  </AnimatedPage>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/editor/new" 
              element={
                <ProtectedRoute allowedRoles={['Admin', 'Editor']}>
                  <AnimatedPage>
                    <EditorPage />
                  </AnimatedPage>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/editor/:id" 
              element={
                <ProtectedRoute allowedRoles={['Admin', 'Editor']}>
                  <AnimatedPage>
                    <EditorPage />
                  </AnimatedPage>
                </ProtectedRoute>
              } 
            />
          </Routes>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
