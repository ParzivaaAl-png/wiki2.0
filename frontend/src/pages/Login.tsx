import * as React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../lib/auth-context';
import { Lock, User, ArrowRight, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);

  // Redirect if already logged in
  React.useEffect(() => {
    if (user) {
      const from = (location.state as any)?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [user, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic Validation
    if (!username.trim() || !password) {
      setError('Пожалуйста, заполните логин и пароль.');
      return;
    }

    setIsLoading(true);
    try {
      await login(username.trim(), password);
      setIsSuccess(true);
      setTimeout(() => {
        const from = (location.state as any)?.from?.pathname || '/';
        navigate(from, { replace: true });
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Неверный логин или пароль. Попробуйте еще раз.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 overflow-hidden bg-background">
      
      {/* Background Decorative Blurs */}
      <div className="absolute inset-0 pointer-events-none -z-10 opacity-75 dark:opacity-40">
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-indigo-500/20 blur-[130px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-purple-500/20 blur-[130px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Glass Box */}
        <div className="relative overflow-hidden rounded-2xl border border-neutral-200/50 dark:border-neutral-800/50 bg-white/60 dark:bg-neutral-950/60 backdrop-blur-xl shadow-2xl p-8 transition-all">
          
          {/* Top light bar */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-indigo-500/10 dark:border-indigo-400/20 bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>База знаний Wiki 2.0</span>
            </div>
            
            <h2 className="text-3xl font-bold font-outfit text-neutral-900 dark:text-white tracking-tight">
              Авторизация
            </h2>
            <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              Введите логин и пароль для доступа к базе знаний
            </p>
          </div>

          <AnimatePresence mode="wait">
            {isSuccess ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-8 text-center"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-4">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                  Успешный вход
                </h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                  Перенаправление в систему...
                </p>
              </motion.div>
            ) : (
              <motion.form 
                key="login"
                onSubmit={handleSubmit}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {/* Error Banner */}
                {error && (
                  <div className="p-3 rounded-lg border border-red-500/10 bg-red-500/5 text-red-600 dark:text-red-400 text-xs flex items-start gap-2 animate-shake">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Login Field */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Логин (Имя пользователя)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      placeholder="Введите ваш логин"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-sm bg-neutral-100/50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-neutral-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                    Пароль
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-sm bg-neutral-100/50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-neutral-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 mt-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Войти</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
