import * as React from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { BookOpen, ShieldAlert, LogIn, UserCircle, KeyRound, Save, X, Loader2 } from 'lucide-react';
import { ThemeProvider } from './components/theme-provider';
import { ThemeToggle } from './components/theme-toggle';
import { SearchModal } from './components/search-modal';
import { NewsBell } from './components/news-bell';
import { AuthProvider, useAuth } from './lib/auth-context';
import { ModalPortal } from './components/modal-portal';
import { ErrorBoundary } from './components/error-boundary';
import { motion, AnimatePresence } from 'framer-motion';
import { BookSidebar } from './components/book-sidebar';
import { updateMyAccount, type User } from './lib/api';

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

function ProfileSettingsModal({ user, onClose, onSaved }: { user: User; onClose: () => void; onSaved: () => Promise<void> }) {
  const [username, setUsername] = React.useState(user.username);
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    setUsername(user.username);
  }, [user.username]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const nextUsername = username.trim();
    const isPasswordTouched = currentPassword.length > 0 || newPassword.length > 0 || confirmPassword.length > 0;

    if (!nextUsername) {
      setError('Укажите логин.');
      return;
    }

    if (isPasswordTouched) {
      if (!currentPassword) {
        setError('Введите текущий пароль.');
        return;
      }

      if (newPassword.length < 6) {
        setError('Новый пароль должен быть не менее 6 символов.');
        return;
      }

      if (newPassword !== confirmPassword) {
        setError('Новый пароль и повтор не совпадают.');
        return;
      }
    }

    setIsSaving(true);
    try {
      await updateMyAccount({
        username: nextUsername,
        currentPassword: isPasswordTouched ? currentPassword : undefined,
        newPassword: isPasswordTouched ? newPassword : undefined,
      });
      await onSaved();
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Данные профиля сохранены.');
    } catch (err: any) {
      setError(err.message || 'Не удалось сохранить профиль.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 bg-black/65">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-lg rounded-2xl border border-border bg-card text-card-foreground shadow-2xl"
        >
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div>
              <div className="inline-flex items-center gap-2 text-sm font-bold text-primary">
                <UserCircle className="w-4 h-4" />
                Профиль
              </div>
              <h2 className="mt-2 text-xl font-bold text-foreground">Логин и пароль</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Изменения применяются только к вашему аккаунту.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
              aria-label="Закрыть"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-5 px-5 py-5">
            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-300">
                {error}
              </div>
            )}
            {success && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                {success}
              </div>
            )}

            <label className="block space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Логин</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/35"
                autoComplete="username"
              />
            </label>

            <div className="rounded-xl border border-border bg-background/70 p-4">
              <div className="mb-4 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-primary" />
                <div>
                  <h3 className="text-sm font-bold text-foreground">Смена пароля</h3>
                  <p className="text-xs text-muted-foreground">Оставьте поля пустыми, если пароль менять не нужно.</p>
                </div>
              </div>

              <div className="grid gap-3">
                <label className="block space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Текущий пароль</span>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/35"
                    autoComplete="current-password"
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Новый пароль</span>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/35"
                      autoComplete="new-password"
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Повтор пароля</span>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className="h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/35"
                      autoComplete="new-password"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-bold text-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
}

function Header() {
  const { user, logout, isStaff, refreshUser } = useAuth();
  const location = useLocation();
  const [isProfileOpen, setIsProfileOpen] = React.useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background glass-header transition-colors duration-300">
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
                    className="hidden h-9 sm:inline-flex items-center gap-1.5 px-3 rounded-lg border border-border bg-card text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    <ShieldAlert className="w-4 h-4 text-neutral-400" />
                    Админ-панель
                  </Link>
                )}
                {isStaff && (
                  <Link
                    to="/admin"
                    className="sm:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
                    aria-label="Админ-панель"
                    title="Админ-панель"
                  >
                    <ShieldAlert className="w-4 h-4" />
                  </Link>
                )}

                <button
                  type="button"
                  onClick={() => setIsProfileOpen(true)}
                  className="hidden rounded-lg px-2 py-1 text-right transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40 md:flex md:flex-col"
                  title="Изменить логин и пароль"
                >
                  <span className="text-xs font-bold text-neutral-950 dark:text-neutral-100">{user.name}</span>
                  <span className="text-[9px] text-neutral-405 dark:text-neutral-450 uppercase font-bold tracking-wider">{user.role}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsProfileOpen(true)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 md:hidden"
                  aria-label="Профиль"
                  title="Профиль"
                >
                  <UserCircle className="w-4 h-4" />
                </button>

                <button
                  onClick={() => logout()}
                  className="inline-flex h-9 items-center px-2 sm:px-3 rounded-lg border border-border bg-card text-xs sm:text-sm font-medium text-muted-foreground shadow-sm transition-colors hover:bg-red-500/10 hover:text-red-500 focus-visible:ring-2 focus-visible:ring-red-500/30"
                >
                  Выйти
                </button>
              </div>
            ) : (
              location.pathname !== '/login' && (
                <Link
                  to="/login"
                  className="inline-flex h-9 items-center gap-1.5 px-3 rounded-lg bg-primary text-primary-foreground text-sm font-semibold transition-colors shadow-md shadow-indigo-600/10 hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-ring/40"
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

      {isProfileOpen && user && (
        <ProfileSettingsModal
          user={user}
          onClose={() => setIsProfileOpen(false)}
          onSaved={refreshUser}
        />
      )}
    </>
  );
}

function AnimatedPage({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
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
    <div className={`flex flex-col min-h-screen min-h-dvh bg-background text-foreground transition-all duration-300 ${user ? 'lg:pl-[56px] pl-0' : ''} ${isUser ? 'select-none' : ''}`}>
      <Header />
      {user && (
        <BookSidebar 
          isOpen={isSidebarOpen} 
          onToggle={() => setIsSidebarOpen(prev => !prev)} 
          onClose={() => setIsSidebarOpen(false)} 
        />
      )}
      <main className="flex-1 relative min-h-0 overflow-x-clip bg-background">
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
