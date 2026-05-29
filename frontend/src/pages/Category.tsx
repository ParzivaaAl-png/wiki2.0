import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import { 
  ChevronRight, 
  Calendar, 
  FileText, 
  ArrowLeft,
  MapPin, 
  Search, 
  Sliders, 
  Car, 
  CheckCircle2, 
  XCircle, 
  ChevronDown, 
  ChevronUp, 
  Info, 
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchCategory, fetchArticles, Category as CategoryType, Article } from '../lib/api';
import { CategoryIcon } from '../components/icon';
import { 
  CITIES, 
  TARIFFS, 
  CAR_DATA, 
  getCarStatus, 
  BRANDS,
  City
} from '../lib/classifier-data';

export default function Category() {
  const { slug } = useParams<{ slug: string }>();
  const [category, setCategory] = React.useState<CategoryType | null>(null);
  const [articles, setArticles] = React.useState<Article[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadCategoryData() {
      if (!slug) return;
      setIsLoading(true);
      try {
        const [catData, artsData] = await Promise.all([
          fetchCategory(slug),
          fetchArticles({ category: slug }),
        ]);
        setCategory(catData);
        setArticles(artsData);
      } catch (err) {
        console.error('Failed to load category details:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadCategoryData();
  }, [slug]);

  const getArticlePlural = (count: number) => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return 'статья';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'статьи';
    return 'статей';
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 animate-pulse space-y-6">
        <div className="h-4 w-24 bg-neutral-200 dark:bg-neutral-800 rounded" />
        <div className="h-28 bg-neutral-200 dark:bg-neutral-800 rounded-xl" />
        <div className="space-y-4 pt-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 bg-neutral-200 dark:bg-neutral-800 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <h2 className="font-outfit text-xl font-bold">Раздел не найден</h2>
        <p className="text-sm text-neutral-400 mt-2">Запрошенный вами раздел документации не существует.</p>
        <Link to="/" className="inline-flex items-center gap-1 mt-4 text-xs font-semibold text-indigo-500 hover:underline">
          <ArrowLeft className="w-3.5 h-3.5" /> Назад на главную
        </Link>
      </div>
    );
  }

  if (slug === 'tariffs') {
    return <TariffsClassifierView category={category} />;
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  };

  const itemVariants = {
    hidden: { y: 15, opacity: 0 },
    show: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } },
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] py-12">
      {/* Decorative Blur */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[300px] pointer-events-none -z-10 opacity-30">
        <div className="absolute top-[-20%] left-[20%] w-[350px] h-[300px] rounded-full bg-indigo-500/20 blur-[100px]" />
      </div>

      <div className="max-w-4xl mx-auto px-4">
        {/* Back Link */}
        <Link 
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-indigo-500 transition-colors mb-6 font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Назад на главную
        </Link>

        {/* Category Header Card */}
        <div className="flex items-start gap-4 p-6 rounded-xl border border-neutral-200/50 dark:border-neutral-800/80 bg-white dark:bg-neutral-950 shadow-premium dark:shadow-premium-dark mb-10">
          <div className="w-12 h-12 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center border border-indigo-500/20 shrink-0">
            <CategoryIcon name={category.icon} className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-outfit text-2xl font-extrabold text-neutral-950 dark:text-white">
              {category.name}
            </h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1 font-light">
              {category.description}
            </p>
            <span className="inline-block mt-3 text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider bg-neutral-100 dark:bg-neutral-900/60 px-2 py-0.5 rounded">
              {articles.length} {getArticlePlural(articles.length)}
            </span>
          </div>
        </div>

        {/* Articles List */}
        {articles.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-xl">
            <FileText className="w-8 h-8 text-neutral-300 dark:text-neutral-700 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-neutral-700 dark:text-neutral-300">Статей пока нет</h3>
            <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
              В этой категории пока нет документов. Перейдите в панель администрирования, чтобы создать первую статью.
            </p>
            <Link 
              to="/admin/editor/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 mt-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              Написать первую статью
            </Link>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-4"
          >
            {articles.map((art) => (
              <motion.div
                key={art.id}
                variants={itemVariants}
                className="group p-5 rounded-xl border border-neutral-200/50 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-premium dark:shadow-premium-dark hover:border-indigo-500/20 dark:hover:border-indigo-500/20 hover:shadow-glow dark:hover:shadow-glow transition-all duration-300"
              >
                <div className="flex items-center gap-2 mb-2 text-xs text-neutral-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {new Date(art.updated_at).toLocaleDateString()}
                  </span>
                </div>

                <Link
                  to={`/articles/${art.slug}`}
                  className="font-outfit text-lg font-bold text-neutral-900 dark:text-white hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors block"
                >
                  {art.title}
                </Link>

                <p className="text-neutral-500 dark:text-neutral-400 text-xs mt-2 line-clamp-2 font-light leading-relaxed">
                  {art.summary}
                </p>

                {art.tags && art.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {art.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] px-2 py-0.5 rounded border border-neutral-200/50 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/40 text-neutral-500 dark:text-neutral-400 font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-neutral-100 dark:border-neutral-900 flex justify-end">
                  <Link
                    to={`/articles/${art.slug}`}
                    className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 flex items-center gap-1 transition-colors"
                  >
                    Читать статью <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// VEHICLE CLASSIFIER INTERACTIVE COMPONENTS
// ============================================================================

interface TariffAccordionProps {
  tariff: typeof TARIFFS[0];
  selectedCity: City;
  isOpen: boolean;
  onToggle: () => void;
}

function TariffAccordion({ tariff, selectedCity, isOpen, onToggle }: TariffAccordionProps) {
  const [search, setSearch] = React.useState('');

  const allowedCars = React.useMemo(() => {
    return CAR_DATA.filter(car => car.years[tariff.key] !== undefined);
  }, [tariff.key]);

  const filteredCars = React.useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return allowedCars;
    return allowedCars.filter(car => 
      car.brand.toLowerCase().includes(q) || 
      car.model.toLowerCase().includes(q) ||
      `${car.brand} ${car.model}`.toLowerCase().includes(q)
    );
  }, [allowedCars, search]);

  return (
    <div className="border border-neutral-200 dark:border-neutral-800/80 rounded-xl overflow-hidden bg-white dark:bg-neutral-950 transition-all shadow-premium dark:shadow-premium-dark">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-colors"
      >
        <div>
          <span className="font-outfit font-bold text-base text-neutral-900 dark:text-white">
            Тариф «{tariff.name}»
          </span>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 font-light max-w-2xl line-clamp-1">
            {tariff.description}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-semibold text-neutral-450 dark:text-neutral-550 bg-neutral-100 dark:bg-neutral-900 px-2 py-0.5 rounded">
            {allowedCars.length} авто
          </span>
          {isOpen ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
        </div>
      </button>

      {/* Content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-2 border-t border-neutral-100 dark:border-neutral-900 space-y-4">
              {/* Search bar inside accordion */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 max-w-sm">
                <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <input 
                  type="text"
                  placeholder="Поиск по марке или модели..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-transparent outline-none text-xs text-neutral-900 dark:text-white placeholder-neutral-400"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="p-0.5 rounded text-neutral-400">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800 max-h-[320px] overflow-y-auto scrollbar-thin">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-neutral-50 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 font-semibold border-b border-neutral-200 dark:border-neutral-850">
                      <th className="px-4 py-2.5">Марка и модель</th>
                      <th className="px-4 py-2.5 text-right">Минимальный год</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-900">
                    {filteredCars.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="px-4 py-8 text-center text-neutral-400">
                          Автомобили не найдены
                        </td>
                      </tr>
                    ) : (
                      filteredCars.map((car, idx) => {
                        const requiredYear = Math.max(1980, car.years[tariff.key] + selectedCity.offset);
                        return (
                          <tr 
                            key={`${car.brand}-${car.model}-${idx}`}
                            className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/10 transition-colors"
                          >
                            <td className="px-4 py-2.5 font-medium text-neutral-800 dark:text-neutral-200">
                              {car.brand} {car.model}
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold text-neutral-600 dark:text-neutral-300">
                              {requiredYear} г.
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TariffsClassifierView({ category }: { category: CategoryType }) {
  const [selectedCity, setSelectedCity] = React.useState<City>(CITIES[0]); // defaults to Almaty
  const [selectedBrand, setSelectedBrand] = React.useState('');
  const [selectedModel, setSelectedModel] = React.useState('');
  const [selectedYear, setSelectedYear] = React.useState<number | ''>('');
  const [isCityDrawerOpen, setIsCityDrawerOpen] = React.useState(false);
  const [citySearchQuery, setCitySearchQuery] = React.useState('');
  
  // Accordion states: we can track which index/key is open
  const [openAccordion, setOpenAccordion] = React.useState<string | null>(TARIFFS[0].key);

  const availableModels = React.useMemo(() => {
    if (!selectedBrand) return [];
    return CAR_DATA.filter(c => c.brand === selectedBrand).map(c => c.model).sort();
  }, [selectedBrand]);

  const years = React.useMemo(() => {
    return Array.from({ length: 2027 - 1980 }, (_, i) => 2026 - i);
  }, []);

  const filteredGroupedCities = React.useMemo(() => {
    const query = citySearchQuery.toLowerCase().trim();
    const filtered = CITIES.filter(c => c.name.toLowerCase().includes(query));
    
    const groups: Record<string, typeof CITIES> = {};
    filtered.forEach(city => {
      const firstLetter = city.name[0].toUpperCase();
      if (!groups[firstLetter]) {
        groups[firstLetter] = [];
      }
      groups[firstLetter].push(city);
    });
    
    const sortedKeys = Object.keys(groups).sort();
    sortedKeys.forEach(key => {
      groups[key].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    });
    
    return { keys: sortedKeys, groups };
  }, [citySearchQuery]);

  const checkResults = React.useMemo(() => {
    if (!selectedBrand || !selectedModel || !selectedYear) return null;
    return getCarStatus(selectedBrand, selectedModel, Number(selectedYear), selectedCity.id);
  }, [selectedBrand, selectedModel, selectedYear, selectedCity]);

  return (
    <div className="relative min-h-[calc(100vh-4rem)] py-12">
      {/* Decorative Blur */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[300px] pointer-events-none -z-10 opacity-30">
        <div className="absolute top-[-20%] left-[20%] w-[350px] h-[300px] rounded-full bg-indigo-500/20 blur-[100px]" />
      </div>

      <div className="max-w-4xl mx-auto px-4">
        {/* Back Link */}
        <Link 
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-indigo-500 transition-colors mb-6 font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Назад на главную
        </Link>

        {/* Category Header Card */}
        <div className="flex flex-col sm:flex-row items-start gap-4 p-6 rounded-xl border border-neutral-200/50 dark:border-neutral-800/80 bg-white dark:bg-neutral-950 shadow-premium dark:shadow-premium-dark mb-8">
          <div className="w-12 h-12 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center border border-indigo-500/20 shrink-0">
            <CategoryIcon name={category.icon} className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h1 className="font-outfit text-2xl font-extrabold text-neutral-950 dark:text-white">
              {category.name}
            </h1>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1 font-light">
              {category.description}
            </p>
            
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <span className="text-[10px] font-semibold text-indigo-500 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded uppercase tracking-wider">
                Интерактивный классификатор
              </span>
              <button 
                onClick={() => setIsCityDrawerOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:text-indigo-500 dark:hover:text-indigo-400 bg-neutral-105 hover:bg-indigo-500/10 dark:bg-neutral-900/60 dark:hover:bg-indigo-500/10 px-3 py-1 rounded-lg transition-all border border-neutral-200/30 dark:border-neutral-800/55"
              >
                <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                Город: {selectedCity.name}
                <span className="text-[10px] text-indigo-500 underline font-normal">(сменить)</span>
              </button>
            </div>
          </div>
        </div>

        {/* 1. Calculator Card */}
        <div className="p-6 rounded-xl border border-neutral-200/50 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-premium dark:shadow-premium-dark mb-8">
          <h2 className="font-outfit text-lg font-bold text-neutral-950 dark:text-white flex items-center gap-2 mb-4">
            <Sliders className="w-5 h-5 text-indigo-500" />
            Проверить пригодность автомобиля
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Brand */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Марка</label>
              <select 
                value={selectedBrand} 
                onChange={(e) => {
                  setSelectedBrand(e.target.value);
                  setSelectedModel('');
                  setSelectedYear('');
                }}
                className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 dark:focus:border-indigo-500 text-neutral-900 dark:text-white transition-colors"
              >
                <option value="">Выберите марку</option>
                {BRANDS.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Model */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Модель</label>
              <select 
                value={selectedModel} 
                onChange={(e) => {
                  setSelectedModel(e.target.value);
                  setSelectedYear('');
                }}
                disabled={!selectedBrand}
                className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 dark:focus:border-indigo-500 text-neutral-900 dark:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Выберите модель</option>
                {availableModels.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Year */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Год выпуска</label>
              <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(e.target.value === '' ? '' : Number(e.target.value))}
                disabled={!selectedModel}
                className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 dark:focus:border-indigo-500 text-neutral-900 dark:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Выберите год</option>
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Calculator Results */}
          <AnimatePresence>
            {selectedBrand && selectedModel && selectedYear && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="mt-6 pt-6 border-t border-neutral-100 dark:border-neutral-900"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                    Результаты проверки для {selectedBrand} {selectedModel} ({selectedYear} г.) в г. {selectedCity.name}
                  </span>
                </div>

                {!checkResults ? (
                  <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-500 dark:text-neutral-400 flex items-start gap-2">
                    <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                    <div>
                      <strong>Автомобиль не найден в нашей автоматической базе.</strong> Обычно это означает, что требования для него рассматриваются индивидуально или марка не поддерживается в Яндекс Про. Пожалуйста, обратитесь в таксопарк для ручной проверки.
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {TARIFFS.map(t => {
                      const res = checkResults[t.key];
                      if (!res) {
                        return (
                          <div 
                            key={t.key} 
                            className="p-4 rounded-xl border border-neutral-200/50 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-900/30 opacity-60 flex flex-col justify-between"
                          >
                            <div>
                              <div className="font-bold text-sm text-neutral-800 dark:text-neutral-200">{t.name}</div>
                              <p className="text-[11px] text-neutral-400 mt-1 line-clamp-2">{t.description}</p>
                            </div>
                            <div className="mt-3 flex items-center gap-1.5 text-xs text-neutral-400">
                              <Info className="w-3.5 h-3.5 text-neutral-400" />
                              Не поддерживается
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div 
                          key={t.key} 
                          className={`p-4 rounded-xl border transition-all duration-300 flex flex-col justify-between ${
                            res.fits 
                              ? 'border-emerald-500/20 bg-emerald-500/[0.03] dark:bg-emerald-500/[0.02]' 
                              : 'border-rose-500/20 bg-rose-500/[0.03] dark:bg-rose-500/[0.02]'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-sm text-neutral-900 dark:text-white">{t.name}</span>
                              {res.fits ? (
                                <span className="text-[10px] font-semibold text-emerald-650 dark:text-emerald-450 bg-emerald-50/10 px-2 py-0.5 rounded">
                                  Подходит
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">
                                  Не подходит
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                              {t.description}
                            </p>
                          </div>
                          <div className="mt-4 flex items-center gap-2 text-xs">
                            {res.fits ? (
                              <>
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                <span className="text-neutral-600 dark:text-neutral-300 leading-snug">
                                  Доступно от <strong>{res.minYear} г.</strong>
                                </span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                                <span className="text-neutral-500 dark:text-neutral-405 leading-snug">
                                  Требуется от <strong>{res.minYear} г.</strong>
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 2. Accordions Catalog */}
        <div className="space-y-4">
          <div className="mb-2">
            <h2 className="font-outfit text-lg font-bold text-neutral-900 dark:text-white">
              Требования к автомобилям по тарифам
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 font-light">
              Разверните интересующий вас тариф ниже, чтобы увидеть полный список разрешенных моделей и года выпуска для города <strong>{selectedCity.name}</strong>.
            </p>
          </div>

          {TARIFFS.map(tariff => (
            <TariffAccordion 
              key={tariff.key}
              tariff={tariff}
              selectedCity={selectedCity}
              isOpen={openAccordion === tariff.key}
              onToggle={() => setOpenAccordion(openAccordion === tariff.key ? null : tariff.key)}
            />
          ))}
        </div>
      </div>

      {/* City Drawer Portal */}
      <AnimatePresence>
        {isCityDrawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCityDrawerOpen(false)}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 z-[60] w-full max-w-md bg-white dark:bg-neutral-950 border-l border-neutral-200 dark:border-neutral-800 shadow-2xl flex flex-col h-full"
            >
              <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shrink-0">
                <h3 className="font-outfit font-bold text-lg text-neutral-950 dark:text-white">Выберите город</h3>
                <button 
                  onClick={() => setIsCityDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search bar */}
              <div className="p-4 border-b border-neutral-100 dark:border-neutral-900 shrink-0">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
                  <Search className="w-4 h-4 text-neutral-400 shrink-0" />
                  <input 
                    type="text"
                    placeholder="Поиск города..."
                    value={citySearchQuery}
                    onChange={(e) => setCitySearchQuery(e.target.value)}
                    className="w-full bg-transparent outline-none text-sm text-neutral-900 dark:text-white placeholder-neutral-400"
                  />
                  {citySearchQuery && (
                    <button onClick={() => setCitySearchQuery('')} className="p-0.5 rounded text-neutral-400">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Cities List grouped alphabetically */}
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {filteredGroupedCities.keys.length === 0 ? (
                  <div className="text-center py-12 text-sm text-neutral-450">
                    Город не найден
                  </div>
                ) : (
                  filteredGroupedCities.keys.map(letter => (
                    <div key={letter} className="space-y-2">
                      <div className="text-xs font-semibold text-indigo-500 uppercase px-1">{letter}</div>
                      <div className="grid grid-cols-2 gap-2">
                        {filteredGroupedCities.groups[letter].map(city => {
                          const isSelected = city.id === selectedCity.id;
                          return (
                            <button
                              key={city.id}
                              onClick={() => {
                                setSelectedCity(city);
                                setIsCityDrawerOpen(false);
                                setCitySearchQuery('');
                              }}
                              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                                isSelected 
                                  ? 'bg-indigo-500/10 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 font-semibold'
                                  : 'border border-neutral-100 dark:border-neutral-900 hover:border-neutral-200 dark:hover:border-neutral-800 bg-white dark:bg-neutral-950 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30'
                              }`}
                            >
                              {city.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
