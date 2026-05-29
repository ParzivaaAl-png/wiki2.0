import * as React from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { BookOpen, ShieldAlert, LogIn } from 'lucide-react';
import { ThemeProvider } from './components/theme-provider';
import { ThemeToggle } from './components/theme-toggle';
import { SearchModal } from './components/search-modal';
import { AuthProvider, useAuth } from './lib/auth-context';
import { ErrorBoundary } from './components/error-boundary';
import { motion, AnimatePresence } from 'framer-motion';

// Import Pages
import Home from './pages/Home';
import ArticlePage from './pages/Article';
import CategoryPage from './pages/Category';
import AdminPage from './pages/Admin';
import EditorPage from './pages/Editor';
import LoginPage from './pages/Login';

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: ('Admin' | 'Editor' | 'User')[] }) {
  const { user, isLoading } = useAuth();
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

  if (allowedRoles && !allowedRoles.includes(user.role)) {
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

  return <>{children}</>;
}

function Header() {
  const { user, logout } = useAuth();

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
          {user && <SearchModal />}
          
          {user ? (
            <div className="flex items-center gap-3">
              {user.role !== 'User' && (
                <Link 
                  to="/admin" 
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200/50 dark:border-neutral-800/50 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors shadow-sm"
                >
                  <ShieldAlert className="w-4 h-4 text-neutral-400" />
                  Админ-панель
                </Link>
              )}
              
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-bold text-neutral-950 dark:text-neutral-100">{user.name}</span>
                <span className="text-[9px] text-neutral-400 uppercase font-bold tracking-wider">{user.role === 'Admin' ? 'Админ' : user.role === 'Editor' ? 'Редактор' : 'Пользователь'}</span>
              </div>

              <button 
                onClick={() => logout()}
                className="px-3 py-1.5 rounded-lg border border-neutral-200/50 dark:border-neutral-800/50 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-900/50 text-neutral-500 hover:text-red-500 transition-colors shadow-sm"
              >
                Выйти
              </button>
            </div>
          ) : (
            <Link 
              to="/login"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20"
            >
              <LogIn className="w-4 h-4" />
              Войти
            </Link>
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

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Header />
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
            <Route 
              path="/categories/:slug" 
              element={
                <ProtectedRoute>
                  <AnimatedPage>
                    <CategoryPage />
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
