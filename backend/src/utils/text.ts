const CYRILLIC_TO_LATIN: Record<string, string> = {
  'а': 'a', 'ә': 'ae', 'б': 'b', 'в': 'v', 'г': 'g', 'ғ': 'gh', 'д': 'd',
  'е': 'e', 'ё': 'e', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k',
  'қ': 'q', 'л': 'l', 'м': 'm', 'н': 'n', 'ң': 'ng', 'о': 'o', 'ө': 'oe',
  'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ұ': 'u', 'ү': 'ue',
  'ф': 'f', 'х': 'kh', 'һ': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
  'ъ': '', 'ы': 'y', 'і': 'i', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
};

const LATIN_TO_CYRILLIC_MAP: [string, string][] = [
  ['shch', 'щ'],
  ['sh', 'ш'],
  ['ch', 'ч'],
  ['zh', 'ж'],
  ['kh', 'х'],
  ['ts', 'ц'],
  ['yu', 'ю'],
  ['ya', 'я'],
  ['gh', 'ғ'],
  ['ng', 'ң'],
  ['oe', 'ө'],
  ['ae', 'ә'],
  ['ue', 'ү'],
  ['a', 'а'],
  ['b', 'б'],
  ['v', 'в'],
  ['g', 'г'],
  ['d', 'д'],
  ['e', 'е'],
  ['z', 'з'],
  ['i', 'и'],
  ['y', 'ы'],
  ['k', 'к'],
  ['q', 'қ'],
  ['l', 'л'],
  ['m', 'м'],
  ['n', 'н'],
  ['o', 'о'],
  ['p', 'п'],
  ['r', 'р'],
  ['s', 'с'],
  ['t', 'т'],
  ['u', 'у'],
  ['f', 'ф'],
  ['h', 'һ'],
  ['c', 'к']
];

const EN_TO_RU_LAYOUT: Record<string, string> = {
  'q': 'й', 'w': 'ц', 'e': 'у', 'r': 'к', 't': 'е', 'y': 'н', 'u': 'г', 'i': 'ш', 'o': 'щ', 'p': 'з', '[': 'х', ']': 'ъ',
  'a': 'ф', 's': 'ы', 'd': 'в', 'f': 'а', 'g': 'п', 'h': 'р', 'j': 'о', 'k': 'л', 'l': 'д', ';': 'ж', "'": 'э',
  'z': 'я', 'x': 'ч', 'c': 'с', 'v': 'м', 'b': 'и', 'n': 'т', 'm': 'ь', ',': 'б', '.': 'ю', '/': '.'
};

const ALIAS_GROUPS: string[][] = [
  ["meilisearch", "meili", "мейлисерч", "меилисерч"],
  ["render", "render.com", "рендер"],
  ["vercel", "верцел"],
  ["docker", "докер"],
  ["postgres", "postgresql", "постгрес"],
  ["supabase", "супабейс"],
  ["wireguard", "вайргард"],
  ["wifi", "wi-fi", "вайфай", "вай фай"],
  ["github", "git hub", "гитхаб"],
  ["node", "nodejs", "node.js", "нода"],
  ["react", "reactjs", "реакт"],
  ["python", "питон"],
  ["flask", "фласк"],
  ["django", "джанго"],
  ["redis", "редис"],
  ["elastic", "elasticsearch", "эластик"],
  ["postman", "постман"],
  
  // Cars aliases
  ["toyota", "тойота"],
  ["hyundai", "хендай", "хёндай", "хундай"],
  ["kia", "киа", "кио"],
  ["volkswagen", "vw", "фольксваген", "фольц"],
  ["mercedes", "mercedes-benz", "benz", "мерседес", "мерс"],
  ["bmw", "бмв"],
  ["audi", "ауди"],
  ["lexus", "лексус"],
  ["nissan", "ниссан"],
  ["chevrolet", "шевроле", "шеви"],
  ["mitsubishi", "митсубиси", "митсубиши", "митсу"],
  ["subaru", "субару"],
  ["mazda", "мазда"],
  ["honda", "хонда"],
  ["land rover", "range rover", "ленд ровер", "ренж ровер", "лендровер"],
  ["renault", "рено"],
  ["peugeot", "пежо"],
  ["citroen", "ситроен"],
  ["opel", "опель"],
  ["suzuki", "сузуки"],
  ["skoda", "шкода"],
  ["chery", "чери"],
  ["geely", "джили"],
  ["changan", "чанган"],
  ["byd", "бивайди"],
  ["infiniti", "инфинити"],
  ["cadillac", "кадиллак"],
  ["dodge", "додж"],
  ["porsche", "порше"],
  ["tesla", "тесла"],
  ["lada", "лада", "ваз"],
  
  // Models
  ["camry", "камри"],
  ["solaris", "солярис"],
  ["accent", "акцент"],
  ["rio", "рио"],
  ["optima", "оптима"],
  ["elantra", "элантра"],
  ["sonata", "соната"],
  ["octavia", "октавия"],
  ["rapid", "рапид"],
  ["superb", "суперб"],
  ["astra", "астра"],
  ["vectra", "вектра"],
  ["zafira", "зафира"],
  ["golf", "гольф"],
  ["passat", "пассат"],
  ["polo", "поло"],
  ["tiguan", "тигуан"],
  ["touareg", "туарег"],
  ["cruze", "круз"],
  ["cobalt", "кобальт"],
  ["aveo", "авео"],
  ["spark", "спарк"],
  ["malibu", "малибу"],
  ["captiva", "каптива"],
  ["nexia", "нексия"],
  ["matiz", "матиз"],
  ["gentra", "джентра"],
  ["priora", "приора"],
  ["granta", "гранта"],
  ["vesta", "веста"],
  ["kalina", "калина"],
  ["largus", "ларгус"]
];

export function normalizeText(text: string): string {
  if (!text) return '';
  let normalized = text.toLowerCase();
  normalized = normalized.replace(/ё/g, 'e');
  // Разрешаем буквы английского, русского, казахского алфавитов, цифры, пробелы и дефис
  normalized = normalized.replace(/[^a-zа-яёәғқңөұүһі0-9\s-]/g, ' ');
  normalized = normalized.replace(/\s+/g, ' ');
  return normalized.trim();
}

export function transliterateCyrillicToLatin(text: string): string {
  if (!text) return '';
  return text.split('').map(char => {
    return CYRILLIC_TO_LATIN[char] !== undefined ? CYRILLIC_TO_LATIN[char] : char;
  }).join('');
}

export function transliterateLatinToCyrillic(text: string): string {
  if (!text) return '';
  let result = text;
  for (const [lat, cyr] of LATIN_TO_CYRILLIC_MAP) {
    result = result.split(lat).join(cyr);
  }
  return result;
}

export function fixKeyboardLayout(text: string): string {
  if (!text) return '';
  return text.split('').map(char => {
    const lowerChar = char.toLowerCase();
    return EN_TO_RU_LAYOUT[lowerChar] !== undefined ? EN_TO_RU_LAYOUT[lowerChar] : char;
  }).join('');
}

export function getAliasesForText(text: string): string[] {
  const normalized = normalizeText(text);
  const words = normalized.split(/[\s-]+/);
  const matchedAliases = new Set<string>();
  
  for (const word of words) {
    if (word.length < 2) continue;
    for (const group of ALIAS_GROUPS) {
      if (group.includes(word)) {
        group.forEach(alias => {
          if (alias !== word) {
            matchedAliases.add(alias);
          }
        });
      }
    }
  }
  
  return Array.from(matchedAliases);
}

export function getQueryVariants(query: string): string[] {
  const list: string[] = [];
  const add = (val: string) => {
    const trimmed = val.trim();
    if (trimmed && !list.includes(trimmed)) {
      list.push(trimmed);
    }
  };

  add(query);
  
  const normalized = normalizeText(query);
  add(normalized);
  
  // Кириллица -> Латиница
  const cyrToLat = transliterateCyrillicToLatin(normalized);
  add(cyrToLat);
  
  // Латиница -> Кириллица
  const latToCyr = transliterateLatinToCyrillic(normalized);
  add(latToCyr);
  
  // Исправление раскладки
  const fixedLayout = fixKeyboardLayout(query);
  add(fixedLayout);
  
  const normFixed = normalizeText(fixedLayout);
  add(normFixed);
  add(transliterateCyrillicToLatin(normFixed));
  
  // Синонимы (алиасы) для оригинального текста
  const queryAliases = getAliasesForText(normalized);
  queryAliases.forEach(alias => add(alias));
  
  // Синонимы (алиасы) для исправленной раскладки
  const fixedAliases = getAliasesForText(normFixed);
  fixedAliases.forEach(alias => add(alias));
  
  return list;
}
