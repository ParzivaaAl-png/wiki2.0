import * as React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  MapPin, 
  Search, 
  X, 
  AlertTriangle, 
  ArrowLeft,
  ChevronRight
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

interface TariffDetailsProps {
  tariffKey: string;
}

export default function TariffDetails({ tariffKey }: TariffDetailsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [carData, setCarData] = React.useState<typeof CAR_DATA>(CAR_DATA);
  const [search, setSearch] = React.useState('');
  const [isCityDrawerOpen, setIsCityDrawerOpen] = React.useState(false);
  const [citySearchQuery, setCitySearchQuery] = React.useState('');

  React.useEffect(() => {
    fetchClassifierData()
      .then(data => {
        if (data && Array.isArray(data) && data.length > 0) {
          setCarData(data);
        }
      })
      .catch(err => {
        console.error('Failed to load classifier data in TariffDetails, using static fallback:', err);
      });
  }, []);

  const tariff = React.useMemo(() => {
    return TARIFFS.find(t => t.key === tariffKey);
  }, [tariffKey]);

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

  // Keep selectedCity in sync if initialCity (derived from URL) changes
  React.useEffect(() => {
    setSelectedCity(initialCity);
  }, [initialCity]);

  // Sync state to URL if query param is not set
  React.useEffect(() => {
    if (!searchParams.has('city')) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('city', initialCity.id);
      setSearchParams(nextParams, { replace: true });
    }
  }, [initialCity.id, searchParams, setSearchParams]);

  // Sync state to local storage and URL when city is selected
  const handleCitySelect = (city: City) => {
    setSelectedCity(city);
    saveCityId(city.id);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('city', city.id);
    setSearchParams(newParams, { replace: true });
  };

  const allowedCars = React.useMemo(() => {
    return carData.filter(car => car.years[tariffKey] !== undefined);
  }, [carData, tariffKey]);

  const filteredCars = React.useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return allowedCars;
    return allowedCars.filter(car => 
      car.brand.toLowerCase().includes(q) || 
      car.model.toLowerCase().includes(q) ||
      `${car.brand} ${car.model}`.toLowerCase().includes(q)
    );
  }, [allowedCars, search]);

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

  if (!tariff || !selectedCity.tariffs.includes(tariffKey)) {
    return (
      <div className="py-12 text-center">
        <h3 className="text-base font-bold text-red-500">
          Тариф «{tariff?.name || tariffKey}» не доступен в г. {selectedCity.name}
        </h3>
        <Link to={`/articles/auto-list?city=${selectedCity.id}`} className="text-xs text-indigo-500 hover:underline mt-2 inline-block">
          Вернуться к классификатору
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 mt-4">
      {/* Back link */}
      <Link 
        to={`/articles/auto-list?city=${selectedCity.id}`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 dark:text-neutral-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors group"
      >
        <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
        <span>Назад к общему списку</span>
      </Link>

      {/* City Switcher Card */}
      <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-indigo-500/10 bg-indigo-500/[0.02] dark:bg-indigo-500/[0.01]">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-indigo-500" />
          <div>
            <span className="text-[10px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider">Текущий город</span>
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

      {/* Description and Search Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-outfit font-bold text-xl text-neutral-900 dark:text-white">
            Список подходящих автомобилей
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 font-light">
            Требования и года выпуска по тарифу «<strong>{tariff.name}</strong>» для города <strong>{selectedCity.name}</strong>.
          </p>
        </div>
        
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 w-full md:max-w-xs shadow-sm focus-within:border-indigo-500 transition-colors">
          <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
          <input 
            type="text"
            placeholder="Поиск марки или модели..."
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
      </div>

      {/* Main Table */}
      <div className="border border-neutral-200 dark:border-neutral-800/80 rounded-xl overflow-hidden bg-white dark:bg-neutral-950 shadow-premium dark:shadow-premium-dark">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto scrollbar-thin">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-neutral-50 dark:bg-neutral-900 text-neutral-500 dark:text-neutral-400 font-bold border-b border-neutral-200 dark:border-neutral-850 sticky top-0 z-10">
                <th className="px-5 py-3">Марка и модель</th>
                <th className="px-5 py-3 text-right">Минимальный год</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-900">
              {filteredCars.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-5 py-12 text-center text-neutral-400">
                    Автомобили не найдены
                  </td>
                </tr>
              ) : (
                filteredCars.map((car, idx) => {
                  const requiredYear = Math.max(1980, car.years[tariffKey] + selectedCity.offset);
                  const hasWarning = car.warnings?.[tariffKey];
                  return (
                    <tr 
                      key={`${car.brand}-${car.model}-${idx}`}
                      className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/10 transition-colors"
                    >
                      <td className="px-5 py-3.5 font-medium text-neutral-800 dark:text-neutral-200">
                        <div className="flex items-center gap-2">
                          <span>{car.brand} {car.model}</span>
                          {hasWarning && (
                            <span title={hasWarning} className="cursor-help text-amber-500 hover:text-amber-600 shrink-0">
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-neutral-600 dark:text-neutral-300">
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
              className="fixed inset-0 z-50 bg-black/60"
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
                <h3 className="font-outfit font-bold text-sm text-neutral-900 dark:text-white">Выберите город</h3>
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
                  <div className="text-center py-12 text-xs text-neutral-500 dark:text-neutral-400 font-light">
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
