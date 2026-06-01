import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  MapPin, 
  Sliders, 
  CheckCircle2, 
  XCircle, 
  ChevronDown, 
  ChevronUp, 
  Info, 
  X,
  AlertTriangle,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CITIES, 
  TARIFFS, 
  CAR_DATA, 
  City,
  getSavedCityId,
  saveCityId
} from '../lib/classifier-data';
import { fetchClassifierData } from '../lib/api';

interface TariffAccordionProps {
  tariff: typeof TARIFFS[0];
  selectedCity: City;
  isOpen: boolean;
  onToggle: () => void;
  carData: typeof CAR_DATA;
}

function TariffAccordion({ tariff, selectedCity, isOpen, onToggle, carData }: TariffAccordionProps) {
  const [search, setSearch] = React.useState('');

  const allowedCars = React.useMemo(() => {
    return carData.filter(car => car.years[tariff.key] !== undefined);
  }, [carData, tariff.key]);

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
                        const hasWarning = car.warnings?.[tariff.key];
                        return (
                          <tr 
                            key={`${car.brand}-${car.model}-${idx}`}
                            className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/10 transition-colors"
                          >
                            <td className="px-4 py-2.5 font-medium text-neutral-800 dark:text-neutral-200">
                              <div className="flex items-center gap-1.5">
                                <span>{car.brand} {car.model}</span>
                                {hasWarning && (
                                  <span title={car.warnings?.[tariff.key]} className="cursor-help text-amber-500 hover:text-amber-600 shrink-0">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                  </span>
                                )}
                              </div>
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

export default function TariffsClassifier() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [carData, setCarData] = React.useState<typeof CAR_DATA>(CAR_DATA);

  React.useEffect(() => {
    fetchClassifierData()
      .then(data => {
        if (data && Array.isArray(data) && data.length > 0) {
          setCarData(data);
        }
      })
      .catch(err => {
        console.error('Failed to load classifier data, using static fallback:', err);
      });
  }, []);
  
  // Read URL params for pre-filling from search modal
  const paramBrand = searchParams.get('brand') || '';
  const paramModel = searchParams.get('model') || '';
  const paramYear = searchParams.get('year');
  const paramCity = searchParams.get('city');
  
  const initialCity = React.useMemo(() => {
    if (paramCity) {
      const city = CITIES.find(c => c.id === paramCity);
      if (city) {
        saveCityId(city.id); // sync to localStorage
        return city;
      }
    }
    const savedId = getSavedCityId();
    return CITIES.find(c => c.id === savedId) || CITIES[0];
  }, [paramCity]);
  
  const [selectedCity, setSelectedCity] = React.useState<City>(initialCity);
  const [selectedBrand, setSelectedBrand] = React.useState(paramBrand);
  const [selectedModel, setSelectedModel] = React.useState(paramModel);
  const [selectedYear, setSelectedYear] = React.useState<number | ''>(paramYear ? Number(paramYear) : '');
  const [isCityDrawerOpen, setIsCityDrawerOpen] = React.useState(false);
  const [citySearchQuery, setCitySearchQuery] = React.useState('');
  
  // Accordion states: we can track which index/key is open
  const [openAccordion, setOpenAccordion] = React.useState<string | null>(TARIFFS[0].key);

  // Sync selectedCity state when initialCity (derived from URL) changes
  React.useEffect(() => {
    setSelectedCity(initialCity);
  }, [initialCity]);

  // Sync selectedBrand, selectedModel, and selectedYear when they change in URL (e.g. via search modal)
  React.useEffect(() => {
    setSelectedBrand(paramBrand);
  }, [paramBrand]);

  React.useEffect(() => {
    setSelectedModel(paramModel);
  }, [paramModel]);

  React.useEffect(() => {
    setSelectedYear(paramYear ? Number(paramYear) : '');
  }, [paramYear]);

  // Sync state to URL if query param is not set
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('city')) {
      params.set('city', initialCity.id);
      setSearchParams(params, { replace: true });
    }
  }, [initialCity.id, setSearchParams]);

  // Sync state to local storage and URL when city is selected
  const handleCitySelect = (city: City) => {
    setSelectedCity(city);
    saveCityId(city.id);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('city', city.id);
    setSearchParams(newParams, { replace: true });
  };

  const dynamicBrands = React.useMemo(() => {
    return Array.from(new Set(carData.map(c => c.brand))).sort();
  }, [carData]);

  const availableModels = React.useMemo(() => {
    if (!selectedBrand) return [];
    return carData.filter(c => c.brand === selectedBrand).map(c => c.model).sort();
  }, [selectedBrand, carData]);

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

  const getCarStatusDynamic = React.useCallback((brand: string, modelName: string, year: number, cityId: string) => {
    const city = CITIES.find(c => c.id === cityId) || CITIES[0];
    const car = carData.find(
      c => c.brand.toLowerCase() === brand.toLowerCase() && 
           c.model.toLowerCase() === modelName.toLowerCase()
    );

    if (!car) return null;

    const results: Record<string, { fits: boolean; minYear: number; warning?: string }> = {};

    Object.entries(car.years).forEach(([tariffKey, baseMinYear]) => {
      // Dynamically apply city offset, ensuring min limit
      const requiredYear = Math.max(1980, baseMinYear + city.offset);
      results[tariffKey] = {
        fits: year >= requiredYear,
        minYear: requiredYear,
        warning: car.warnings?.[tariffKey]
      };
    });

    return results;
  }, [carData]);

  const checkResults = React.useMemo(() => {
    if (!selectedBrand || !selectedModel || !selectedYear) return null;
    return getCarStatusDynamic(selectedBrand, selectedModel, Number(selectedYear), selectedCity.id);
  }, [selectedBrand, selectedModel, selectedYear, selectedCity, getCarStatusDynamic]);

  return (
    <div className="space-y-8 mt-6">
      {/* City Indicator and Switcher */}
      <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-indigo-500/10 bg-indigo-500/[0.02] dark:bg-indigo-500/[0.01]">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-indigo-500" />
          <div>
            <span className="text-[10px] uppercase font-bold text-neutral-450 tracking-wider">Текущий город</span>
            <div className="text-sm font-bold text-neutral-900 dark:text-white">{selectedCity.name}</div>
          </div>
        </div>
        <button 
          onClick={() => setIsCityDrawerOpen(true)}
          className="px-3 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-lg transition-colors cursor-pointer"
        >
          Сменить город
        </button>
      </div>

      {/* 1. Calculator Card */}
      <div className="p-6 rounded-xl border border-neutral-200/50 dark:border-neutral-800 bg-white dark:bg-neutral-950 shadow-premium dark:shadow-premium-dark">
        <h2 className="font-outfit text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2 mb-4">
          <Sliders className="w-4.5 h-4.5 text-indigo-500" />
          Проверить пригодность автомобиля
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Brand */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Марка</label>
            <select 
              value={selectedBrand} 
              onChange={(e) => {
                setSelectedBrand(e.target.value);
                setSelectedModel('');
                setSelectedYear('');
              }}
              className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500 dark:focus:border-indigo-500 text-neutral-900 dark:text-white transition-colors"
            >
              <option value="">Выберите марку</option>
              {dynamicBrands.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Model */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Модель</label>
            <select 
              value={selectedModel} 
              onChange={(e) => {
                setSelectedModel(e.target.value);
                setSelectedYear('');
              }}
              disabled={!selectedBrand}
              className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500 dark:focus:border-indigo-500 text-neutral-900 dark:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Выберите модель</option>
              {availableModels.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Year */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Год выпуска</label>
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(e.target.value === '' ? '' : Number(e.target.value))}
              disabled={!selectedModel}
              className="w-full bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-850 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500 dark:focus:border-indigo-500 text-neutral-900 dark:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                <span className="text-[10px] font-bold text-neutral-450 uppercase tracking-wider">
                  Результаты проверки для {selectedBrand} {selectedModel} ({selectedYear} г.) в г. {selectedCity.name}
                </span>
              </div>

              {!checkResults ? (
                <div className="p-4 rounded-lg bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-805 text-xs text-neutral-500 dark:text-neutral-400 flex items-start gap-2">
                  <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <div>
                    <strong>Автомобиль не найден в нашей автоматической базе.</strong> Обычно это означает, что требования для него рассматриваются индивидуально или марка не поддерживается в Яндекс Про. Пожалуйста, обратитесь в таксопарк для ручной проверки.
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {TARIFFS.filter(t => selectedCity.tariffs.includes(t.key)).map(t => {
                    const res = checkResults[t.key];
                    if (!res) {
                      return (
                        <div 
                          key={t.key} 
                          className="p-4 rounded-xl border border-neutral-200/50 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-900/30 opacity-60 flex flex-col justify-between"
                        >
                          <div>
                            <div className="font-bold text-sm text-neutral-800 dark:text-neutral-205">{t.name}</div>
                            <p className="text-[11px] text-neutral-400 mt-1 line-clamp-2">{t.description}</p>
                          </div>
                          <div className="mt-3 flex items-center gap-1.5 text-xs text-neutral-450">
                            <Info className="w-3.5 h-3.5 text-neutral-400" />
                            Не поддерживается
                          </div>
                        </div>
                      );
                    }

                    const hasWarning = !!res.warning;

                    return (
                      <div 
                        key={t.key} 
                        className={`p-4 rounded-xl border transition-all duration-300 flex flex-col justify-between ${
                          hasWarning
                            ? 'border-amber-500/30 bg-amber-500/[0.03] dark:bg-amber-500/[0.02]'
                            : res.fits 
                              ? 'border-emerald-500/20 bg-emerald-500/[0.03] dark:bg-emerald-500/[0.02]' 
                              : 'border-rose-500/20 bg-rose-500/[0.03] dark:bg-rose-500/[0.02]'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-sm text-neutral-900 dark:text-white shrink-0">{t.name}</span>
                            {hasWarning ? (
                              <span 
                                title={res.warning}
                                className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded cursor-help flex items-center gap-1 shrink-0"
                              >
                                <AlertTriangle className="w-3 h-3" />
                                Внимание
                              </span>
                            ) : res.fits ? (
                              <span className="text-[10px] font-semibold text-emerald-650 dark:text-emerald-450 bg-emerald-50/10 px-2 py-0.5 rounded shrink-0">
                                Подходит
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded shrink-0">
                                Не подходит
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
                            {t.description}
                          </p>
                        </div>
                        <div className="mt-4 flex items-start gap-2 text-xs">
                          {hasWarning ? (
                            <>
                              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                              <span className="text-amber-805 dark:text-amber-400 font-medium leading-tight cursor-help text-[11px]" title={res.warning}>
                                {res.warning}
                              </span>
                            </>
                          ) : res.fits ? (
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
          <h2 className="font-outfit text-base font-bold text-neutral-900 dark:text-white">
            Требования к автомобилям по тарифам
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 font-light">
            Разверните интересующий вас тариф ниже, чтобы увидеть полный список разрешенных моделей и года выпуска для города <strong>{selectedCity.name}</strong>.
          </p>
        </div>

        {TARIFFS.filter(t => selectedCity.tariffs.includes(t.key)).map(tariff => (
          <TariffAccordion 
            key={tariff.key}
            tariff={tariff}
            selectedCity={selectedCity}
            isOpen={openAccordion === tariff.key}
            onToggle={() => setOpenAccordion(openAccordion === tariff.key ? null : tariff.key)}
            carData={carData}
          />
        ))}
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
                <h3 className="font-outfit font-bold text-sm text-neutral-955 dark:text-white">Выберите город</h3>
                <button 
                  onClick={() => setIsCityDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
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
                    className="w-full bg-transparent outline-none text-xs text-neutral-900 dark:text-white placeholder-neutral-400"
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
                  <div className="text-center py-12 text-xs text-neutral-450 font-light">
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
                                handleCitySelect(city);
                                setIsCityDrawerOpen(false);
                                setCitySearchQuery('');
                              }}
                              className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all duration-200 cursor-pointer ${
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
