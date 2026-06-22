import * as React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, Sparkles, X, FileText, CornerDownLeft, MapPin, CheckCircle2, XCircle, Info, Car, ChevronRight, AlertTriangle, Star } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { searchArticles, SearchResult, fetchClassifierData, fetchFavoriteArticles } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { createPortal } from 'react-dom';
import { CITIES, TARIFFS, CAR_DATA } from '../lib/classifier-data';
import { getQueryVariants } from '../utils/text';

interface SearchBarProps {
  variant?: 'header' | 'hero';
}

export function SearchModal({ variant = 'header' }: SearchBarProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);
  const [carData, setCarData] = React.useState<typeof CAR_DATA>(CAR_DATA);

  const { user } = useAuth();
  const [favoriteArticles, setFavoriteArticles] = React.useState<any[]>([]);
  const [searchOnlyFavorites, setSearchOnlyFavorites] = React.useState(false);

  React.useEffect(() => {
    if (user && (isOpen || isFocused)) {
      fetchFavoriteArticles()
        .then(setFavoriteArticles)
        .catch(err => console.error('Failed to load favorites in SearchModal:', err));
    } else if (!user) {
      setFavoriteArticles([]);
    }
  }, [user, isOpen, isFocused]);

  React.useEffect(() => {
    fetchClassifierData()
      .then(data => {
        if (data && Array.isArray(data) && data.length > 0) {
          setCarData(data);
        }
      })
      .catch(err => {
        console.error('Failed to load classifier data in SearchModal, using static fallback:', err);
      });
  }, []);

  const [selectedCity, setSelectedCity] = React.useState(CITIES[0]);
  const [selectedYear, setSelectedYear] = React.useState(2020);
  const [mobileTab, setMobileTab] = React.useState<'results' | 'classifier'>('results');

  const [selectedCar, setSelectedCar] = React.useState<any>(null);

  const dynamicBrands = React.useMemo(() => {
    return Array.from(new Set(carData.map(c => c.brand))).sort();
  }, [carData]);

  const getCarStatusDynamic = React.useCallback((brand: string, modelName: string, year: number, cityId: string) => {
    const city = CITIES.find(c => c.id === cityId) || CITIES[0];
    const car = carData.find(
      c => c.brand.toLowerCase() === brand.toLowerCase() && 
           c.model.toLowerCase() === modelName.toLowerCase()
    );

    if (!car) return null;

    const results: Record<string, { fits: boolean; minYear: number; warning?: string }> = {};

    Object.entries(car.years).forEach(([tariffKey, baseMinYear]) => {
      const requiredYear = Math.max(1980, baseMinYear + city.offset);
      results[tariffKey] = {
        fits: year >= requiredYear,
        minYear: requiredYear,
        warning: car.warnings?.[tariffKey]
      };
    });

    return results;
  }, [carData]);

  const matchedCar = React.useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return null;
    const variants = getQueryVariants(q);

    for (const car of carData) {
      const brand = car.brand.toLowerCase();
      const modelName = car.model.toLowerCase();
      const fullName = `${brand} ${modelName}`;

      const hasMatch = variants.some(variant => {
        const v = variant.toLowerCase().trim();
        return v === brand || v === modelName || v === fullName || fullName.includes(v);
      });

      if (hasMatch) {
        return car;
      }

      for (const variant of variants) {
        const words = variant.toLowerCase().split(/\s+/);
        if (words.length >= 2) {
          const hasBrand = words.some(w => brand.includes(w) || w.includes(brand));
          const hasModel = words.some(w => modelName.includes(w) || w.includes(modelName));
          if (hasBrand && hasModel) {
            return car;
          }
        }
      }
    }

    for (const car of carData) {
      const brand = car.brand.toLowerCase();
      const hasBrandMatch = variants.some(variant => {
        const v = variant.toLowerCase().trim();
        return v === brand || brand.includes(v);
      });
      if (hasBrandMatch) {
        return car;
      }
    }

    return null;
  }, [query, carData]);

  React.useEffect(() => {
    setSelectedCar(matchedCar);
  }, [matchedCar]);

  const matchedBrand = React.useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return null;
    const variants = getQueryVariants(q);
    for (const b of dynamicBrands) {
      const brandLower = b.toLowerCase();
      const hasMatch = variants.some(variant => {
        const v = variant.toLowerCase().trim();
        return brandLower.includes(v) || v.includes(brandLower);
      });
      if (hasMatch) return b;
    }
    return null;
  }, [query, dynamicBrands]);

  const brandModels = React.useMemo(() => {
    if (!matchedBrand) return [];
    return carData.filter(c => c.brand.toLowerCase() === matchedBrand.toLowerCase());
  }, [matchedBrand, carData]);

  React.useEffect(() => {
    if (selectedCar) {
      setMobileTab('classifier');
    } else {
      setMobileTab('results');
    }
  }, [selectedCar]);

  const navigate = useNavigate();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Listen for Cmd+K / Ctrl+K and Escape
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        
        if (window.innerWidth < 640) {
          setIsOpen((prev) => !prev);
          return;
        }

        // Focus matching search field on desktop
        if (variant === 'hero') {
          inputRef.current?.focus();
        } else if (variant === 'header') {
          const heroInput = document.querySelector('[data-search-variant="hero"]');
          if (!heroInput) {
            inputRef.current?.focus();
          }
        }
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        setIsFocused(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [variant]);

  // Handle click outside to close dropdown on desktop
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    }
    if (isFocused) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFocused]);

  // Fetch results on query change
  React.useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const resData = await searchArticles(query);
        setResults(resData.filter(res => !res.slug.startsWith('auto-list-')));
        setSelectedIndex(0);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Reset when closing mobile modal or blurring desktop input
  React.useEffect(() => {
    if (!isOpen && !isFocused) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen, isFocused]);

  const handleSelect = (slug: string, highlight?: string) => {
    setIsOpen(false);
    setIsFocused(false);
    inputRef.current?.blur();
    setQuery('');
    if (highlight) {
      navigate(`/articles/${slug}?highlight=${encodeURIComponent(highlight)}`);
    } else {
      navigate(`/articles/${slug}`);
    }
  };

  const filteredResults = React.useMemo(() => {
    if (searchOnlyFavorites) {
      return results.filter(res => favoriteArticles.some(fav => fav.id === res.id));
    }
    return results;
  }, [results, searchOnlyFavorites, favoriteArticles]);

  // Process results into Article Matches and Snippet Matches
  const matchedArticles = filteredResults;

  const textMatches = React.useMemo(() => {
    const list: {
      id: number;
      articleTitle: string;
      slug: string;
      categoryName: string;
      snippet: string;
      matchedWord: string;
    }[] = [];

    filteredResults.forEach((res) => {
      if (res.highlights && res.highlights.length > 0) {
        res.highlights.forEach((hl) => {
          const match = hl.match(/<mark[^>]*>(.*?)<\/mark>/i);
          const matchedWord = match ? match[1] : query;

          list.push({
            id: res.id,
            articleTitle: res.title,
            slug: res.slug,
            categoryName: res.categoryName,
            snippet: hl,
            matchedWord: matchedWord,
          });
        });
      }
    });
    return list;
  }, [filteredResults, query]);

  const totalItems = matchedArticles.length + textMatches.length;

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    if (totalItems === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % totalItems);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      
      if (selectedIndex < matchedArticles.length) {
        handleSelect(matchedArticles[selectedIndex].slug);
      } else {
        const textIdx = selectedIndex - matchedArticles.length;
        const match = textMatches[textIdx];
        handleSelect(match.slug, match.matchedWord);
      }
    }
  };

  const renderBrandModelsList = () => {
    if (brandModels.length === 0) return null;
    return (
      <div className="mb-4">
        <div className="px-3 py-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 border-b border-border pb-1 mb-2">
          <Car className="w-3.5 h-3.5 text-indigo-500" />
          Модели {matchedBrand} в классификаторе
        </div>
        <ul className="space-y-0.5 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
          {brandModels.map((car) => {
            const isSelected = selectedCar?.brand === car.brand && selectedCar?.model === car.model;
            return (
              <li
                key={`brand-model-${car.brand}-${car.model}`}
                onMouseDown={() => {
                  setSelectedCar(car);
                  setMobileTab('classifier');
                }}
                className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-indigo-500/10 text-indigo-900 dark:text-indigo-200 font-bold'
                    : 'hover:bg-muted text-foreground'
                }`}
              >
                <span className="text-sm">{car.brand} {car.model}</span>
                {isSelected && (
                  <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-500/10 px-1.5 py-0.5 rounded">
                    Выбрано
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  const renderResultsList = () => {
    return (
      <>
        {results.length === 0 && brandModels.length === 0 && !isLoading && (
          <div className="py-6 text-center text-muted-foreground text-sm">
            Ничего не найдено по запросу &quot;<span className="text-foreground font-semibold">{query}</span>&quot;.
          </div>
        )}

        {renderBrandModelsList()}

        {matchedArticles.length > 0 && (
          <div className="mb-4">
            <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Статьи
            </div>
            <ul className="space-y-0.5">
              {matchedArticles.map((art, idx) => {
                const isCurrent = idx === selectedIndex;
                return (
                  <li
                    key={`art-${art.id}`}
                    onMouseDown={() => handleSelect(art.slug)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                      isCurrent
                        ? 'bg-indigo-500/10 text-indigo-900 dark:text-indigo-200 font-medium'
                        : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                      <span className="text-sm truncate max-w-[280px]" dangerouslySetInnerHTML={{ __html: art.title }} />
                      <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase font-medium shrink-0">
                        {(art.categoryName || '').replace('-', ' ')}
                      </span>
                    </div>
                    {isCurrent && <CornerDownLeft className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {textMatches.length > 0 && (
          <div>
            <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Совпадения в тексте
            </div>
            <ul className="space-y-1.5">
              {textMatches.map((match, idx) => {
                const globalIndex = matchedArticles.length + idx;
                const isCurrent = globalIndex === selectedIndex;
                return (
                  <li
                    key={`match-${match.slug}-${idx}`}
                    onMouseDown={() => handleSelect(match.slug, match.matchedWord)}
                    className={`p-2.5 rounded-lg cursor-pointer transition-colors border ${
                      isCurrent
                        ? 'bg-indigo-500/5 border-indigo-500/20 text-foreground'
                        : 'hover:bg-muted border-transparent text-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        из: <strong className="text-foreground font-semibold" dangerouslySetInnerHTML={{ __html: match.articleTitle }} />
                      </span>
                      <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase font-medium">
                        {(match.categoryName || '').replace('-', ' ')}
                      </span>
                    </div>
                    
                    <p 
                      className="text-[11px] text-muted-foreground border-l-2 border-border pl-2 mt-1 italic font-light leading-relaxed line-clamp-2"
                      dangerouslySetInnerHTML={{ __html: `... ${match.snippet} ...` }}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </>
    );
  };

  const renderCarWidgetContent = () => {
    if (!selectedCar) return null;
    const statuses = getCarStatusDynamic(selectedCar.brand, selectedCar.model, selectedYear, selectedCity.id);
    
    return (
      <div className="flex flex-col h-full justify-between">
        <div>
          <div className="flex items-start gap-2 pb-3 border-b border-border">
            <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-500 shrink-0">
              <Car className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-foreground leading-tight">
                {selectedCar.brand} {selectedCar.model}
              </h4>
              <p className="text-[10px] text-muted-foreground mt-0.5">Классификатор Яндекс Про</p>
            </div>
          </div>

          {/* Quick select widgets */}
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div className="space-y-1">
              <label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Город</label>
              <select 
                value={selectedCity.id}
                onChange={(e) => {
                  const city = CITIES.find(c => c.id === e.target.value);
                  if (city) setSelectedCity(city);
                }}
                className="w-full bg-card border border-border rounded px-1.5 py-1 text-[11px] text-foreground outline-none"
              >
                {CITIES.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Год авто</label>
              <select 
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full bg-card border border-border rounded px-1.5 py-1 text-[11px] text-foreground outline-none"
              >
                {Array.from({ length: 2027 - 1980 }, (_, i) => 2026 - i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tariff status list */}
          <div className="mt-3.5 space-y-1.5 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin">
            {!statuses ? (
              <div className="text-[10px] text-rose-500 py-1 font-medium">
                Этот автомобиль не поддерживается тарифами в г. {selectedCity.name}
              </div>
            ) : (
              TARIFFS.filter(t => selectedCity.tariffs.includes(t.key)).map(t => {
                const res = statuses[t.key];
                if (!res) return null;
                const hasWarning = !!res.warning;
                return (
                  <div key={t.key} className="flex items-center justify-between text-[11px] py-1 border-b border-border last:border-0">
                    <span className="font-medium text-muted-foreground">{t.name}</span>
                    <span className="flex items-center gap-1">
                      {hasWarning ? (
                        <>
                          <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                          <span 
                            title={res.warning}
                            className="text-[9px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-500/10 px-1 py-0.5 rounded shrink-0 cursor-help"
                          >
                            Внимание
                          </span>
                        </>
                      ) : res.fits ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                          <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-1 py-0.5 rounded shrink-0">Подходит</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 text-rose-500 shrink-0" />
                          <span className="text-[9px] text-rose-600 dark:text-rose-400 font-semibold bg-rose-500/10 px-1 py-0.5 rounded shrink-0">От {res.minYear} г.</span>
                        </>
                      )}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="pt-2 border-t border-border shrink-0">
          <Link 
            to={`/articles/auto-list?brand=${encodeURIComponent(selectedCar?.brand || '')}&model=${encodeURIComponent(selectedCar?.model || '')}&year=${selectedYear}&city=${selectedCity.id}`}
            onClick={() => {
              setIsOpen(false);
              setIsFocused(false);
            }}
            className="w-full flex items-center justify-center gap-1 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold shadow-sm transition-all"
          >
            Открыть в калькуляторе
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    );
  };

  const renderDropdownContent = () => {
    if (selectedCar) {
      return (
        <div className="flex divide-x divide-border overflow-hidden h-auto max-h-[350px]">
          {/* Left Side: Standard Search Results */}
          <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
            {renderResultsList()}
          </div>
          {/* Right Side: Interactive Car Checker Widget */}
          <div className="w-[300px] bg-muted/30 p-3 shrink-0 overflow-hidden">
            {renderCarWidgetContent()}
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-y-auto p-2">
        {renderResultsList()}
      </div>
    );
  };

  const renderMobileModal = () => {
    return (
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[60] flex items-start justify-center pt-0 p-0">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/60"
            />

            <motion.div
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.97, opacity: 0 }}
              transition={{ duration: 0.12, ease: 'easeOut' }}
              className="relative w-full h-full bg-card text-card-foreground border-0 shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="flex items-center gap-3 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] border-b border-border shrink-0">
                <Search className="w-5 h-5 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchOnlyFavorites ? "Поиск по избранному..." : "Поиск..."}
                  autoFocus
                  className="w-full bg-transparent text-foreground outline-none placeholder-muted-foreground text-base"
                />
                {isLoading && (
                  <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin shrink-0" />
                )}
                {user && favoriteArticles.length > 0 && (
                  <button
                    onClick={() => setSearchOnlyFavorites(prev => !prev)}
                    className={`p-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer shadow-sm shrink-0 ${
                      searchOnlyFavorites
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-450'
                        : 'bg-muted border-border text-muted-foreground hover:bg-muted'
                    }`}
                    title={searchOnlyFavorites ? "Поиск по всем статьям" : "Поиск только в избранном"}
                  >
                    <Star className={`w-3.5 h-3.5 ${searchOnlyFavorites ? 'fill-amber-400 text-amber-500' : ''}`} />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-md text-muted-foreground hover:bg-muted shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2 max-h-[calc(100vh-7rem)]">
                {query.trim().length < 2 && (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    <Sparkles className="w-6 h-6 mx-auto mb-2 text-muted-foreground/60" />
                    Введите не менее 2 символов для поиска...
                  </div>
                )}

                {query.trim().length >= 2 && (
                  <>
                    {/* Tabs on Mobile */}
                    {selectedCar && (
                      <div className="flex border-b border-border mb-3 px-1">
                        <button
                          onClick={() => setMobileTab('results')}
                          className={`flex-1 py-2 text-center text-xs font-bold transition-all border-b-2 ${
                            mobileTab === 'results' 
                              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 font-semibold' 
                              : 'border-transparent text-muted-foreground'
                          }`}
                        >
                          Результаты ({results.length})
                        </button>
                        <button
                          onClick={() => setMobileTab('classifier')}
                          className={`flex-1 py-2 text-center text-xs font-bold transition-all border-b-2 ${
                            mobileTab === 'classifier' 
                              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 font-semibold' 
                              : 'border-transparent text-muted-foreground'
                          }`}
                        >
                          Классификатор: {selectedCar.brand}
                        </button>
                      </div>
                    )}

                    {mobileTab === 'classifier' && selectedCar ? (
                      <div className="p-3 bg-muted/20 border border-border rounded-xl">
                        {renderCarWidgetContent()}
                      </div>
                    ) : (
                      <>
                        {results.length === 0 && brandModels.length === 0 && !isLoading && (
                          <div className="py-8 text-center text-muted-foreground text-sm">
                            Ничего не найдено по запросу &quot;<span className="text-foreground font-semibold">{query}</span>&quot;.
                          </div>
                        )}

                        {renderBrandModelsList()}

                        {matchedArticles.length > 0 && (
                          <div className="mb-4">
                            <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              Статьи
                            </div>
                            <ul className="space-y-1">
                              {matchedArticles.map((art) => (
                                <li
                                  key={`art-${art.id}`}
                                  onClick={() => handleSelect(art.slug)}
                                  className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer hover:bg-muted text-foreground"
                                >
                                  <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                                    <span dangerouslySetInnerHTML={{ __html: art.title }} />
                                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase font-medium">
                                      {(art.categoryName || '').replace('-', ' ')}
                                    </span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {textMatches.length > 0 && (
                          <div>
                            <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              Совпадения в тексте
                            </div>
                            <ul className="space-y-2">
                              {textMatches.map((match, idx) => (
                                <li
                                  key={`match-${match.slug}-${idx}`}
                                  onClick={() => handleSelect(match.slug, match.matchedWord)}
                                  className="p-3 rounded-lg cursor-pointer hover:bg-muted border-transparent text-foreground"
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-medium text-muted-foreground">
                                      из статьи: <strong className="text-foreground font-semibold" dangerouslySetInnerHTML={{ __html: match.articleTitle }} />
                                    </span>
                                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase font-medium">
                                      {(match.categoryName || '').replace('-', ' ')}
                                    </span>
                                  </div>
                                  <p 
                                    className="text-xs text-muted-foreground border-l-2 border-border pl-2 mt-1.5 italic font-light leading-relaxed"
                                    dangerouslySetInnerHTML={{ __html: `... ${match.snippet} ...` }}
                                  />
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center justify-between px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] bg-muted/40 border-t border-border text-[10px] text-muted-foreground select-none shrink-0">
                <div className="w-full text-center text-xs">Поиск с автодополнением</div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    );
  };

  if (variant === 'hero') {
    return (
      <div ref={containerRef} className="relative w-full max-w-2xl mx-auto">
        {/* Mobile trigger (looks like search bar) */}
        <div 
          onClick={() => setIsOpen(true)}
          className="sm:hidden flex items-center gap-4 px-5 py-4 rounded-xl border border-border bg-card hover:border-indigo-500/40 dark:hover:border-indigo-500/40 transition-all duration-300 cursor-pointer shadow-premium dark:shadow-premium-dark"
        >
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <span className="flex-1 text-left text-muted-foreground text-sm">
            Поиск по базе знаний...
          </span>
        </div>

        {/* Desktop inline input search bar */}
        <div 
          className={`hidden sm:flex items-center gap-4 px-5 py-4 rounded-xl border bg-card transition-all duration-300 shadow-premium dark:shadow-premium-dark ${
            isFocused 
              ? 'border-indigo-500/50 ring-2 ring-indigo-500/10 shadow-glow dark:shadow-glow' 
              : 'border-border hover:border-indigo-500/40 dark:hover:border-indigo-500/40 hover:shadow-glow dark:hover:shadow-glow'
          }`}
        >
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            data-search-variant="hero"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onKeyDown={handleListKeyDown}
            placeholder={searchOnlyFavorites ? "Поиск по избранному..." : "Поиск по базе знаний..."}
            className="flex-1 bg-transparent border-0 outline-none text-base text-foreground placeholder-muted-foreground"
          />
          {isLoading && (
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin shrink-0" />
          )}
          {user && favoriteArticles.length > 0 && (
            <button
              onClick={() => setSearchOnlyFavorites(prev => !prev)}
              className={`p-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer shadow-sm shrink-0 flex items-center gap-1.5 ${
                searchOnlyFavorites
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-450'
                  : 'bg-muted border-border text-muted-foreground hover:bg-muted'
              }`}
              title={searchOnlyFavorites ? "Поиск по всем статьям" : "Поиск только в избранном"}
            >
              <Star className={`w-3.5 h-3.5 ${searchOnlyFavorites ? 'fill-amber-400 text-amber-500' : ''}`} />
              <span className="text-[10px] hidden md:inline">В избранном</span>
            </button>
          )}
          {!query && (
            <kbd className="hidden sm:inline-flex h-6 select-none items-center gap-0.5 rounded border border-border bg-muted px-2 font-mono text-[11px] font-medium text-muted-foreground">
              ⌘K
            </kbd>
          )}
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded hover:bg-muted text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Desktop Dropdown */}
        <AnimatePresence>
          {isFocused && query.trim().length >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.99 }}
              transition={{ duration: 0.15 }}
              className={`absolute top-full left-0 right-0 mt-2 bg-card border-2 border-indigo-500 rounded-xl shadow-[0_15px_40px_rgba(99,102,241,0.15)] z-50 overflow-hidden flex flex-col max-h-[350px] transition-all duration-300 ${selectedCar ? 'md:left-[-50px] md:right-[-50px]' : ''}`}
            >
              {renderDropdownContent()}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile Modal Portal */}
        {createPortal(renderMobileModal(), document.body)}
      </div>
    );
  }

  // Default: variant === 'header'
  return (
    <div ref={containerRef} className="relative">
      {/* Mobile trigger */}
      <button
        onClick={() => setIsOpen(true)}
        className="sm:hidden flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <Search className="w-4 h-4" />
      </button>

      {/* Desktop inline input search bar */}
      <div 
        className={`hidden h-9 sm:flex items-center gap-2 px-3 rounded-lg border border-border bg-input text-muted-foreground text-sm hover:border-indigo-500/40 transition-all duration-300 ${
          isFocused ? 'w-96 lg:w-[480px] ring-2 ring-ring/20 border-indigo-500/50 bg-card' : 'w-48 lg:w-64'
        }`}
      >
        <Search className="w-4 h-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          data-search-variant="header"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleListKeyDown}
          placeholder={searchOnlyFavorites ? "Поиск в избранном..." : "Поиск по вики..."}
          className="flex-1 bg-transparent border-0 outline-none text-xs text-foreground placeholder-muted-foreground py-0.5"
        />
        {isLoading && (
          <div className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin shrink-0" />
        )}
        {user && favoriteArticles.length > 0 && isFocused && (
          <button
            onClick={() => setSearchOnlyFavorites(prev => !prev)}
            className={`p-1 rounded transition-colors cursor-pointer shrink-0 flex items-center gap-0.5 ${
              searchOnlyFavorites ? 'text-amber-500 bg-amber-500/10' : 'text-muted-foreground'
            }`}
            title={searchOnlyFavorites ? "Поиск по всем статьям" : "Поиск только в избранном"}
          >
            <Star className={`w-3 h-3 ${searchOnlyFavorites ? 'fill-amber-400 text-amber-500' : ''}`} />
            <span className="text-[9px] hidden lg:inline font-bold">Избранное</span>
          </button>
        )}
        {!query && (
          <kbd className="hidden md:inline-flex h-4 select-none items-center gap-0.5 rounded border border-border bg-card px-1 font-mono text-[9px] font-medium text-muted-foreground opacity-100">
            <span>⌘</span>K
          </kbd>
        )}
        {query && (
          <button
            onClick={() => setQuery('')}
            className="p-0.5 rounded hover:bg-muted text-muted-foreground"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Desktop Dropdown */}
      <AnimatePresence>
        {isFocused && query.trim().length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.99 }}
            transition={{ duration: 0.15 }}
            className={`absolute top-full right-0 mt-2 bg-card border-2 border-indigo-500 rounded-xl shadow-[0_15px_40px_rgba(99,102,241,0.15)] z-50 overflow-hidden flex flex-col max-h-[350px] transition-all duration-300 ${
              selectedCar ? 'w-[720px]' : 'w-[420px]'
            }`}
          >
            {renderDropdownContent()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Modal Portal */}
      {createPortal(renderMobileModal(), document.body)}
    </div>
  );
}
