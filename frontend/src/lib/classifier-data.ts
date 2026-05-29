export interface City {
  id: string;
  name: string;
  offset: number; // Offset applied to base years (Astana: +1 stricter, Semey: -2 lenient, etc.)
}

export interface Tariff {
  key: string;
  name: string;
  description: string;
}

export interface CarRequirement {
  brand: string;
  model: string;
  years: Record<string, number>; // base minimum years in Almaty (offset = 0)
}

export const CITIES: City[] = [
  { id: 'almaty', name: 'Алматы', offset: 0 },
  { id: 'astana', name: 'Астана', offset: 1 },
  { id: 'shymkent', name: 'Шымкент', offset: -1 },
  { id: 'karaganda', name: 'Караганда', offset: -1 },
  { id: 'aktobe', name: 'Актобе', offset: -1 },
  { id: 'taraz', name: 'Тараз', offset: -2 },
  { id: 'pavlodar', name: 'Павлодар', offset: -1 },
  { id: 'ust-kamenogorsk', name: 'Усть-Каменогорск', offset: -1 },
  { id: 'semey', name: 'Семей', offset: -2 },
  { id: 'uralsk', name: 'Уральск', offset: -2 },
  { id: 'kostanay', name: 'Костанай', offset: -1 },
  { id: 'kyzylorda', name: 'Кызылорда', offset: -2 },
  { id: 'atyrau', name: 'Атырау', offset: 0 },
  { id: 'aktau', name: 'Актау', offset: -1 },
  { id: 'temirtau', name: 'Темиртау', offset: -2 },
  { id: 'turkestan', name: 'Туркестан', offset: -3 },
  { id: 'kokshetau', name: 'Кокшетау', offset: -2 },
  { id: 'taldykorgan', name: 'Талдыкорган', offset: -2 },
  { id: 'rudny', name: 'Рудный', offset: -3 },
  { id: 'ekibastuz', name: 'Экибастуз', offset: -3 },
];

export const TARIFFS: Tariff[] = [
  { key: 'econom', name: 'Эконом', description: 'Базовый тариф для повседневных поездок.' },
  { key: 'intercity', name: 'Межгород', description: 'Комфортные поездки между городами.' },
  { key: 'comfort', name: 'Комфорт', description: 'Автомобили повышенного класса с просторным салоном.' },
  { key: 'comfort_plus', name: 'Комфорт+', description: 'Автомобили бизнес-класса повышенного комфорта.' },
  { key: 'business', name: 'Бизнес', description: 'Люксовые седаны и премиальный уровень обслуживания.' },
  { key: 'electro', name: 'Электро', description: 'Современные экологичные электромобили.' },
  { key: 'ultima', name: 'Ultima (Premier)', description: 'Представительские автомобили наивысшего класса.' },
];

export const CAR_DATA: CarRequirement[] = [
  // Toyota
  { brand: 'Toyota', model: 'Camry', years: { econom: 2000, intercity: 2005, comfort: 2011, comfort_plus: 2017, business: 2021 } },
  { brand: 'Toyota', model: 'Corolla', years: { econom: 2004, intercity: 2006, comfort: 2014 } },
  { brand: 'Toyota', model: 'Avensis', years: { econom: 2003, intercity: 2005, comfort: 2010 } },
  { brand: 'Toyota', model: 'RAV4', years: { econom: 2004, intercity: 2006, comfort: 2013, comfort_plus: 2019 } },
  { brand: 'Toyota', model: 'Land Cruiser', years: { econom: 2000, intercity: 2002, comfort: 2010, comfort_plus: 2016 } },
  { brand: 'Toyota', model: 'Land Cruiser Prado', years: { econom: 2002, intercity: 2004, comfort: 2011, comfort_plus: 2017 } },
  { brand: 'Toyota', model: 'Prius', years: { econom: 2004, intercity: 2006, comfort: 2015 } },
  { brand: 'Toyota', model: 'Yaris', years: { econom: 2005 } },
  { brand: 'Toyota', model: 'Carina', years: { econom: 1995 } },
  
  // Hyundai
  { brand: 'Hyundai', model: 'Accent', years: { econom: 2005, intercity: 2008, comfort: 2015 } },
  { brand: 'Hyundai', model: 'Solaris', years: { econom: 2011, intercity: 2012, comfort: 2016 } },
  { brand: 'Hyundai', model: 'Elantra', years: { econom: 2006, intercity: 2008, comfort: 2014, comfort_plus: 2020 } },
  { brand: 'Hyundai', model: 'Sonata', years: { econom: 2004, intercity: 2006, comfort: 2013, comfort_plus: 2018, business: 2022 } },
  { brand: 'Hyundai', model: 'Tucson', years: { econom: 2006, intercity: 2008, comfort: 2014, comfort_plus: 2020 } },
  { brand: 'Hyundai', model: 'Santa Fe', years: { econom: 2005, intercity: 2007, comfort: 2012, comfort_plus: 2018 } },
  { brand: 'Hyundai', model: 'Creta', years: { econom: 2016, comfort: 2018 } },
  { brand: 'Hyundai', model: 'Getz', years: { econom: 2003 } },
  { brand: 'Hyundai', model: 'i30', years: { econom: 2007, comfort: 2015 } },

  // Kia
  { brand: 'Kia', model: 'Rio', years: { econom: 2005, intercity: 2008, comfort: 2015 } },
  { brand: 'Kia', model: 'Cerato', years: { econom: 2006, intercity: 2008, comfort: 2014, comfort_plus: 2020 } },
  { brand: 'Kia', model: 'Optima', years: { econom: 2006, intercity: 2008, comfort: 2013, comfort_plus: 2018 } },
  { brand: 'Kia', model: 'K5', years: { comfort: 2020, comfort_plus: 2020, business: 2021 } },
  { brand: 'Kia', model: 'Sportage', years: { econom: 2006, intercity: 2008, comfort: 2013, comfort_plus: 2019 } },
  { brand: 'Kia', model: 'Sorento', years: { econom: 2005, intercity: 2007, comfort: 2012, comfort_plus: 2018 } },
  { brand: 'Kia', model: 'Soul', years: { econom: 2009, comfort: 2015 } },
  { brand: 'Kia', model: 'Ceed', years: { econom: 2007, comfort: 2014 } },
  { brand: 'Kia', model: 'Picanto', years: { econom: 2008 } },

  // Chevrolet
  { brand: 'Chevrolet', model: 'Cobalt', years: { econom: 2013, intercity: 2014, comfort: 2019 } },
  { brand: 'Chevrolet', model: 'Cruze', years: { econom: 2009, intercity: 2011, comfort: 2015 } },
  { brand: 'Chevrolet', model: 'Aveo', years: { econom: 2006 } },
  { brand: 'Chevrolet', model: 'Lacetti', years: { econom: 2004, intercity: 2006 } },
  { brand: 'Chevrolet', model: 'Nexia', years: { econom: 2015 } },
  { brand: 'Chevrolet', model: 'Spark', years: { econom: 2010 } },
  { brand: 'Chevrolet', model: 'Tracker', years: { econom: 2013, comfort: 2018 } },
  { brand: 'Chevrolet', model: 'Captiva', years: { econom: 2006, comfort: 2012 } },
  { brand: 'Chevrolet', model: 'Orlando', years: { econom: 2011, comfort: 2015 } },
  { brand: 'Chevrolet', model: 'Malibu', years: { econom: 2010, comfort: 2014, comfort_plus: 2018, business: 2021 } },

  // Volkswagen
  { brand: 'Volkswagen', model: 'Polo', years: { econom: 2006, intercity: 2008, comfort: 2015 } },
  { brand: 'Volkswagen', model: 'Passat', years: { econom: 2000, intercity: 2002, comfort: 2012 } },
  { brand: 'Volkswagen', model: 'Golf', years: { econom: 1998 } },
  { brand: 'Volkswagen', model: 'Jetta', years: { econom: 2005, comfort: 2014 } },
  { brand: 'Volkswagen', model: 'Tiguan', years: { econom: 2008, comfort: 2014, comfort_plus: 2019 } },
  { brand: 'Volkswagen', model: 'Touareg', years: { econom: 2004, comfort: 2010, comfort_plus: 2016 } },

  // Mercedes-Benz
  { brand: 'Mercedes-Benz', model: 'E-Class', years: { econom: 2000, intercity: 2002, comfort: 2008, comfort_plus: 2014, business: 2019, ultima: 2023 } },
  { brand: 'Mercedes-Benz', model: 'C-Class', years: { econom: 2000, intercity: 2002, comfort: 2010, comfort_plus: 2016 } },
  { brand: 'Mercedes-Benz', model: 'S-Class', years: { business: 2015, ultima: 2018 } },
  { brand: 'Mercedes-Benz', model: 'GL-Class', years: { comfort_plus: 2012, business: 2016 } },
  { brand: 'Mercedes-Benz', model: 'ML-Class', years: { comfort: 2008, comfort_plus: 2014 } },

  // BMW
  { brand: 'BMW', model: '3er', years: { econom: 2000, comfort: 2011, comfort_plus: 2017 } },
  { brand: 'BMW', model: '5er', years: { econom: 2000, comfort: 2009, comfort_plus: 2015, business: 2019, ultima: 2023 } },
  { brand: 'BMW', model: '7er', years: { business: 2015, ultima: 2018 } },
  { brand: 'BMW', model: 'X5', years: { comfort: 2007, comfort_plus: 2013, business: 2018 } },
  { brand: 'BMW', model: 'X6', years: { comfort_plus: 2012, business: 2017 } },

  // Audi
  { brand: 'Audi', model: '80', years: { econom: 1985 } },
  { brand: 'Audi', model: '100', years: { econom: 1985 } },
  { brand: 'Audi', model: 'A4', years: { econom: 2000, comfort: 2011 } },
  { brand: 'Audi', model: 'A6', years: { econom: 2000, comfort: 2010, comfort_plus: 2016, business: 2021 } },
  { brand: 'Audi', model: 'A8', years: { business: 2014, ultima: 2018 } },
  
  // Lexus
  { brand: 'Lexus', model: 'RX', years: { econom: 2003, comfort: 2011, comfort_plus: 2016 } },
  { brand: 'Lexus', model: 'ES', years: { econom: 2004, comfort: 2012, comfort_plus: 2017, business: 2021 } },
  { brand: 'Lexus', model: 'GS', years: { econom: 2004, comfort: 2011, comfort_plus: 2016 } },
  { brand: 'Lexus', model: 'LX', years: { comfort_plus: 2010, business: 2016 } },
  
  // Nissan
  { brand: 'Nissan', model: 'Primera', years: { econom: 2000 } },
  { brand: 'Nissan', model: 'Maxima', years: { econom: 2000, comfort: 2008 } },
  { brand: 'Nissan', model: 'Almera', years: { econom: 2005 } },
  { brand: 'Nissan', model: 'Qashqai', years: { econom: 2007, comfort: 2013 } },
  { brand: 'Nissan', model: 'X-Trail', years: { econom: 2005, comfort: 2012 } },
  
  // Lada
  { brand: 'Lada (VAZ)', model: 'Granta', years: { econom: 2012 } },
  { brand: 'Lada (VAZ)', model: 'Vesta', years: { econom: 2015, comfort: 2020 } },
  { brand: 'Lada (VAZ)', model: 'Largus', years: { econom: 2012 } },
  { brand: 'Lada (VAZ)', model: 'Priora', years: { econom: 2010 } },
  { brand: 'Lada (VAZ)', model: 'Kalina', years: { econom: 2010 } },

  // Daewoo
  { brand: 'Daewoo', model: 'Nexia', years: { econom: 2005 } },
  { brand: 'Daewoo', model: 'Matiz', years: { econom: 2005 } },
  { brand: 'Daewoo', model: 'Gentra', years: { econom: 2013 } },
  { brand: 'Daewoo', model: 'Lanos', years: { econom: 2004 } },

  // Zeekr
  { brand: 'Zeekr', model: '001', years: { electro: 2021, comfort_plus: 2021, business: 2022, ultima: 2023 } },
  { brand: 'Zeekr', model: 'X', years: { electro: 2023, comfort: 2023 } },
  { brand: 'Zeekr', model: '009', years: { electro: 2023, business: 2023, ultima: 2023 } },

  // BYD
  { brand: 'BYD', model: 'Han', years: { electro: 2020, comfort_plus: 2020, business: 2022 } },
  { brand: 'BYD', model: 'Song', years: { electro: 2021, comfort: 2021 } },
  { brand: 'BYD', model: 'F3', years: { econom: 2007 } },

  // Tesla
  { brand: 'Tesla', model: 'Model 3', years: { electro: 2018, comfort_plus: 2019 } },
  { brand: 'Tesla', model: 'Model S', years: { electro: 2015, comfort_plus: 2017, business: 2020 } },
  { brand: 'Tesla', model: 'Model Y', years: { electro: 2020, comfort_plus: 2020 } },
  
  // Chery
  { brand: 'Chery', model: 'Tiggo 4 Pro', years: { econom: 2021 } },
  { brand: 'Chery', model: 'Tiggo 7 Pro', years: { econom: 2020, comfort: 2021, comfort_plus: 2023 } },
  { brand: 'Chery', model: 'Tiggo 8 Pro', years: { comfort: 2020, comfort_plus: 2021, business: 2023 } },
  
  // Haval
  { brand: 'Haval', model: 'Jolion', years: { econom: 2021, comfort: 2021 } },
  { brand: 'Haval', model: 'F7', years: { econom: 2019, comfort: 2019, comfort_plus: 2021 } },
  { brand: 'Haval', model: 'H6', years: { econom: 2020, comfort: 2020, comfort_plus: 2022 } },
  
  // Changan
  { brand: 'Changan', model: 'Alsvin', years: { econom: 2020 } },
  { brand: 'Changan', model: 'CS35 Plus', years: { econom: 2018, comfort: 2020 } },
  { brand: 'Changan', model: 'CS55 Plus', years: { econom: 2021, comfort: 2021, comfort_plus: 2023 } },
];

export const BRANDS = Array.from(new Set(CAR_DATA.map(c => c.brand))).sort();

// Helper to determine what tariffs a car fits in for a specific city
export function getCarStatus(brand: string, modelName: string, year: number, cityId: string) {
  const city = CITIES.find(c => c.id === cityId) || CITIES[0];
  const car = CAR_DATA.find(
    c => c.brand.toLowerCase() === brand.toLowerCase() && 
         c.model.toLowerCase() === modelName.toLowerCase()
  );

  if (!car) return null;

  const results: Record<string, { fits: boolean; minYear: number }> = {};

  Object.entries(car.years).forEach(([tariffKey, baseMinYear]) => {
    // Dynamically apply city offset, ensuring min limit
    const requiredYear = Math.max(1980, baseMinYear + city.offset);
    results[tariffKey] = {
      fits: year >= requiredYear,
      minYear: requiredYear,
    };
  });

  return results;
}

// Find if search query matches a car name
export function findCarMatch(queryText: string) {
  const q = queryText.toLowerCase().trim();
  if (q.length < 2) return null;

  // Split query into words to support partial matching
  const words = q.split(/\s+/);

  for (const car of CAR_DATA) {
    const brand = car.brand.toLowerCase();
    const modelName = car.model.toLowerCase();
    const fullName = `${brand} ${modelName}`;

    // Exact matches
    if (q === brand || q === modelName || q === fullName) {
      return car;
    }

    // Contains matches
    if (fullName.includes(q)) {
      return car;
    }

    // If query contains both brand and modelName
    if (words.length >= 2) {
      const hasBrand = words.some(w => brand.includes(w) || w.includes(brand));
      const hasModel = words.some(w => modelName.includes(w) || w.includes(modelName));
      if (hasBrand && hasModel) {
        return car;
      }
    }
  }

  // Fallback: check if the query matches just a brand name to suggest the first model
  for (const car of CAR_DATA) {
    const brand = car.brand.toLowerCase();
    if (q === brand || brand.includes(q)) {
      return car;
    }
  }

  return null;
}
