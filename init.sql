-- Drop existing tables if they exist (for clean runs)
DROP TABLE IF EXISTS article_tags CASCADE;
DROP TABLE IF EXISTS articles CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS user_audit_logs CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS news_images CASCADE;
DROP TABLE IF EXISTS news_attachments CASCADE;
DROP TABLE IF EXISTS news_views CASCADE;
DROP TABLE IF EXISTS news_read_status CASCADE;
DROP TABLE IF EXISTS news_tags CASCADE;
DROP TABLE IF EXISTS news CASCADE;

-- Create Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'User', -- 'Admin', 'Editor', 'User'
    is_blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create User Sessions Table
CREATE TABLE user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    refresh_token VARCHAR(512) NOT NULL UNIQUE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create User Audit Logs Table
CREATE TABLE user_audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    changed_by INT REFERENCES users(id) ON DELETE SET NULL,
    field_changed VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed Default Admin User (username: Sherzad, password: Xwz247Agd)
INSERT INTO users (username, password_hash, name, role) VALUES
('Sherzad', '$2b$10$GTO8CPoU.eFIPYDlZawNQeL8t1IiRppBLnR0WRHoVbkJbceWnNmS2', 'Администратор Sherzad', 'Администратор Wiki');

-- Create Categories Table
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    icon VARCHAR(50) NOT NULL, -- Lucide icon name
    description TEXT,
    position INT DEFAULT 0
);

-- Create Articles Table
CREATE TABLE articles (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    content TEXT NOT NULL,
    summary TEXT,
    category_id INT REFERENCES categories(id) ON DELETE SET NULL,
    author_id INT REFERENCES users(id) ON DELETE SET NULL,
    published BOOLEAN DEFAULT TRUE,
    views INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create Article Tags Table
CREATE TABLE article_tags (
    article_id INT REFERENCES articles(id) ON DELETE CASCADE,
    tag_name VARCHAR(50) NOT NULL,
    PRIMARY KEY (article_id, tag_name)
);

-- Create News Tables
CREATE TABLE news (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content TEXT NOT NULL,
    is_published BOOLEAN DEFAULT TRUE,
    is_pinned BOOLEAN DEFAULT FALSE,
    author_id INT REFERENCES users(id) ON DELETE SET NULL,
    published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE news_images (
    id SERIAL PRIMARY KEY,
    news_id INT REFERENCES news(id) ON DELETE CASCADE,
    image_url VARCHAR(512) NOT NULL,
    position INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE news_attachments (
    id SERIAL PRIMARY KEY,
    news_id INT REFERENCES news(id) ON DELETE CASCADE,
    file_url VARCHAR(512) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE news_views (
    id SERIAL PRIMARY KEY,
    news_id INT REFERENCES news(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE news_read_status (
    news_id INT REFERENCES news(id) ON DELETE CASCADE,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    PRIMARY KEY (news_id, user_id)
);

CREATE TABLE news_tags (
    news_id INT REFERENCES news(id) ON DELETE CASCADE,
    tag_name VARCHAR(50) NOT NULL,
    PRIMARY KEY (news_id, tag_name)
);

CREATE INDEX idx_news_published_pinned ON news(is_published, is_pinned, published_at DESC);
CREATE INDEX idx_news_images_news_id ON news_images(news_id);
CREATE INDEX idx_news_attachments_news_id ON news_attachments(news_id);
CREATE INDEX idx_news_views_news_id_user_id ON news_views(news_id, user_id);
CREATE INDEX idx_news_read_status_user_id ON news_read_status(user_id);
CREATE INDEX idx_news_tags_news_id ON news_tags(news_id);

-- Seed Yandex Pro Taxi Categories
INSERT INTO categories (name, slug, icon, description, position) VALUES
('Новому водителю', 'new-driver', 'layout', 'Инструкции для старта работы: прохождение фотоконтроля, тренажер приложения и первый заказ.', 1),
('Всё о Яндекс Про', 'app', 'server', 'Как пользоваться приложением Яндекс Про, авторизация через Яндекс ID, режимы ожидания и заправка.', 2),
('Всё о поездках и тарифах', 'rides', 'cpu', 'Информация о поездках с попутчиками, требования тарифов Эконом, Комфорт и Бизнес, а также рейтинг.', 3),
('От чего зависит доход', 'income', 'search', 'Как работает приоритет, комиссии сервиса, повышенный спрос в Алматы и бонусы водителей.', 4);

-- Seed Yandex Pro Taxi Articles
-- Article 1: Не приходят заказы
INSERT INTO articles (title, slug, content, summary, category_id, published, views) VALUES
('Не приходят заказы — что делать?', 'net-zakazov', 
'# Не приходят заказы — что делать?

Если в приложении Яндекс Про долго нет предложений о поездках, проверьте ключевые настройки вашего телефона и статус в системе. Сервис распределяет заказы автоматически, и несколько простых действий помогут вам быстрее выйти на линию.

## Основные причины и способы решения

1. **Режим «Занят» вместо «На линии»**
   * Убедитесь, что круглый индикатор в верхней части экрана горит зеленым цветом («На линии»). Если он желтый («Занят»), заказы поступать не будут.
2. **Проблемы со связью или GPS**
   * Приложение требует стабильного интернет-соединения и точного определения координат. Если вы находитесь в тоннеле, под мостом или на подземной парковке, связь может пропасть.
   * Попробуйте включить и выключить «Авиарежим» на 10 секунд для перезапуска сети.
3. **Непройденный фотоконтроль**
   * Если у вас подошло время фотоконтроля автомобиля, водительского удостоверения или брендирования, и вы не прошли проверку вовремя, доступ к заказам блокируется. Проверьте вкладку «Фотоконтроль» в профиле.

```bash
# Быстрый чек-лист при отсутствии заказов:
1. Проверить баланс Яндекс Про (должен быть выше лимита парка).
2. Выйти на линию (зеленая кнопка).
3. Перезагрузить GPS-навигацию.
```

## Дополнительные рекомендации
* **Зоны повышенного спроса:** На карте в Яндекс Про такие зоны подсвечены фиолетовым цветом. Переместитесь ближе к ним — там заказы распределяются намного чаще и стоят дороже.
* **Баллы приоритета:** Водители с высоким приоритетом получают заказы быстрее. Узнайте, как повысить приоритет в профиле.',
'Пошаговое руководство по решению проблем с получением заказов в приложении Яндекс Про: проверка статуса, сети, GPS и баланса.',
1, TRUE, 184);

-- Article 2: Как работает приоритет
INSERT INTO articles (title, slug, content, summary, category_id, published, views) VALUES
('Как работает приоритет в распределении заказов', 'prioritet',
'# Приоритет в распределении заказов

Приоритет — это числовой показатель водителя в системе Яндекс Про. Водитель с более высоким приоритетом тратит меньше времени на ожидание нового заказа и получает поездки в первую очередь при прочих равных условиях.

## Как распределяются заказы?
Когда пассажир вызывает машину, алгоритм выбирает ближайшие автомобили. Если на одинаковом расстоянии находятся несколько свободных водителей, заказ отправляется тому, у кого **больше баллов приоритета**.

## Как получить баллы приоритета в Алматы?

* **Брендирование кузова автомобиля (+4 балла):** Нанесение фирменных наклеек Яндекс Go на двери и капот.
* **Световой короб (+2 балла):** Установка светящегося короба на крышу машины.
* **Сотрудничество напрямую в качестве самозанятого (+2 балла):** Регистрация в качестве прямого партнера.
* **Рейтинг водителя:** 
  * Рейтинг от 4.8 до 4.9 дает **+1 балл**.
  * Рейтинг от 4.9 до 5.0 дает **+2 балла**.
* **Уровень в программе привилегий:** Золотой уровень дает **+1 балл**, а Платиновый — **+2 балла**.

```
Пример расчета:
Базовый приоритет: 0
+ Брендирование: +4
+ Рейтинг 4.92: +2
+ Самозанятый: +2
Итоговый приоритет водителя: +8 баллов.
```

Высокий приоритет позволяет минимизировать время холостого простоя и увеличивает ваш среднечасовой доход в часы пик.',
'Как баллы приоритета влияют на скорость получения заказов в Яндекс Про, и за что начисляются бонусы приоритета в Алматы.',
4, TRUE, 290);

-- Article 3: Стандарты тарифа Комфорт
INSERT INTO articles (title, slug, content, summary, category_id, published, views) VALUES
('Стандарты и правила тарифа «Комфорт»', 'standarts-komfort',
'# Стандарты работы в тарифе «Комфорт»

Тариф «Комфорт» выбирают пассажиры, которые ценят дополнительное удобство в поездке. Чтобы выполнять заказы в этом тарифе, водителю важно соответствовать высоким стандартам обслуживания Яндекс Такси.

## Подготовка автомобиля
* **Идеальная чистота:** На кузове не должно быть налета грязи (особенно на дверных ручках и стеклах). В салоне должна быть проведена влажная уборка, коврики должны быть чистыми, а на сиденьях не должно быть пыли или шерсти.
* **Свободный багажник:** В багажнике должно быть место хотя бы для одного большого чемодана пассажира. Допускается хранение только зарядного устройства, щетки для снега и незамерзайки.
* **Отсутствие запахов:** В машине категорически запрещено курить (включая электронные сигареты). Не используйте резкие ароматизаторы.

## Поведение водителя во время поездки
1. **Вежливое приветствие:** Поздоровайтесь с пассажиром, когда он садится в машину. Будьте приветливы.
2. **Комфортный климат:** Заранее настройте кондиционер или печку на комфортную температуру (20–22 °C). Если пассажир попросит закрыть окно или изменить температуру, сделайте это.
3. **Безопасный стиль вождения:** Алгоритмы Яндекс Про отслеживают манеру вождения. Избегайте резких ускорений, частых перестроений и резких торможений. Всегда пристегивайтесь сами и напоминайте об этом пассажирам.

> Помните, что соблюдение этих простых правил защищает ваш высокий рейтинг и гарантирует стабильный поток заказов.',
'Требования к чистоте автомобиля, свободному багажнику и стандартам общения с пассажирами для водителей тарифа Комфорт.',
3, TRUE, 125);

-- Article 4: Как пользоваться Яндекс Про
INSERT INTO articles (title, slug, content, summary, category_id, published, views) VALUES
('Инструкция: как пользоваться приложением Яндекс Про', 'yandexpro-how-to',
'# Работа с приложением Яндекс Про

Яндекс Про (ранее Таксометр) — ваш главный рабочий инструмент. С его помощью вы выходите на линию, получаете заказы, общаетесь с поддержкой и контролируете свой баланс.

## Режимы активности в приложении

* **На линии (зеленый круг):** Вы готовы принимать заказы поблизости.
* **Занят (желтый круг):** Используйте этот режим, если хотите сделать перерыв, заправиться или пообедать. Заказы приходить не будут.
* **«По делам» и «Домой»:** Специальные режимы, в которых система подбирает только те заказы, конечная точка которых находится по пути вашего направления. Доступны ограниченное число раз в сутки.

## Этапы выполнения заказа

1. **Принятие заказа:** При поступлении звукового сигнала у вас есть около 10 секунд, чтобы нажать кнопку «Принять».
2. **Подача машины:** Подъехав к точке подачи, остановитесь в безопасном месте и нажмите кнопку **«На месте»**. 
3. **Ожидание пассажира:** Система уведомит пользователя о подаче. Первые 2-3 минуты ожидания бесплатны. Если пассажир задерживается, включится платное ожидание.
4. **Начало поездки:** Когда пассажир сядет в салон, поприветствуйте его и сдвиньте слайдер **«Поехали»**.
5. **Завершение:** Приехав в точку назначения, остановитесь и нажмите **«Завершить»**. Экран покажет стоимость и тип оплаты (наличные или карта).

```
Важно: Никогда не нажимайте кнопку «На месте» до того, как фактически подъехали к пассажиру. Это ведет к жалобам и снижению рейтинга.
```',
'Пошаговое описание работы с заказами в Яндекс Про: от выхода на линию и принятия поездки до расчета с пассажиром.',
2, TRUE, 210);

-- Seed Article Tags
INSERT INTO article_tags (article_id, tag_name) VALUES
(1, 'Заказы'),
(1, 'Техподдержка'),
(1, 'GPS'),
(2, 'Приоритет'),
(2, 'Брендирование'),
(2, 'Рейтинг'),
(3, 'Стандарты'),
(3, 'Комфорт'),
(3, 'Безопасность'),
(4, 'Яндекс Про'),
(4, 'Инструкция'),
(4, 'Поездки');

-- Auto-generated vehicle classifier seed data

INSERT INTO categories (name, slug, icon, description, position) VALUES
('Классификатор автомобилей', 'tariffs', 'cpu', 'Классификатор моделей по тарифам Яндекс Такси в Алматы.', 5)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO articles (title, slug, content, summary, category_id, published, views) VALUES
(
  'Какой автомобиль подойдёт для выполнения заказов',
  'auto-list',
  $str$# Какой автомобиль подойдёт для выполнения заказов

**У сервиса Яндекс Такси есть общие требования к авт��мобилям, которые могут выполнять заказы в разных тарифах — так формируется классификатор.**

Классификатор — это список автомобилей, на которых можно выполнять заказы в разных тарифах. Он регулярно обновляется.

В разных городах и тарифах требования могут отличаться, в том числе, на уровне законодательства.

Чтобы определить, подходит ли машина для тарифа, мы учитываем:

* **Модель: **подходят только машины, у которых 4 двери и больше. Только леворульные машины.

* **Возраст: **считаем от года выпуска (производства по ПТС).

* **Комплектацию.**

Окончательное решение по каждому автомобилю остается за сервисом Яндекс Такси.

Уточнить, какие машины могут работать в каждом тарифе, вы можете в своём таксопарке.

## Доступные тарифы в Алматы

Выберите интересующий вас тариф, чтобы посмотреть список разрешенных автомобилей:

* [Тариф «Эконом»](/articles/auto-list-эконом)
* [Тариф «Межгород»](/articles/auto-list-межгород)
* [Тариф «Комфорт»](/articles/auto-list-комфорт)
* [Тариф «Комфорт+»](/articles/auto-list-комфорт-plus)
* [Тариф «Электро»](/articles/auto-list-электро)
* [Тариф «Бизнес»](/articles/auto-list-бизнес)
* [Тариф «Ultima: тариф Premier»](/articles/auto-list-ultima-тариф-premier)
$str$,
  'Общие требования к автомобилям и классификатор тарифов Яндекс Такси в Алматы.',
  (SELECT id FROM categories WHERE slug = 'tariffs'),
  TRUE,
  350
);

INSERT INTO articles (title, slug, content, summary, category_id, published, views) VALUES
(
  'Тариф «Эконом»',
  'auto-list-эконом',
  $str$# Тариф «Эконом»

[← Назад к общему списку](/articles/auto-list)

| Марка и модель | Требования |
| --- | --- |
| Audi 100 | от 1985 |
| Audi 80 | от 1985 |
| Audi A4 | от 1990 |
| Audi A6 | от 1990 |
| Audi A8 | от 1991 |
| Audi S4 | от 1990 |
| BMW 3er | от 1991 |
| BMW 5er | от 1986 |
| BMW 7er | от 1992 |
| BMW M5 | от 1990 |
| BYD F3 | от 2007 |
| Changan Eado | от 2013 |
| Chevrolet Aveo | от 2003 |
| Chevrolet Captiva | от 2006 |
| Chevrolet Cobalt | от 2004 |
| Chevrolet Cruze | от 2009 |
| Chevrolet Epica | от 2005 |
| Chevrolet Lacetti | от 2004 |
| Chevrolet Lanos | от 2003 |
| Chevrolet Malibu | от 2010 |
| Chevrolet Orlando | от 2011 |
| Chevrolet Spark | от 2005 |
| Chevrolet Tracker | от 2001 |
| Daewoo Gentra | от 2007 |
| Daewoo Lacetti | от 2002 |
| Daewoo Leganza | от 1997 |
| Daewoo Magnus | от 1998 |
| Daewoo Matiz | от 1998 |
| Daewoo Nexia | от 2002 |
| Daewoo Nubira | от 1997 |
| Daihatsu Terios | от 1998 |
| Datsun on-DO | от 2014 |
| FAW Besturn B50 | от 2007 |
| FAW Oley | от 2013 |
| FAW V5 | от 2012 |
| Ford Fiesta | от 1997 |
| Ford Focus | от 1996 |
| Ford Fusion | от 2000 |
| Ford Mondeo | от 1993 |
| Geely CK (Otaka) | от 2006 |
| Geely Emgrand 7 | от 2010 |
| Geely Emgrand X7 | от 2012 |
| Geely GC6 | от 2013 |
| Geely MK Cross | от 2011 |
| Geely SC7 | от 2008 |
| Honda Accord | от 1990 |
| Honda Capa | от 1998 |
| Honda Civic | от 1985 |
| Honda CR-V | от 1988 |
| Honda Elysion | от 2004 |
| Honda Fit | от 2001 |
| Honda HR-V | от 1996 |
| Honda Insight | от 2006 |
| Honda Inspire | от 1995 |
| Honda Jazz | от 2001 |
| Honda Odyssey | от 1994 |
| Honda Orthia | от 1996 |
| Honda Shuttle | от 1995 |
| Honda S-MX | от 1997 |
| Honda Stepwgn | от 1996 |
| Honda Stream | от 2000 |
| Hyundai Accent | от 1995 |
| Hyundai Avante | от 1995 |
| Hyundai Click | от 2002 |
| Hyundai Creta | от 2016 |
| Hyundai Elantra | от 1993 |
| Hyundai Getz | от 2002 |
| Hyundai Grandeur | от 1998 |
| Hyundai i30 | от 2006 |
| Hyundai Matrix | от 2001 |
| Hyundai Santa Fe | от 2000 |
| Hyundai Solaris | от 2005 |
| Hyundai Sonata | от 1994 |
| Hyundai Trajet | от 2000 |
| Hyundai Tucson | от 2004 |
| Hyundai Verna | от 1999 |
| Infiniti I | от 1997 |
| Iran Khodro Samand | от 2004 |
| JAC S3 | от 2015 |
| Kia Carens | от 1998 |
| Kia Cee'd | от 2005 |
| Kia Cerato | от 2003 |
| Kia Forte | от 2008 |
| Kia K5 | от 2010 |
| Kia Lotze | от 2000 |
| Kia Magentis | от 2000 |
| Kia Morning | от 2004 |
| Kia Optima | от 1999 |
| Kia Picanto | от 2004 |
| Kia Rio | от 2000 |
| Kia Shuma | от 1998 |
| Kia Sorento | от 2002 |
| Kia Soul | от 2008 |
| Kia Spectra | от 2000 |
| Kia Sportage | от 1995 |
| LADA (ВАЗ) 2109 | от 1986 |
| LADA (ВАЗ) 21099 | от 1986 |
| LADA (ВАЗ) 2110 | от 1986 |
| LADA (ВАЗ) 2112 | от 1986 |
| LADA (ВАЗ) 2114 | от 1996 |
| LADA (ВАЗ) 2115 | от 1996 |
| LADA (ВАЗ) Granta | от 2010 |
| LADA (ВАЗ) Kalina | от 2005 |
| LADA (ВАЗ) Largus | от 2012 |
| LADA (ВАЗ) Priora | от 2007 |
| LADA (ВАЗ) Vesta | от 2015 |
| LADA (ВАЗ) XRAY | от 2015 |
| Lexus ES | от 1995 |
| Lexus GS | от 1994 |
| Lexus IS | от 1999 |
| Lexus RX | от 1998 |
| Lifan Solano | от 2009 |
| Lifan X50 | от 2015 |
| Lifan X60 | от 2012 |
| Mazda 3 | от 1993 |
| Mazda 323 | от 1987 |
| Mazda 6 | от 1992 |
| Mazda 626 | от 1985 |
| Mazda Capella | от 1995 |
| Mazda Cronos | от 1992 |
| Mazda Demio | от 1997 |
| Mazda Familia | от 1986 |
| Mazda MPV | от 1987 |
| Mazda Premacy | от 1999 |
| Mazda Tribute | от 2000 |
| Mercedes-Benz 190 (W201) | от 1984 |
| Mercedes-Benz A-klasse | от 1986 |
| Mercedes-Benz C-klasse | от 1986 |
| Mercedes-Benz E-klasse | от 1985 |
| Mercedes-Benz M-klasse | от 1997 |
| Mercedes-Benz S-klasse | от 1990 |
| Mercedes-Benz W124 | от 1985 |
| MG 350 | от 2011 |
| MG 5 | от 2011 |
| Mitsubishi ASX | от 2007 |
| Mitsubishi Carisma | от 1995 |
| Mitsubishi Chariot | от 1992 |
| Mitsubishi Diamante | от 1992 |
| Mitsubishi Galant | от 1987 |
| Mitsubishi Grandis | от 1998 |
| Mitsubishi Lancer | от 1987 |
| Mitsubishi Legnum | от 1989 |
| Mitsubishi Montero | от 1997 |
| Mitsubishi Montero Sport | от 1997 |
| Mitsubishi Outlander | от 2002 |
| Mitsubishi Pajero | от 1989 |
| Mitsubishi RVR | от 1993 |
| Mitsubishi Space Runner | от 1992 |
| Mitsubishi Space Star | от 1998 |
| Mitsubishi Space Wagon | от 1991 |
| Nissan Almera | от 1993 |
| Nissan Almera Classic | от 2005 |
| Nissan Almera Tino | от 2000 |
| Nissan Altima | от 1998 |
| Nissan Bluebird | от 1988 |
| Nissan Bluebird Sylphy | от 2000 |
| Nissan Cefiro | не допускается |
| Nissan Juke | от 2010 |
| Nissan Maxima | от 1992 |
| Nissan Micra | от 1993 |
| Nissan Murano | от 2003 |
| Nissan Note | от 2005 |
| Nissan Prairie | от 1990 |
| Nissan Primera | от 1986 |
| Nissan Qashqai | от 2007 |
| Nissan R'nessa | не допускается |
| Nissan Rogue | от 2007 |
| Nissan Sentra | от 1997 |
| Nissan Skyline | от 1985 |
| Nissan Sunny | от 1985 |
| Nissan Teana | от 2003 |
| Nissan Terrano | от 1993 |
| Nissan Tiida | от 2004 |
| Nissan Tino | от 1998 |
| Nissan Versa | от 2006 |
| Nissan X-Trail | от 2000 |
| Opel Astra | от 1988 |
| Opel Meriva | от 2003 |
| Opel Omega | от 1987 |
| Opel Vectra | от 1988 |
| Opel Vita | от 1995 |
| Opel Zafira | от 1999 |
| Peugeot 206 | от 1999 |
| Peugeot 301 | от 2013 |
| Peugeot 307 | от 2001 |
| Peugeot 308 | от 2007 |
| Peugeot 405 | от 1989 |
| Peugeot 408 | от 2012 |
| Pontiac Vibe | от 2002 |
| Ravon Gentra | от 2015 |
| Ravon Nexia R3 | от 2015 |
| Ravon R2 | от 2016 |
| Ravon R4 | от 2016 |
| Renault Arkana | от 2019 |
| Renault Clio | от 1993 |
| Renault Duster | от 2010 |
| Renault Kaptur | от 2016 |
| Renault Laguna | от 1994 |
| Renault Logan | от 2005 |
| Renault Logan Stepway | от 2010 |
| Renault Megane | от 1996 |
| Renault Samsung SM3 | от 2010 |
| Renault Samsung SM5 | от 1998 |
| Renault Sandero | от 2009 |
| Renault Symbol | от 2002 |
| Skoda Fabia | от 2000 |
| Skoda Octavia | от 1997 |
| Skoda Rapid | от 2010 |
| Skoda Superb | от 2002 |
| Skoda Yeti | от 2010 |
| SsangYong Actyon | от 2007 |
| SsangYong Kyron | от 2006 |
| Subaru Forester | от 1997 |
| Subaru Impreza | от 1993 |
| Subaru Legacy | от 1991 |
| Subaru Outback | от 1997 |
| Subaru Tribeca | от 2005 |
| Subaru XV | от 2011 |
| Suzuki Grand Vitara | от 1998 |
| Suzuki Liana | от 2001 |
| Suzuki SX4 | от 2006 |
| Suzuki Vitara | от 1993 |
| Suzuki XL7 | от 2001 |
| Toyota 4Runner | от 1996 |
| Toyota Allex | от 2001 |
| Toyota Alphard | не допускается |
| Toyota Altezza | от 1998 |
| Toyota Aristo | не допускается |
| Toyota Aurion | от 2007 |
| Toyota Auris | от 2006 |
| Toyota Avalon | от 1995 |
| Toyota Avensis | от 1997 |
| Toyota Avensis Verso | от 2001 |
| Toyota Aygo | от 2002 |
| Toyota Caldina | не допускается |
| Toyota Camry | от 1985 |
| Toyota Carina | от 1984 |
| Toyota Carina E | от 1992 |
| Toyota Carina ED | не допускается |
| Toyota Chaser | не допускается |
| Toyota Corolla | от 1985 |
| Toyota Corolla Spacio | не допускается |
| Toyota Corolla Verso | от 2002 |
| Toyota Corona | от 1984 |
| Toyota Corona EXiV | не допускается |
| Toyota Cresta | не допускается |
| Toyota Crown | от 1986 |
| Toyota Estima | от 1993 |
| Toyota Fortuner | от 2005 |
| Toyota Gaia | от 1998 |
| Toyota Harrier | от 1998 |
| Toyota Highlander | от 2001 |
| Toyota Hilux | от 1998 |
| Toyota Hilux Surf | от 1991 |
| Toyota Ipsum | не допускается |
| Toyota ISis | от 2004 |
| Toyota Ist | от 2001 |
| Toyota Land Cruiser | от 1995 |
| Toyota Land Cruiser Prado | от 1996 |
| Toyota Mark II | от 1985 |
| Toyota Matrix | от 2002 |
| Toyota Nadia | от 1998 |
| Toyota Picnic | от 1989 |
| Toyota Previa | от 1991 |
| Toyota Prius | от 1997 |
| Toyota Raum | не допускается |
| Toyota RAV 4 | от 1995 |
| Toyota Scepter | от 1994 |
| Toyota Sienna | от 2000 |
| Toyota Sprinter Carib | не допускается |
| Toyota Sprinter Marino | от 1992 |
| Toyota Tercel | от 1985 |
| Toyota Vista | от 1985 |
| Toyota Vitz | от 1998 |
| Toyota Windom | не допускается |
| Toyota Wish | от 2002 |
| Toyota Yaris | от 1999 |
| Volkswagen Golf | от 1986 |
| Volkswagen Jetta | от 1985 |
| Volkswagen Passat | от 1986 |
| Volkswagen Polo | от 1992 |
| Volkswagen Touareg | от 2002 |
| Volkswagen Touran | от 2003 |
| Volkswagen Vento | от 1985 |
| Volvo 850 | от 1991 |
| ЗАЗ Chance | от 2007 |
| ЗАЗ Vida | от 2012 |

$str$,
  'Список автомобилей и годов выпуска, подходящих для работы по тарифу Тариф «Эконом» в Алматы.',
  (SELECT id FROM categories WHERE slug = 'tariffs'),
  TRUE,
  150
);

INSERT INTO articles (title, slug, content, summary, category_id, published, views) VALUES
(
  'Тариф «Межгород»',
  'auto-list-межгород',
  $str$# Тариф «Межгород»

[← Назад к общему списку](/articles/auto-list)

Допускаются автомобили только с левым расположением руля. Праворульные автомобили не допускаются.

| Марка и модель | Требования |
| --- | --- |
| Acura MDX | от 2000 |
| Acura RDX | от 2007 |
| Acura TLX | от 2014 |
| Acura TSX | от 2004 |
| Alfa Romeo 156 | от 1998 |
| Audi 100 | от 1985 |
| Audi 200 | от 1991 |
| Audi 80 | от 1985 |
| Audi 90 | от 1988 |
| Audi A1 | от 2012 |
| Audi A2 | от 2000 |
| Audi A3 | от 1996 |
| Audi A4 | от 1994 |
| Audi A4 allroad | от 2009 |
| Audi A5 | от 2009 |
| Audi A6 | от 1994 |
| Audi A6 allroad | от 2000 |
| Audi A7 | от 2010 |
| Audi A8 | от 1994 |
| Audi Q3 | от 2011 |
| Audi Q5 | от 2009 |
| Audi Q7 | от 2006 |
| Audi S3 | от 2001 |
| Audi S4 | от 1991 |
| Audi S8 | от 2001 |
| BAIC A113 | не допускается |
| BAIC A115 | не допускается |
| Bajaj Qute | не допускается |
| Belgee X50 | от 2023 |
| BMW 1er | от 2004 |
| BMW 1M | не допускается |
| BMW 3200 | не допускается |
| BMW 3er | от 1991 |
| BMW 4er | от 2013 |
| BMW 502 | не допускается |
| BMW 5er | от 1986 |
| BMW 7er | от 1992 |
| BMW i3 | от 2017 |
| BMW M3 | от 1991 |
| BMW M5 | от 1990 |
| BMW M6 | от 1992 |
| BMW X1 | от 2009 |
| BMW X3 | от 2003 |
| BMW X4 | от 2017 |
| BMW X5 | от 2000 |
| BMW X5 M | от 2009 |
| BMW X6 | от 2008 |
| Brilliance H530 | от 2011 |
| Brilliance M2 (BS4) | от 2007 |
| Brilliance V5 | от 2013 |
| BYD E2 | от 2019 |
| BYD F3 | от 2007 |
| Cadillac CTS | от 2002 |
| Cadillac Eldorado | не допускается |
| Cadillac SRX | от 2004 |
| Changan Alsvin V7 | от 2014 |
| Changan CS35 | от 2013 |
| Changan CS75 | от 2014 |
| Changan Eado | от 2013 |
| Changan UNI-K | от 2020 |
| Chery Amulet (A15) | от 2004 |
| Chery Arrizo 7 | от 2014 |
| Chery Bonus (A13) | от 2011 |
| Chery Bonus 3 (E3/A19) | от 2014 |
| Chery CrossEastar (B14) | от 2007 |
| Chery Fora (A21) | от 2006 |
| Chery IndiS (S18D) | от 2011 |
| Chery Kimo (A1) | от 2007 |
| Chery M11 (A3) | от 2010 |
| Chery QQ6 (S21) | от 2007 |
| Chery Tiggo (T11) | от 2005 |
| Chery Tiggo 2 | от 2016 |
| Chery Tiggo 3 | от 2014 |
| Chery Tiggo 5 | от 2014 |
| Chery Tiggo 7 | от 2019 |
| Chery Tiggo 8 Pro | от 2021 |
| Chery Tiggo 8 Pro Max | от 2022 |
| Chery Very (A13) | от 2011 |
| Chevrolet Aveo | от 2003 |
| Chevrolet Blazer | от 1995 |
| Chevrolet C/K | от 2000 |
| Chevrolet Captiva | от 2006 |
| Chevrolet Cobalt | от 2004 |
| Chevrolet Colorado | от 2019 |
| Chevrolet Cruze | от 2009 |
| Chevrolet Cruze (HR) | от 2002 |
| Chevrolet Epica | от 2005 |
| Chevrolet Evanda | от 2004 |
| Chevrolet Kalos | от 2004 |
| Chevrolet Lacetti | от 2004 |
| Chevrolet Lanos | от 2003 |
| Chevrolet Malibu | от 2010 |
| Chevrolet MATIZ | от 2004 |
| Chevrolet Menlo | от 2020 |
| Chevrolet MW | от 2008 |
| Chevrolet Niva | от 2003 |
| Chevrolet Nubira | от 2004 |
| Chevrolet Spark | от 2005 |
| Chevrolet Tahoe | от 2005 |
| Chevrolet Tracker | от 2001 |
| Chevrolet Traverse | от 2008 |
| Chevrolet Viva | от 2004 |
| Chevrolet Volt | от 2011 |
| Chrysler 300C | от 2004 |
| Chrysler 300M | от 2000 |
| Chrysler Neon | от 2000 |
| Chrysler PT Cruiser | от 2000 |
| Chrysler Sebring | от 2001 |
| Citroen C-Crosser | от 2008 |
| Citroen C-Elysee | от 2012 |
| Citroen C1 | от 2006 |
| Citroen C3 | от 2002 |
| Citroen C4 | от 2004 |
| Citroen C4 Aircross | от 2012 |
| Citroen C5 | от 2000 |
| Citroen DS4 | от 2012 |
| Citroen DS5 | от 2012 |
| Citroen Xantia | от 1999 |
| Citroen Xsara | от 1998 |
| Dacia Duster | от 2010 |
| Dacia Logan | от 2004 |
| Dacia Sandero | от 2007 |
| Daewoo Espero | от 1995 |
| Daewoo Gentra | от 2007 |
| Daewoo Kalos | от 2002 |
| Daewoo Lacetti | от 2002 |
| Daewoo Lanos | от 1997 |
| Daewoo Leganza | от 1997 |
| Daewoo Magnus | от 2000 |
| Daewoo Matiz | от 1998 |
| Daewoo Nexia | от 2002 |
| Daewoo Nubira | от 1997 |
| Daewoo Sens | от 2002 |
| Daewoo Tico | от 1993 |
| Daewoo Winstorm | от 2006 |
| Daihatsu Boon | не допускается |
| Daihatsu Cuore | от 1994 |
| Daihatsu Materia | от 2006 |
| Daihatsu Mira | от 2004 |
| Daihatsu Mira e:S | не допускается |
| Daihatsu Sirion | от 1999 |
| Daihatsu Tanto | не допускается |
| Daihatsu Terios | от 1998 |
| Datsun mi-DO | от 2015 |
| Datsun on-DO | от 2014 |
| Dodge Caliber | от 2006 |
| Dodge Charger | от 2005 |
| Dodge Journey | от 2008 |
| Dodge Neon | от 2003 |
| Dodge Stratus | от 2001 |
| DongFeng AX7 | от 2017 |
| DongFeng H30 Cross | от 2013 |
| DongFeng S30 | от 2013 |
| FAW Besturn B50 | от 2009 |
| FAW Oley | от 2013 |
| FAW V2 | от 2013 |
| FAW V5 | от 2012 |
| FAW Vita | от 2007 |
| FAW X80 | от 2014 |
| Fiat Albea | от 2004 |
| Fiat Bravo | от 1997 |
| Fiat Croma | от 2005 |
| Fiat Linea | от 2007 |
| Fiat Marea | от 1998 |
| Fiat Palio | от 2000 |
| Fiat Panda | от 2004 |
| Fiat Punto | от 1999 |
| Fiat Stilo | от 2001 |
| Fiat Tipo | от 1990 |
| Ford EcoSport | от 2014 |
| Ford Escape | от 2001 |
| Ford Escort | от 1990 |
| Ford Explorer | от 1999 |
| Ford Festiva | от 1998 |
| Ford Fiesta | от 1997 |
| Ford Focus | от 1998 |
| Ford Focus (North America) | от 2000 |
| Ford Focus RS | от 2002 |
| Ford Fusion | от 2002 |
| Ford Kuga | от 2008 |
| Ford Maverick | от 2001 |
| Ford Mondeo | от 1993 |
| Ford Mondeo ST | от 2007 |
| Ford Ranger | от 2006 |
| Ford Scorpio | от 1986 |
| Ford Sierra | от 1985 |
| Geely Atlas | от 2018 |
| Geely Atlas Pro | от 2021 |
| Geely Azkarra | от 2019 |
| Geely CK (Otaka) | от 2006 |
| Geely Coolray | от 2019 |
| Geely Emgrand 7 | от 2016 |
| Geely Emgrand EC7 | от 2010 |
| Geely Emgrand EC8 | от 2014 |
| Geely Emgrand GT | от 2016 |
| Geely Emgrand X7 | от 2012 |
| Geely FC (Vision) | от 2006 |
| Geely GC6 | от 2014 |
| Geely LC (Panda) | от 2011 |
| Geely LC (Panda) Cross | от 2014 |
| Geely MK | от 2007 |
| Geely MK Cross | от 2011 |
| Geely MR | от 2006 |
| Geely SC7 | от 2011 |
| Geely TX4 | от 2009 |
| Genesis G80 | от 2016 |
| Great Wall Coolbear | от 2009 |
| Great Wall Florid | от 2013 |
| Great Wall Hover | от 2006 |
| Great Wall Hover H3 | от 2010 |
| Great Wall Hover H5 | от 2011 |
| Great Wall Hover H6 | от 2011 |
| Great Wall Hover M2 | от 2013 |
| Great Wall Hover M4 | от 2013 |
| Great Wall Safe | от 2004 |
| Great Wall Voleex C30 | от 2010 |
| Great Wall Wingle | от 2008 |
| Hafei Brio | от 2006 |
| Haima 3 | от 2010 |
| Haima 7 | от 2013 |
| Haima M3 | от 2014 |
| Haval F7 | от 2019 |
| Haval H2 | от 2014 |
| Haval H6 | от 2014 |
| Haval H8 | от 2019 |
| Hawtai Boliger | от 2015 |
| Honda Accord | от 1990 |
| Honda Airwave | не допускается |
| Honda Avancier | от 1999 |
| Honda City | от 2000 |
| Honda Civic | от 1985 |
| Honda Civic Ferio | не допускается |
| Honda CR-V | от 1995 |
| Honda Crosstour | от 2012 |
| Honda Domani | не допускается |
| Honda e:NP1 | от 2022 |
| Honda Fit | от 2001 |
| Honda Fit Aria | не допускается |
| Honda Fit Shuttle | не допускается |
| Honda Grace | не допускается |
| Honda HR-V | от 1998 |
| Honda Insight | от 2006 |
| Honda Inspire | от 1995 |
| Honda Integra | от 1987 |
| Honda Integra SJ | от 1997 |
| Honda Jazz | от 2001 |
| Honda Legend | от 1995 |
| Honda Life | от 2003 |
| Honda Logo | от 1998 |
| Honda N-BOX | не допускается |
| Honda N-WGN | не допускается |
| Honda Orthia | не допускается |
| Honda Partner | от 1996 |
| Honda Pilot | от 2002 |
| Honda Saber | от 1995 |
| Honda Shuttle | от 1995 |
| Honda Torneo | не допускается |
| Honda Vezel | от 2014 |
| Hummer H2 | от 2005 |
| Hyundai Accent | от 1995 |
| Hyundai Atos | от 1997 |
| Hyundai Avante | от 1995 |
| Hyundai Click | от 2002 |
| Hyundai Creta | от 2016 |
| Hyundai Elantra | от 1993 |
| Hyundai EON | от 2011 |
| Hyundai Equus | от 2007 |
| Hyundai Genesis | от 2008 |
| Hyundai Getz | от 2002 |
| Hyundai Grandeur | от 1998 |
| Hyundai i10 | от 2007 |
| Hyundai i20 | от 2008 |
| Hyundai i30 | от 2007 |
| Hyundai i40 | от 2011 |
| Hyundai IONIQ | от 2017 |
| Hyundai ix35 | от 2010 |
| Hyundai ix55 | от 2009 |
| Hyundai Palisade | от 2018 |
| Hyundai Pony | от 1993 |
| Hyundai Santa Fe | от 2000 |
| Hyundai Solaris | от 2010 |
| Hyundai Sonata | от 1994 |
| Hyundai Terracan | от 2001 |
| Hyundai Tucson | от 2004 |
| Hyundai Veloster | не допускается |
| Hyundai Verna | от 1999 |
| Hyundai XG | от 1999 |
| Infiniti EX | от 2007 |
| Infiniti FX | от 2003 |
| Infiniti G | от 1999 |
| Infiniti I | от 1997 |
| Infiniti M | от 2005 |
| Infiniti Q30 | от 2015 |
| Infiniti Q50 | от 2013 |
| Infiniti Q70 | от 2014 |
| Infiniti QX30 | от 2015 |
| Infiniti QX50 | от 2013 |
| Infiniti QX60 | от 2018 |
| Infiniti QX70 | от 2017 |
| Infiniti QX80 | от 2017 |
| Iran Khodro Samand | от 2004 |
| Iran Khodro Soren | от 2008 |
| JAC J5 (Heyue) | от 2014 |
| JAC S3 | от 2015 |
| JAC S5 (Eagle) | от 2014 |
| Jaguar F-Pace | от 2017 |
| Jaguar S-Type | от 2000 |
| Jaguar X-Type | от 2001 |
| Jaguar XE | от 2016 |
| Jaguar XF | от 2008 |
| Jaguar XJ | от 2011 |
| Jeep Cherokee | от 2000 |
| Jeep Compass | от 2006 |
| Jeep Grand Cherokee | от 1995 |
| Jeep Liberty (Patriot) | от 2006 |
| Jetour X90 PLUS | от 2021 |
| Kia Cadenza | от 2010 |
| Kia Cee'd | от 2006 |
| Kia Cee'd GT | от 2012 |
| Kia Cee'd SW | от 2006 |
| Kia Cerato | от 2003 |
| Kia Clarus | от 1996 |
| Kia Forte | от 2008 |
| Kia K5 | от 2010 |
| Kia K7 | от 2009 |
| Kia Lotze | от 2005 |
| Kia Magentis | от 2000 |
| Kia Mohave (Borrego) | от 2010 |
| Kia Morning | от 2004 |
| Kia Niro | от 2016 |
| Kia Opirus | от 2005 |
| Kia Optima | от 2000 |
| Kia Picanto | от 2004 |
| Kia Pride | от 1995 |
| Kia ProCeed | от 2018 |
| Kia Quoris | от 2013 |
| Kia Ray | от 2016 |
| Kia Rio | от 2000 |
| Kia Seltos | от 2020 |
| Kia Sephia | от 1993 |
| Kia Shuma | от 1998 |
| Kia Sorento | от 2002 |
| Kia Soul | от 2008 |
| Kia Spectra | от 2000 |
| Kia Sportage | от 1995 |
| Kia Stinger | от 2018 |
| LADA (кроме указанных моделей) | не допускается |
| LADA (ВАЗ) 2109 | от 1987 |
| LADA (ВАЗ) 21099 | от 1990 |
| LADA (ВАЗ) 2110 | от 1995 |
| LADA (ВАЗ) 2111 | от 1997 |
| LADA (ВАЗ) 2112 | от 1998 |
| LADA (ВАЗ) 2114 | от 2001 |
| LADA (ВАЗ) 2115 | от 1997 |
| LADA (ВАЗ) EL Lada | от 2012 |
| LADA (ВАЗ) Granta | от 2011 |
| LADA (ВАЗ) Kalina | от 2005 |
| LADA (ВАЗ) Largus | от 2012 |
| LADA (ВАЗ) Priora | от 2007 |
| LADA (ВАЗ) Vesta | от 2015 |
| LADA (ВАЗ) XRAY | от 2015 |
| Lancia Lybra | от 1999 |
| Land Rover Discovery | от 2000 |
| Land Rover Discovery Sport | от 2015 |
| Land Rover Freelander | от 1998 |
| Land Rover Range Rover | от 2002 |
| Land Rover Range Rover Evoque | от 2012 |
| Land Rover Range Rover Sport | от 2006 |
| Land Rover Range Rover Velar | от 2017 |
| Lexus CT | от 2010 |
| Lexus ES | от 1995 |
| Lexus GS | от 1994 |
| Lexus GX | от 2002 |
| Lexus HS | от 2009 |
| Lexus IS | от 1999 |
| Lexus LS | от 2001 |
| Lexus LX | от 1998 |
| Lexus NX | от 2014 |
| Lexus RX | от 1998 |
| Lifan 620 | от 2010 |
| Lifan Breez (520) | от 2007 |
| Lifan Cebrium (720) | от 2014 |
| Lifan Celliya (530) | от 2014 |
| Lifan Murman | от 2017 |
| Lifan Myway | от 2017 |
| Lifan Smily | от 2008 |
| Lifan Solano | от 2009 |
| Lifan X50 | от 2015 |
| Lifan X60 | от 2012 |
| Lifan X70 | от 2018 |
| Lincoln Town Car | от 1998 |
| LTI TX | от 2011 |
| Maybach 62 | от 2018 |
| Mazda 2 | от 2003 |
| Mazda 3 | от 2003 |
| Mazda 3 MPS | от 2006 |
| Mazda 323 | от 1987 |
| Mazda 6 | от 2002 |
| Mazda 6 MPS | от 2005 |
| Mazda 626 | от 1985 |
| Mazda 929 | от 1993 |
| Mazda Atenza | не допускается |
| Mazda Axela | не допускается |
| Mazda BT-50 | от 2007 |
| Mazda Capella | не допускается |
| Mazda Cronos | не допускается |
| Mazda CX-5 | от 2011 |
| Mazda CX-7 | от 2006 |
| Mazda CX-9 | от 2007 |
| Mazda Demio | от 1997 |
| Mazda Familia | от 1986 |
| Mazda Millenia | от 1995 |
| Mazda MX-3 | не допускается |
| Mazda Protege | от 1995 |
| Mazda Tribute | от 2000 |
| Mazda Verisa | не допускается |
| Mazda Xedos 6 | от 1992 |
| Mazda Xedos 9 | от 1994 |
| Mercedes-Benz 190 (W201) | от 1984 |
| Mercedes-Benz 190 SL | не допускается |
| Mercedes-Benz A-klasse | от 1997 |
| Mercedes-Benz AMG GT | не допускается |
| Mercedes-Benz B-klasse | от 2005 |
| Mercedes-Benz C-klasse | от 1993 |
| Mercedes-Benz C-klasse AMG | от 1994 |
| Mercedes-Benz CL-klasse | не допускается |
| Mercedes-Benz CL-klasse AMG | не допускается |
| Mercedes-Benz CLA-klasse | от 2013 |
| Mercedes-Benz CLA-klasse AMG | от 2014 |
| Mercedes-Benz CLK-klasse | не допускается |
| Mercedes-Benz CLS-klasse | от 2005 |
| Mercedes-Benz CLS-klasse AMG | от 2005 |
| Mercedes-Benz E-klasse | от 1992 |
| Mercedes-Benz E-klasse AMG | от 1994 |
| Mercedes-Benz G-klasse | от 1995 |
| Mercedes-Benz G-klasse AMG | от 2000 |
| Mercedes-Benz GL-klasse | от 2006 |
| Mercedes-Benz GLA-klasse | от 2014 |
| Mercedes-Benz GLB-klasse | от 2019 |
| Mercedes-Benz GLC | от 2016 |
| Mercedes-Benz GLC Coupe | от 2017 |
| Mercedes-Benz GLE | от 2019 |
| Mercedes-Benz GLK-klasse | от 2008 |
| Mercedes-Benz GLS-klasse | от 2019 |
| Mercedes-Benz M-klasse | от 1997 |
| Mercedes-Benz M-klasse AMG | от 2002 |
| Mercedes-Benz Maybach S-klasse | от 2015 |
| Mercedes-Benz S-klasse | от 1990 |
| Mercedes-Benz S-klasse AMG | от 1999 |
| Mercedes-Benz SL-klasse | не допускается |
| Mercedes-Benz W124 | от 1985 |
| MG 350 | от 2011 |
| MG 5 | от 2013 |
| MINI Clubman | от 2013 |
| MINI Countryman | от 2019 |
| Mitsubishi Airtrek | от 2001 |
| Mitsubishi ASX | от 2010 |
| Mitsubishi Attrage | от 2014 |
| Mitsubishi Carisma | от 1995 |
| Mitsubishi Colt | от 1990 |
| Mitsubishi Diamante | от 1992 |
| Mitsubishi Eclipse | не допускается |
| Mitsubishi Eclipse Cross | от 2018 |
| Mitsubishi eK Space | не допускается |
| Mitsubishi eK Wagon | не допускается |
| Mitsubishi Galant | от 1987 |
| Mitsubishi i | от 2006 |
| Mitsubishi L200 | от 2006 |
| Mitsubishi Lancer | от 1987 |
| Mitsubishi Lancer Cargo | не допускается |
| Mitsubishi Lancer Evolution | от 2003 |
| Mitsubishi Legnum | от 1996 |
| Mitsubishi Libero | не допускается |
| Mitsubishi Minica | не допускается |
| Mitsubishi Mirage | от 1995 |
| Mitsubishi Montero | от 1997 |
| Mitsubishi Montero Sport | от 1997 |
| Mitsubishi Outlander | от 2002 |
| Mitsubishi Pajero | от 1989 |
| Mitsubishi Pajero iO | от 1998 |
| Mitsubishi Pajero Pinin | от 1999 |
| Mitsubishi Pajero Sport | от 2000 |
| Mitsubishi Sigma | от 1991 |
| Mitsubishi Space Star | от 1998 |
| Mitsubishi Xpander | от 2017 |
| Nissan AD | не допускается |
| Nissan Almera | от 1995 |
| Nissan Almera Classic | от 2006 |
| Nissan Altima | от 1998 |
| Nissan Armada | от 2004 |
| Nissan Avenir | не допускается |
| Nissan Bluebird | от 1988 |
| Nissan Bluebird Sylphy | не допускается |
| Nissan Cedric | от 1996 |
| Nissan Cefiro | не допускается |
| Nissan Dayz | не допускается |
| Nissan Dualis | от 2007 |
| Nissan Expert | не допускается |
| Nissan Fuga | от 2004 |
| Nissan Gloria | не допускается |
| Nissan Juke | от 2010 |
| Nissan Latio | не допускается |
| Nissan Laurel | от 1993 |
| Nissan Leaf | от 2010 |
| Nissan March | от 1995 |
| Nissan Maxima | от 1992 |
| Nissan Micra | от 1993 |
| Nissan Moco | не допускается |
| Nissan Murano | от 2003 |
| Nissan Navara (Frontier) | от 2006 |
| Nissan Note | от 2005 |
| Nissan Otti | от 2006 |
| Nissan Pathfinder | от 1996 |
| Nissan Patrol | от 1998 |
| Nissan Pixo | от 2008 |
| Nissan Presea | не допускается |
| Nissan Primera | от 1990 |
| Nissan Pulsar | от 1993 |
| Nissan Qashqai | от 2007 |
| Nissan Qashqai+2 | от 2008 |
| Nissan R'nessa | не допускается |
| Nissan Rogue | от 2007 |
| Nissan Safari | не допускается |
| Nissan Sentra | от 1997 |
| Nissan Silvia | не допускается |
| Nissan Skyline | от 1985 |
| Nissan Sunny | от 1985 |
| Nissan Teana | от 2003 |
| Nissan Terrano | от 1993 |
| Nissan Tiida | от 2004 |
| Nissan Versa | от 2006 |
| Nissan Wingroad | не допускается |
| Nissan X-Trail | от 2000 |
| Opel Agila | от 2000 |
| Opel Antara | от 2007 |
| Opel Ascona | от 1985 |
| Opel Astra | от 1991 |
| Opel Astra OPC | от 2001 |
| Opel Corsa | от 1994 |
| Opel Frontera | от 1995 |
| Opel Grandland X | от 2017 |
| Opel Insignia | от 2008 |
| Opel Kadett | от 1985 |
| Opel Mokka | от 2012 |
| Opel Omega | от 1987 |
| Opel Signum | от 2003 |
| Opel Vectra | от 1988 |
| Opel Vectra OPC | от 2005 |
| Opel Vita | от 1995 |
| Peugeot 1007 | от 2009 |
| Peugeot 107 | не допускается |
| Peugeot 2008 | от 2014 |
| Peugeot 206 | от 1999 |
| Peugeot 207 | от 2006 |
| Peugeot 208 | от 2013 |
| Peugeot 3008 | от 2009 |
| Peugeot 301 | от 2013 |
| Peugeot 306 | от 1996 |
| Peugeot 307 | от 2001 |
| Peugeot 308 | от 2007 |
| Peugeot 4007 | от 2008 |
| Peugeot 4008 | от 2012 |
| Peugeot 405 | от 1989 |
| Peugeot 406 | от 1995 |
| Peugeot 407 | от 2004 |
| Peugeot 408 | от 2012 |
| Peugeot 508 | от 2011 |
| Peugeot 605 | от 1990 |
| Peugeot 607 | от 2001 |
| Peugeot RCZ | не допускается |
| Porsche Cayenne | от 2004 |
| Porsche Macan | от 2015 |
| Ravon Gentra | от 2015 |
| Ravon Matiz | от 2015 |
| Ravon Nexia R3 | от 2015 |
| Ravon R2 | от 2016 |
| Ravon R4 | от 2016 |
| Renault 19 | от 1989 |
| Renault Arkana | от 2019 |
| Renault Clio | от 1993 |
| Renault Clio RS | от 2004 |
| Renault Duster | от 2010 |
| Renault Espace | от 1995 |
| Renault Fluence | от 2009 |
| Renault Kadjar | от 2015 |
| Renault Kaptur | от 2016 |
| Renault Koleos | от 2008 |
| Renault KWID | от 2015 |
| Renault Laguna | от 1994 |
| Renault Latitude | от 2010 |
| Renault Logan | от 2005 |
| Renault Logan Stepway | от 2018 |
| Renault Megane | от 1996 |
| Renault Megane RS | от 2004 |
| Renault Samsung SM3 | от 2010 |
| Renault Samsung SM5 | от 1998 |
| Renault Sandero | от 2009 |
| Renault Sandero RS | от 2015 |
| Renault Symbol | от 2002 |
| Renault Talisman | от 2015 |
| Renault Vel Satis | о�� 2003 |
| Rover 45 | от 2000 |
| Rover 600 | от 1993 |
| Saab 9-3 | от 2002 |
| Saipa Saina | от 2014 |
| Saipa Tiba | от 2009 |
| Saturn Astra | от 2008 |
| Saturn VUE | от 2002 |
| Scion xA | от 2004 |
| SEAT Cordoba | от 1996 |
| SEAT Ibiza | от 1994 |
| SEAT Leon | от 2000 |
| SEAT Toledo | от 1992 |
| Skoda Fabia | от 2000 |
| Skoda Fabia RS | от 2011 |
| Skoda Felicia | от 1990 |
| Skoda Karoq | от 2018 |
| Skoda Kodiaq | от 2017 |
| Skoda Octavia | от 1997 |
| Skoda Octavia RS | от 2008 |
| Skoda Rapid | от 2012 |
| Skoda Superb | от 2002 |
| Skoda Yeti | от 2010 |
| Smart Forfour | от 2004 |
| Soueast Lioncel | не допускается |
| SsangYong Actyon | от 2007 |
| SsangYong Actyon Sports | от 2008 |
| SsangYong Kyron | от 2006 |
| SsangYong Musso | от 1997 |
| SsangYong Nomad | от 2013 |
| SsangYong Rexton | от 2001 |
| SsangYong Tivoli | от 2017 |
| Subaru Forester | от 1997 |
| Subaru Impreza | от 1993 |
| Subaru Impreza WRX | от 2001 |
| Subaru Impreza WRX STi | от 2001 |
| Subaru Justy | от 2008 |
| Subaru Legacy | от 1991 |
| Subaru Legacy Lancaster | от 1996 |
| Subaru Outback | от 1997 |
| Subaru Trezia | от 2011 |
| Subaru Tribeca | от 2005 |
| Subaru WRX | от 2015 |
| Subaru XV | от 2011 |
| Suzuki Aerio | от 2001 |
| Suzuki Alto | от 2000 |
| Suzuki Baleno | от 1995 |
| Suzuki Cara | не допускается |
| Suzuki Escudo | от 1991 |
| Suzuki Grand Vitara | от 1998 |
| Suzuki Ignis | от 2001 |
| Suzuki Kei | не допускается |
| Suzuki Kizashi | от 2010 |
| Suzuki Liana | от 2001 |
| Suzuki Splash | от 2008 |
| Suzuki Swift | от 1990 |
| Suzuki SX4 | от 2006 |
| Suzuki Vitara | от 1993 |
| Suzuki Wagon R | от 1997 |
| Suzuki X-90 | не допускается |
| Suzuki XL7 | от 2001 |
| Tesla Model S | от 2013 |
| Tesla Model X | от 2017 |
| Toyota 4Runner | от 1996 |
| Toyota Allex | не допускается |
| Toyota Allion | от 2001 |
| Toyota Altezza | не допускается |
| Toyota Aqua | не допускается |
| Toyota Aristo | не допускается |
| Toyota Aurion | от 2007 |
| Toyota Auris | от 2006 |
| Toyota Avalon | от 1995 |
| Toyota Avensis | от 1997 |
| Toyota Aygo | от 2005 |
| Toyota Belta | от 2005 |
| Toyota Brevis | не допускается |
| Toyota C-HR | от 2017 |
| Toyota Caldina | не допускается |
| Toyota Camry | от 1985 |
| Toyota Camry Solara | не допускается |
| Toyota Carina | от 1984 |
| Toyota Carina E | от 1992 |
| Toyota Carina ED | не допускается |
| Toyota Cavalier | не допускается |
| Toyota Celica | не допускается |
| Toyota Chaser | не допускается |
| Toyota Corolla | от 1985 |
| Toyota Corolla Fielder | от 2000 |
| Toyota Corolla II | не допускается |
| Toyota Corolla Rumion | не допускается |
| Toyota Corona | от 1984 |
| Toyota Corona EXiV | не допускается |
| Toyota Corsa | от 1990 |
| Toyota Cresta | не допускается |
| Toyota Crown | от 1986 |
| Toyota Crown Majesta | не допускается |
| Toyota Duet | не допускается |
| Toyota Echo | от 1999 |
| Toyota Fortuner | от 2005 |
| Toyota Harrier | от 1998 |
| Toyota Highlander | от 2001 |
| Toyota Hilux | от 1998 |
| Toyota Hilux Surf | от 1991 |
| Toyota Ist | не допускается |
| Toyota Kluger | не допускается |
| Toyota Land Cruiser | от 1995 |
| Toyota Land Cruiser Prado | от 1996 |
| Toyota Mark II | от 1985 |
| Toyota Mark X | не допускается |
| Toyota Opa | не допускается |
| Toyota Passo | от 2004 |
| Toyota Pixis Epoch | от 2012 |
| Toyota Platz | не допускается |
| Toyota Premio | не допускается |
| Toyota Prius | от 1997 |
| Toyota Prius c | от 2012 |
| Toyota Probox | не допускается |
| Toyota Progres | не допускается |
| Toyota Pronard | не допускается |
| Toyota RAV 4 | от 1995 |
| Toyota Rush | от 2006 |
| Toyota Sai | не допускается |
| Toyota Scepter | от 1994 |
| Toyota Sequoia | от 2001 |
| Toyota Sprinter | от 1988 |
| Toyota Sprinter Carib | не допускается |
| Toyota Sprinter Marino | не допускается |
| Toyota Starlet | от 1996 |
| Toyota Succeed | не допускается |
| Toyota Tercel | от 1985 |
| Toyota Urban Cruiser | от 2009 |
| Toyota Vanguard | не допускается |
| Toyota Venza | от 2009 |
| Toyota Verossa | не допускается |
| Toyota Vios | от 2003 |
| Toyota Vista | от 1985 |
| Toyota Vitz | не допускается |
| Toyota Voltz | от 2002 |
| Toyota WiLL | не допускается |
| Toyota WiLL Cypha | не допускается |
| Toyota Windom | не допускается |
| Toyota Yaris | от 1999 |
| Vauxhall Astra | не допускается |
| Volkswagen Amarok | от 2011 |
| Volkswagen Beetle | от 1998 |
| Volkswagen Bora | от 1998 |
| Volkswagen Golf | от 1986 |
| Volkswagen Golf Country | от 1995 |
| Volkswagen Golf GTI | от 1993 |
| Volkswagen Golf R | от 2006 |
| Volkswagen ID.4 | от 2020 |
| Volkswagen ID.6 | от 2021 |
| Volkswagen Jetta | от 1985 |
| Volkswagen Lupo | от 1998 |
| Volkswagen Parati | от 2005 |
| Volkswagen Passat | от 1986 |
| Volkswagen Passat CC | от 2008 |
| Volkswagen Phaeton | от 2005 |
| Volkswagen Pointer | от 2004 |
| Volkswagen Polo | от 1992 |
| Volkswagen Polo GTI | от 2010 |
| Volkswagen Polo R WRC | не допускается |
| Volkswagen Scirocco | не допускается |
| Volkswagen Teramont | от 2019 |
| Volkswagen Tiguan | от 2007 |
| Volkswagen Touareg | от 2002 |
| Volkswagen Vento | от 1991 |
| Volvo 850 | от 1991 |
| Volvo 940 | от 1992 |
| Volvo S40 | от 1996 |
| Volvo S60 | от 2000 |
| Volvo S60 Cross Country | от 2015 |
| Volvo S70 | от 1997 |
| Volvo S80 | от 1999 |
| Volvo S90 | от 2017 |
| Volvo V40 | от 1998 |
| Volvo V50 | от 2004 |
| Volvo V60 | от 2012 |
| Volvo V60 Cross Country | от 2017 |
| Volvo V70 | от 1997 |
| Volvo V90 | от 2017 |
| Volvo XC60 | от 2008 |
| Volvo XC70 | от 2001 |
| Volvo XC90 | от 2002 |
| Vortex Corda | от 2010 |
| Vortex Estina | от 2008 |
| Vortex Tingo | от 2010 |
| Zeekr 001 | от 2021 |
| Zotye T600 | от 2016 |
| Zotye Z300 | от 2013 |
| ГАЗ (кроме указанных моделей) | не допускается |
| ГАЗ Volga Siber | от 2008 |
| ЗАЗ 1103 «Славута» | от 1999 |
| ЗАЗ Chance | от 2009 |
| ЗАЗ Forza | от 2011 |
| ЗАЗ Sens | от 2004 |
| ЗАЗ Vida | от 2012 |
| Москвич (все модели) | не допускается |
| ТагАЗ C10 | от 2011 |
| ТагАЗ C190 | от 2011 |
| ТагАЗ Vega | от 2009 |
| УАЗ (кроме указанных моделей) | не допускается |
| УАЗ Patriot | от 2013 |
| Другие модели | от 1999 |

**В тарифе могут работать, транспортные средства согласно требованиям, кроме минивенов.**

$str$,
  'Список автомобилей и годов выпуска, подходящих для работы по тарифу Тариф «Межгород» в Алматы.',
  (SELECT id FROM categories WHERE slug = 'tariffs'),
  TRUE,
  150
);

INSERT INTO articles (title, slug, content, summary, category_id, published, views) VALUES
(
  'Тариф «Комфорт»',
  'auto-list-комфорт',
  $str$# Тариф «Комфорт»

[← Назад к общему списку](/articles/auto-list)

| Марка и модель | Требования |
| --- | --- |
| Acura MDX | от 2013 |
| Acura TL | не допускается |
| Acura TSX | от 2014 |
| Alfa Romeo 166 | не допускается |
| Audi 100 | не допускается |
| Audi 80 | не допускается |
| Audi 90 | не допускается |
| Audi A3 | от 2018 |
| Audi A4 | от 2014 |
| Audi A4 allroad | от 2014 |
| Audi A5 | от 2014 |
| Audi A6 | от 2013 |
| Audi A6 allroad | от 2013 |
| Audi A8 | от 2013 |
| Audi Q5 | от 2014 |
| Audi Q7 | от 2013 |
| Audi Quattro | не допускается |
| Audi S4 | от 2014 |
| Audi S8 | от 2013 |
| BAIC EU5 | от 2018 |
| BAIC Huansu H5 | от 2018 |
| Baojun Yunduo | от 2023 |
| Bentley Flying Spur | от 2013 |
| BMW 1er | от 2018 |
| BMW 315 | не допускается |
| BMW 318i | от 2014 |
| BMW 327 | не допускается |
| BMW 3er | от 2014 |
| BMW 4er | от 2014 |
| BMW 503 | не допускается |
| BMW 520 | от 2013 |
| BMW 5er | от 2013 |
| BMW 7er | от 2013 |
| BMW M3 | от 2018 |
| BMW M5 | от 2014 |
| BMW X1 | от 2018 |
| BMW X2 | от 2018 |
| BMW X3 | от 2014 |
| BMW X5 | от 2013 |
| BMW X6 | от 2013 |
| BYD Chazor | от 2022 |
| BYD Destroyer 05 | от 2022 |
| BYD Dolphin | от 2021 |
| BYD E2 | от 2019 |
| BYD E5 | от 2018 |
| BYD F3 | от 2018 |
| BYD Han | от 2020 |
| BYD QCJ7 | не допускается |
| BYD Qin | от 2018 |
| BYD Qin Plus | от 2018 |
| BYD Qin Pro | от 2018 |
| BYD Seagull | от 2023 |
| BYD Seal | от 2022 |
| BYD Song | от 2020 |
| BYD Song Plus | от 2020 |
| BYD Song Pro | от 2019 |
| BYD Yuan | от 2021 |
| BYD Yuan Plus | от 2021 |
| BYD Yuan Up | от 2024 |
| Cadillac Escalade | не допускается |
| Cadillac STS | не допускается |
| Cadillac XT5 | от 2016 |
| Changan A500 | от 2020 |
| Changan Alsvin (до 15 августа 2025) | от 2021 |
| Changan Alsvin (после 15 августа 2025) | не допускается (кроме машин 2021-2025 годов, которые были зарегистрированы* в сервисе не позднее 15 августа 2025) |
| Changan Auchan A600 EV | от 2018 |
| Changan Benben E-Star | не допускается |
| Changan Changxing | не допускается |
| Changan CS35 | от 2021 |
| Changan CS35 Max | от 2024 |
| Changan CS35 Plus | от 2021 |
| Changan CS55 | от 2018 |
| Changan CS55PLUS | от 2019 |
| Changan CS75 | от 2014 |
| Changan CS75PLUS | от 2019 |
| Changan CS85 | от 2019 |
| Changan CX20 | не допускается |
| Changan Eado | от 2018 |
| Changan Eado EV | от 2018 |
| Changan Eado Plus | от 2020 |
| Changan Lamore | от 2023 |
| Changan Raeton | от 2013 |
| Changan SC7151 | от 2014 |
| Changan Shenlan S7 | от 2023 |
| Changan Shenlan SL03 | от 2022 |
| Changan Star | не допускается |
| Changan UNI-K | от 2020 |
| Changan UNI-T | от 2020 |
| Changan UNI-V | от 2022 |
| Changan Yidong | от 2018 |
| Chery Arrizo 8 | от 2022 |
| Chery Explore 06 | от 2023 |
| Chery Sweet (QQ) | не допускается |
| Chery Tiggo (T11) | не допускается |
| Chery Tiggo 2 | не допускается |
| Chery Tiggo 2 Pro | от 2021 |
| Chery Tiggo 3 | не допускается |
| Chery Tiggo 4 | от 2021 |
| Chery Tiggo 4 Pro | от 2021 |
| Chery Tiggo 7 | от 2019 |
| Chery Tiggo 7 Plus | от 2021 |
| Chery Tiggo 7 Pro | от 2020 |
| Chery Tiggo 7 Pro Max | от 2022 |
| Chery Tiggo 8 | от 2018 |
| Chery Tiggo 8 Pro | от 2021 |
| Chery Tiggo 8 Pro Max | от 2022 |
| CheryExeed LX | от 2019 |
| Chevrolet Aveo | не допускается |
| Chevrolet Captiva | от 2014 |
| Chevrolet Chevelle | не допускается |
| Chevrolet Cobalt (до 15 августа 2025) | <p>от 2024</p> |
| Chevrolet Cobalt (после 15 августа 2025) | не допускается (кроме машин 2024-2025 годов, которые были зарегистрированы* в сервисе не позднее 15 августа 2025) |
| Chevrolet Cruze | от 2018 |
| Chevrolet Damas | не допускается |
| Chevrolet Epica | не допускается |
| Chevrolet Equinox | от 2014 |
| Chevrolet Klac | от 2014 |
| Chevrolet Klan J200 | не допускается |
| Chevrolet Lacetti | от 2018 |
| Chevrolet Lanos | не допускается |
| Chevrolet Malibu | от 2014 |
| Chevrolet MATIZ | не допускается |
| Chevrolet Montana | от 2023 |
| Chevrolet Monza | от 2018 |
| Chevrolet Nexia | не допускается |
| Chevrolet Niva | не допускается |
| Chevrolet Onix | от 2021 |
| Chevrolet Orlando | от 2018 |
| Chevrolet Rezzo | не допускается |
| Chevrolet Spark | не допускается |
| Chevrolet Tracker | от 2021 |
| Chevrolet TrailBlazer | не допускается |
| Chrysler 200 | от 2014 |
| Chrysler 300 | не допускается |
| Chrysler 300C | от 2013 |
| Chrysler 300M | не допускается |
| Chrysler PT Cruiser | не допускается |
| Chrysler Sebring | не допускается |
| Citroen Berlingo | от 2018 |
| Dacia Sandero | не допускается |
| Daewoo Damas | не допускается |
| Daewoo Espero | не допускается |
| Daewoo Gentra | не допускается |
| Daewoo Kalos | не допускается |
| Daewoo Lacetti | не допускается |
| Daewoo Lanos | не допускается |
| Daewoo Leganza | не допускается |
| Daewoo Magnus | не допускается |
| Daewoo Matiz | не допускается |
| Daewoo Nexia | не допускается |
| Daewoo Nubira | не допускается |
| Daewoo Rezzo | не допускается |
| Daewoo Tacuma | не допускается |
| Daewoo Tosca | не допускается |
| Daihatsu Materia | не допускается |
| Daihatsu Pyzar | не допускается |
| Daihatsu Sirion | не допускается |
| Daihatsu Storia | не допускается |
| Daihatsu Terios | не допускается |
| Daimler X350 | не допускается |
| Datsun mi-DO | не допускается |
| Datsun on-DO | не допускается |
| DFSK Glory 500 | не допускается |
| Dodge Caliber | не допускается |
| Dodge Caravan | от 2018 |
| Dodge Charger | не допускается |
| Dodge Stratus | не допускается |
| DongFeng 580 | от 2017 |
| DongFeng Aeolus Haoji | от 2022 |
| DongFeng Aeolus Yixuan | не допускается |
| DongFeng D-series | не допускается |
| DongFeng E1 | от 2021 |
| DongFeng H30 Cross | не допускается |
| DongFeng S30 | не допускается |
| DongFeng S50 EV | от 2018 |
| EXEED LX | от 2019 |
| EXEED RX | от 2023 |
| EXEED TXL | от 2022 |
| EXEED VX | от 2021 |
| FAW Bestune B70 | от 2020 |
| FAW Bestune T55 | от 2021 |
| FAW Bestune T77 | от 2018 |
| FAW Besturn B50 | не допускается |
| FAW Oley | не допускается |
| FAW V5 | не допускается |
| FAW Xiali N5 | не допускается |
| Fiat Panda | не допускается |
| Fiat Stilo | не допускается |
| Ford C-MAX | от 2018 |
| Ford EcoSport | от 2021 |
| Ford Edge | от 2014 |
| Ford Escape | от 2018 |
| Ford Explorer | не допускается |
| Ford Fiesta | не допускается |
| Ford Focus | от 2018 |
| Ford Focus RS | от 2018 |
| Ford Fusion | не допускается |
| Ford Fusion (North America) | от 2014 |
| Ford Galaxy | от 2018 |
| Ford Kuga | от 2018 |
| Ford Maverick | не допускается |
| Ford Mondeo | от 2014 |
| Ford Sierra | не допускается |
| Ford S-MAX | от 2018 |
| Ford Transit | не допускается |
| GAC Aion S | от 2019 |
| GAC GS3 | от 2024 |
| GAC GS5 | от 2020 |
| GAC GS8 | от 2016 |
| GAC M8 | от 2023 |
| GAC Trumpchi Empow | от 2021 |
| GAC Trumpchi GS3 | от 2021 |
| GAC Trumpchi M6 | от 2020 |
| Geely Atlas | от 2018 |
| Geely Atlas Pro | от 2021 |
| Geely Azkarra | от 2019 |
| Geely Boyue Cool | от 2023 |
| Geely CK (Otaka) | не допускается |
| Geely Coolray | от 2021 |
| Geely Emgrand | от 2021 |
| Geely Emgrand 7 | не допускается |
| Geely Emgrand EC7 | от 2015 |
| Geely Emgrand L | от 2022 |
| Geely Emgrand X7 | от 2018 |
| Geely GC6 | не допускается |
| Geely GC7 | от 2018 |
| Geely GC9 | от 2015 |
| Geely Geometry E | от 2022 |
| Geely Jiaji | от 2019 |
| Geely MK | не допускается |
| Geely MK Cross | не допускается |
| Geely Monjaro | от 2021 |
| Geely Okavango | от 2020 |
| Geely Preface | от 2020 |
| Geely SC7 | не допускается |
| Geely Tugella | от 2019 |
| Genesis G70 | от 2017 |
| Genesis G80 | от 2016 |
| Genesis G90 | от 2016 |
| Genesis GV70 | от 2020 |
| Genesis GV80 | от 2020 |
| Great Wall Hover | не допускается |
| Great Wall Hover H5 | не допускается |
| Great Wall Hover M4 | не допускается |
| Great Wall Poer King Kong | не допускается |
| Great Wall Voleex C30 | не допускается |
| Great Wall Wingle 7 | от 2018 |
| Haval Chitu | от 2021 |
| Haval Dargo | от 2022 |
| Haval F7 | от 2019 |
| Haval F7x | от 2019 |
| Haval H5 | не допускается |
| Haval H6 | от 2018 |
| Haval Jolion | от 2021 |
| Haval M6 | от 2021 |
| Honda Accord | от 2014 |
| Honda Avancier | от 2014 |
| Honda Capa | не допускается |
| Honda City | от 2021 |
| Honda Civic | от 2018 |
| Honda CR-V | от 2018 |
| Honda Domani | не допускается |
| Honda e:NP1 | от 2022 |
| Honda e:NS1 | от 2022 |
| Honda Element | не допускается |
| Honda Elysion | от 2018 |
| Honda Fit | от 2021 |
| Honda Freed | не допускается |
| Honda HR-V | от 2021 |
| Honda Insight | от 2021 |
| Honda Inspire | от 2014 |
| Honda Integra | не допускается |
| Honda Integra SJ | не допускается |
| Honda Jazz | от 2021 |
| Honda Legend | от 2014 |
| Honda M-NV | от 2021 |
| Honda Mobilio | от 2018 |
| Honda Odyssey | от 2018 |
| Honda Orthia | не допускается |
| Honda Partner | не допускается |
| Honda Pilot | от 2013 |
| Honda Saber | не допускается |
| Honda Shuttle | от 2021 |
| Honda S-MX | не допускается |
| Honda Stepwgn | от 2018 |
| Honda Stream | не допускается |
| Honda Street | не допускается |
| Honda Torneo | не допускается |
| Hongqi E-HS9 | от 2020 |
| Hongqi E-QM5 | от 2021 |
| Hongqi H5 | от 2017 |
| Hongqi H9 | от 2020 |
| Hongqi HS5 | от 2019 |
| Hyundai Accent | от 2021 |
| Hyundai Aslan | от 2014 |
| Hyundai Avante | от 2018 |
| Hyundai Azera | от 2018 |
| Hyundai Bayon | от 2021 |
| Hyundai Casper | не допускается |
| Hyundai Centennial | не допускается |
| Hyundai Click | не допускается |
| Hyundai Creta | от 2021 |
| Hyundai Custo | от 2021 |
| Hyundai Elantra | от 2018 |
| Hyundai Equus | от 2013 |
| Hyundai Galloper | не допускается |
| Hyundai Genesis | от 2013 |
| Hyundai Getz | не допускается |
| Hyundai Grand Starex | от 2018 |
| Hyundai Grandeur | от 2013 |
| Hyundai H-1 | от 2018 |
| Hyundai HD 120 | не допускается |
| Hyundai i10 | не допускается |
| Hyundai i20 | от 2021 |
| Hyundai i30 | от 2018 |
| Hyundai i40 | от 2014 |
| Hyundai IONIQ 5 | от 2021 |
| Hyundai ix25 | от 2021 |
| Hyundai ix35 | от 2018 |
| Hyundai Kona | от 2021 |
| Hyundai Kona Electric | от 2021 |
| Hyundai Lafesta | от 2018 |
| Hyundai Lantra | не допускается |
| Hyundai Lavita | не допускается |
| Hyundai Matrix | не допускается |
| Hyundai Mufasa | от 2023 |
| Hyundai Palisade | от 2018 |
| Hyundai Pony | не допускается |
| Hyundai Santa Fe | от 2014 |
| Hyundai Santamo | не допускается |
| Hyundai Solaris | от 2021 |
| Hyundai Sonata | от 2014 |
| Hyundai Starex | не допускается |
| Hyundai Staria | от 2021 |
| Hyundai Terracan | не допускается |
| Hyundai Tiburon | не допускается |
| Hyundai Trajet | не допускается |
| Hyundai Tucson | от 2018 |
| Hyundai Tuscani | не допускается |
| Hyundai Venue | от 2021 |
| Hyundai Verna | от 2021 |
| Infiniti FX | от 2013 |
| Infiniti G | не допускается |
| Infiniti I | не допускается |
| Infiniti Q30 | от 2018 |
| Infiniti Q50 | от 2014 |
| Infiniti QX30 | от 2018 |
| Infiniti QX56 | не допускается |
| Infiniti QX80 | не допускается |
| Iran Khodro Samand | не допускается |
| Iran Khodro Soren | от 2018 |
| Isuzu Axiom | не допускается |
| Isuzu Trooper | не допускается |
| JAC J7 | от 2020 |
| JAC JS3 | не допускается |
| JAC JS4 | от 2020 |
| JAC JS5 | от 2018 |
| JAC JS6 | от 2022 |
| JAC JS8 | не допускается |
| JAC N25 | не допускается |
| JAC Refine M4 | не допускается |
| JAC S3 | от 2018 |
| JAC S4 | не допускается |
| JAC S5 (Eagle) | от 2018 |
| JAC S7 | от 2020 |
| JAC Sehol A5 Plus | от 2021 |
| Jaecoo J7 | от 2023 |
| Jaguar S-Type | не допускается |
| Jaguar XF | от 2013 |
| Jaguar X-Type | не допускается |
| Jeep Cherokee | не допускается |
| Jeep Commander | не допускается |
| Jeep Compass | от 2018 |
| Jetour Dashing | от 2022 |
| Jetour T2 | от 2023 |
| Jetour X70 | от 2018 |
| Jetour X70 PLUS | <p>не допускается</p> |
| Jetour X90 | от 2019 |
| Jetour X90 PLUS | от 2021 |
| Jetour Х70 | от 2018 |
| Kaiyi E5 | от 2021 |
| Kaiyi X3 | от 2021 |
| Kaiyi X3 Pro | от 2022 |
| Kaiyi X7 Kunlun | от 2023 |
| Kia Cadenza | от 2013 |
| Kia Carens | от 2018 |
| Kia Carnival | от 2018 |
| Kia Cee'd | от 2018 |
| Kia Cee'd GT | от 2018 |
| Kia Cee'd SW | от 2018 |
| Kia Cerato | от 2018 |
| Kia EV6 | от 2021 |
| Kia Forte | от 2018 |
| Kia K3 | от 2018 |
| Kia K5 | от 2014 |
| Kia K7 | от 2013 |
| Kia K8 | от 2021 |
| Kia K9 | от 2013 |
| Kia KX1 | от 2021 |
| Kia Lotze | не допускается |
| Kia Magentis | не допускается |
| Kia Mohave (Borrego) | от 2013 |
| Kia Morning | не допускается |
| Kia Niro | от 2018 |
| Kia Optima | от 2014 |
| Kia Pegas | от 2021 |
| Kia Picanto | не допускается |
| Kia Pregio | не допускается |
| Kia Pride | не допускается |
| Kia ProCeed | от 2018 |
| Kia Quoris | от 2013 |
| Kia Ray | не допускается |
| Kia Rio | от 2021 |
| Kia Sedona | от 2018 |
| Kia Seltos | от 2021 |
| Kia Sephia | не допускается |
| Kia Shuma | не допускается |
| Kia Sorento | от 2014 |
| Kia Soul | от 2021 |
| Kia Spectra | не допускается |
| Kia Sportage | от 2018 |
| Kia Stinger | от 2017 |
| Kia Venga | не допускается |
| Kia XCeed | от 2019 |
| LADA (ВАЗ) 2109 | не допускается |
| LADA (ВАЗ) 21099 | не допускается |
| LADA (ВАЗ) 2110 | не допускается |
| LADA (ВАЗ) 2111 | не допускается |
| LADA (ВАЗ) 2112 | не допускается |
| LADA (ВАЗ) 2114 | не допускается |
| LADA (ВАЗ) 2115 | не допускается |
| LADA (ВАЗ) 2123 | не допускается |
| LADA (ВАЗ) EL Lada | не допускается |
| LADA (ВАЗ) Granta | не допускается |
| LADA (ВАЗ) Kalina | не допускается |
| LADA (ВАЗ) Largus | не допускается |
| LADA (ВАЗ) Priora | не допускается |
| LADA (ВАЗ) Vesta | от 2022 |
| LADA (ВАЗ) XRAY | от 2022 |
| Land Rover Freelander | не допускается |
| Land Rover Range Rover | не допускается |
| Land Rover Range Rover Evoque | от 2018 |
| Land Rover Range Rover Sport | не допускается |
| Lexus CT | от 2018 |
| Lexus ES | от 2013 |
| Lexus GS | от 2013 |
| Lexus GX | не допускается |
| Lexus IS | от 2014 |
| Lexus IS F | не допускается |
| Lexus LS | от 2013 |
| Lexus LX | не допускается |
| Lexus NX | от 2014 |
| Lexus RX | от 2013 |
| Lifan Cebrium (720) | от 2014 |
| Lifan Murman | от 2015 |
| Lifan Myway | от 2018 |
| Lifan Smily | не допускается |
| Lifan Solano | не допускается |
| Lifan X50 | не допускается |
| Lifan X60 | от 2018 |
| Lifan X70 | от 2018 |
| Lincoln MKZ | от 2013 |
| LiXiang L6 | от 2024 |
| LiXiang L7 | от 2023 |
| LiXiang L8 | от 2022 |
| LiXiang L9 | от 2022 |
| LiXiang One | от 2019 |
| Lynk&Co 08 | от 2023 |
| Maxus D90 | от 2018 |
| MAXUS G50 | от 2019 |
| Mazda 2 | от 2021 |
| Mazda 3 | от 2018 |
| Mazda 323 | не допускается |
| Mazda 5 | от 2018 |
| Mazda 6 | от 2014 |
| Mazda 626 | не допускается |
| Mazda Capella | не допускается |
| Mazda Cronos | не допускается |
| Mazda CX-30 | от 2019 |
| Mazda CX-5 | от 2018 |
| Mazda CX-7 | не допускается |
| Mazda CX-9 | от 2013 |
| Mazda Demio | не допускается |
| Mazda Familia | от 2018 |
| Mazda Millenia | не допускается |
| Mazda MPV | не допускается |
| Mazda Premacy | не допускается |
| Mazda Protege | не допускается |
| Mazda Tribute | не допускается |
| Mazda Xedos 6 | не допускается |
| Mazda Xedos 9 | не допускается |
| Mercedes-Benz 190 (W201) | не допускается |
| Mercedes-Benz A-klasse | от 2018 |
| Mercedes-Benz B-klasse | от 2018 |
| Mercedes-Benz C-klasse | от 2014 |
| Mercedes-Benz CLA-klasse | от 2018 |
| Mercedes-Benz CLS-klasse | от 2013 |
| Mercedes-Benz E-klasse | от 2013 |
| Mercedes-Benz E-klasse AMG | от 2013 |
| Mercedes-Benz G-klasse | не допускается |
| Mercedes-Benz GLC | от 2015 |
| Mercedes-Benz GLE | от 2015 |
| Mercedes-Benz GLK-klasse | от 2014 |
| Mercedes-Benz GL-klasse | от 2013 |
| Mercedes-Benz Maybach S-klasse | от 2014 |
| Mercedes-Benz M-klasse | от 2013 |
| Mercedes-Benz R-klasse | не допускается |
| Mercedes-Benz S-klasse | от 2013 |
| Mercedes-Benz S-klasse AMG | от 2013 |
| Mercedes-Benz Sprinter | не допускается |
| Mercedes-Benz Vaneo | не допускается |
| Mercedes-Benz Viano | не допускается |
| Mercedes-Benz Vito | от 2018 |
| Mercedes-Benz W124 | не допускается |
| MG 3 | не допускается |
| MG 350 | не допускается |
| MG 5 | от 2018 |
| MG 6 | от 2015 |
| MG HS | от 2018 |
| MG ZS | от 2021 |
| MINI Coupe | не допускается |
| MINI Hatch | от 2021 |
| Mitsubishi Airtrek | не допускается |
| Mitsubishi ASX | от 2018 |
| Mitsubishi Carisma | не допускается |
| Mitsubishi Challenger | не допускается |
| Mitsubishi Chariot | не допускается |
| Mitsubishi Colt | от 2021 |
| Mitsubishi Delica | не допускается |
| Mitsubishi Diamante | не допускается |
| Mitsubishi Eclipse Cross | от 2018 |
| Mitsubishi Galant | не допускается |
| Mitsubishi Grandis | не допускается |
| Mitsubishi L200 | не допускается |
| Mitsubishi Lancer | не допускается |
| Mitsubishi Lancer Evolution | не допускается |
| Mitsubishi Lancer Ralliart | от 2018 |
| Mitsubishi Legnum | не допускается |
| Mitsubishi Mirage | не допускается |
| Mitsubishi Montero | не допускается |
| Mitsubishi Montero Sport | не допускается |
| Mitsubishi Outlander | от 2014 |
| Mitsubishi Pajero | не допускается |
| Mitsubishi Pajero iO | не допускается |
| Mitsubishi Pajero Sport | не допускается |
| Mitsubishi RVR | от 2018 |
| Mitsubishi Sigma | не допускается |
| Mitsubishi Space Gear | не допускается |
| Mitsubishi Space Runner | не допускается |
| Mitsubishi Space Star | не допускается |
| Mitsubishi Space Wagon | не допускается |
| Mitsubishi Xpander | от 2018 |
| Neta N01 | не допускается |
| Neta X | от 2023 |
| Nio ET7 | от 2021 |
| Nissan Almera | не допускается |
| Nissan Almera Classic | не допускается |
| Nissan Almera Tino | не допускается |
| Nissan Altima | от 2014 |
| Nissan Armada | не допускается |
| Nissan Bluebird | не допускается |
| Nissan Bluebird Maxima | не допускается |
| Nissan Cedric | от 2014 |
| Nissan Cefiro | не допускается |
| Nissan Cube | от 2018 |
| Nissan Elgrand | от 2018 |
| Nissan Fuga | от 2013 |
| Nissan Gloria | не допускается |
| Nissan Juke | от 2021 |
| Nissan Juke Nismo | не допускается |
| Nissan Kicks | от 2021 |
| Nissan Laurel | не допускается |
| Nissan Leaf | от 2021 |
| Nissan Liberty | не допускается |
| Nissan Maxima | от 2014 |
| Nissan Micra | от 2021 |
| Nissan Murano | от 2013 |
| Nissan Note | от 2021 |
| Nissan NP300 | не допускается |
| Nissan Pathfinder | не допускается |
| Nissan Patrol | не допускается |
| Nissan Prairie | не допускается |
| Nissan Presage | не допускается |
| Nissan Primera | не допускается |
| Nissan Pulsar | не допускается |
| Nissan Qashqai | от 2018 |
| Nissan Qashqai+2 | не допускается |
| Nissan Quest | от 2018 |
| Nissan R'nessa | не допускается |
| Nissan Rogue | от 2014 |
| Nissan Sentra | от 2018 |
| Nissan Serena | от 2018 |
| Nissan Skyline | от 2014 |
| Nissan Stagea | не допускается |
| Nissan Sunny | от 2018 |
| Nissan Sylphy | от 2018 |
| Nissan Teana | от 2014 |
| Nissan Terrano | от 2021 |
| Nissan Tiida | от 2018 |
| Nissan Tino | не допускается |
| Nissan Versa | от 2018 |
| Nissan Wingroad | не допускается |
| Nissan X-Trail | от 2014 |
| Omoda C5 | от 2022 |
| Omoda S5 | от 2022 |
| Omoda S5 GT | от 2023 |
| Opel Astra | от 2018 |
| Opel Corsa | от 2021 |
| Opel Meriva | от 2018 |
| Opel Mokka | от 2021 |
| Opel Omega | не допускается |
| Opel Signum | не допускается |
| Opel Vectra | не допускается |
| Opel Vita | не допускается |
| Opel Zafira | от 2018 |
| Oshan X5 | от 2020 |
| Oshan X5 Plus | от 2022 |
| Peugeot 2008 | от 2021 |
| Peugeot 206 | не допускается |
| Peugeot 207 | не допускается |
| Peugeot 3008 | от 2018 |
| Peugeot 301 | от 2021 |
| Peugeot 307 | не допускается |
| Peugeot 308 | от 2018 |
| Peugeot 405 | не допускается |
| Peugeot 406 | не допускается |
| Peugeot 407 | не допускается |
| Peugeot 408 | от 2018 |
| Peugeot 508 | от 2014 |
| Peugeot 605 | не допускается |
| Peugeot 607 | не допускается |
| Peugeot Pars | от 2014 |
| Peugeot Partner | не допускается |
| Pontiac Vibe | не допускается |
| Porsche Cayenne | от 2013 |
| Qiyuan A06 | от 2023 |
| Ravon Gentra | не допускается |
| Ravon Nexia R3 | не допускается |
| Ravon R2 | не допускается |
| Ravon R4 | не допускается |
| Renault 21 | не допускается |
| Renault Arkana | от 2019 |
| Renault Captur | от 2021 |
| Renault Clio | от 2021 |
| Renault Dokker | не допускается |
| Renault Duster | от 2021 |
| Renault Espace | от 2021 |
| Renault Fluence | не допускается |
| Renault Kangoo | не допускается |
| Renault Kaptur | от 2021 |
| Renault Koleos | от 2014 |
| Renault Laguna | от 2014 |
| Renault Logan | не допускается |
| Renault Logan Stepway | не допускается |
| Renault Megane | от 2018 |
| Renault Samsung QM5 | от 2014 |
| Renault Samsung QM6 | от 2016 |
| Renault Samsung SM3 | от 2018 |
| Renault Samsung SM5 | от 2014 |
| Renault Samsung SM6 | от 2016 |
| Renault Samsung SM7 | от 2013 |
| Renault Samsung XM3 | от 2020 |
| Renault Sandero | не допускается |
| Renault Sandero RS | от 2021 |
| Renault Scenic | от 2018 |
| Renault Symbol | не допускается |
| Renault Talisman | от 2015 |
| Rolls-Royce Cullinan | от 2018 |
| Rolls-Royce Ghost | от 2013 |
| Rolls-Royce Phantom | от 2013 |
| Rover 600 | не допускается |
| Saab 9-5 | не допускается |
| SEAT Toledo | не допускается |
| Skoda Fabia | от 2021 |
| Skoda Felicia | не допускается |
| Skoda Karoq | от 2018 |
| Skoda Octavia | от 2018 |
| Skoda Rapid | от 2021 |
| Skoda Superb | от 2014 |
| Skoda Yeti | не допускается |
| Soueast DX8S | от 2022 |
| SsangYong Actyon | не допускается |
| SsangYong Actyon Sports | не допускается |
| SsangYong Chairman | от 2013 |
| SsangYong Korando | не допускается |
| SsangYong Kyron | не допускается |
| SsangYong Nomad | не допускается |
| SsangYong Rexton | не допускается |
| SsangYong Tivoli | от 2021 |
| Subaru Ascent | от 2017 |
| Subaru Forester | от 2014 |
| Subaru Impreza | от 2018 |
| Subaru Legacy | от 2014 |
| Subaru Legacy Lancaster | не допускается |
| Subaru Outback | от 2014 |
| Subaru Tribeca | от 2013 |
| Subaru XV | от 2018 |
| Suzuki Baleno | от 2021 |
| Suzuki Dzire | не допускается |
| Suzuki Ertiga | от 2018 |
| Suzuki Escudo | не допускается |
| Suzuki Grand Vitara | от 2021 |
| Suzuki Liana | не допускается |
| Suzuki Reno | не допускается |
| Suzuki Swift | не допускается |
| Suzuki SX4 | от 2021 |
| Suzuki Vitara | не допускается |
| Suzuki XL7 | не допускается |
| Tank 500 | не допускается |
| Tesla Model 3 | от 2017 |
| Tesla Model Y | от 2020 |
| Toyota 2000GT | не допускается |
| Toyota 4Runner | не допускается |
| Toyota Allex | не допускается |
| Toyota Altezza | не допускается |
| Toyota Aqua | не допускается |
| Toyota Aristo | не допускается |
| Toyota Aurion | от 2013 |
| Toyota Auris | от 2018 |
| Toyota Avalon | от 2013 |
| Toyota Avensis | от 2014 |
| Toyota Avensis Verso | не допускается |
| Toyota Aygo | не допускается |
| Toyota bZ3 | от 2023 |
| Toyota bZ4X | от 2022 |
| Toyota Caldina | не допускается |
| Toyota Cami | не допускается |
| Toyota Camry | от 2014 |
| Toyota Carina | не допускается |
| Toyota Carina E | не допускается |
| Toyota Carina ED | не допускается |
| Toyota Chaser | не допускается |
| Toyota C-HR | от 2021 |
| Toyota Corolla | от 2018 |
| Toyota Corolla Axio | от 2018 |
| Toyota Corolla Cross | от 2020 |
| Toyota Corolla Spacio | не допускается |
| Toyota Corolla Verso | не допускается |
| Toyota Corona | не допускается |
| Toyota Corona EXiV | не допускается |
| Toyota Corsa | не допускается |
| Toyota Cresta | не допускается |
| Toyota Crown | не допускается |
| Toyota Crown Majesta | от 2013 |
| Toyota Duet | не допускается |
| Toyota Echo | не допускается |
| Toyota Estima | не допускается |
| Toyota FJ Cruiser | не допускается |
| Toyota Fortuner | не допускается |
| Toyota Frontlander | от 2021 |
| Toyota Gaia | не допускается |
| Toyota Harrier | от 2014 |
| Toyota HiAce | не допускается |
| Toyota Highlander | от 2013 |
| Toyota Hilux | не допускается |
| Toyota Hilux Surf | не допускается |
| Toyota Innova | от 2018 |
| Toyota Ipsum | не допускается |
| Toyota ISis | не допускается |
| Toyota Ist | не допускается |
| Toyota Land Cruiser | не допускается |
| Toyota Land Cruiser Prado | не допускается |
| Toyota Levin | от 2018 |
| Toyota Mark II | не допускается |
| Toyota Mark X | не допускается |
| Toyota Matrix | не допускается |
| Toyota Nadia | не допускается |
| Toyota Noah | от 2018 |
| Toyota Picnic | не допускается |
| Toyota Platz | не допускается |
| Toyota Previa | не допускается |
| Toyota Prius | от 2018 |
| Toyota Progres | не допускается |
| Toyota Raize | от 2021 |
| Toyota Raum | не допускается |
| Toyota RAV 4 | от 2018 |
| Toyota Rush | от 2021 |
| Toyota Scepter | не допускается |
| Toyota Scion | не допускается |
| Toyota Sequoia | не допускается |
| Toyota Sienna | от 2018 |
| Toyota Sprinter | не допускается |
| Toyota Sprinter Carib | не допускается |
| Toyota Sprinter Marino | не допускается |
| Toyota Starlet | не допускается |
| Toyota Tacoma | не допускается |
| Toyota TownAce | от 2018 |
| Toyota Tundra | не допускается |
| Toyota Urban Cruiser | от 2018 |
| Toyota Vellfire | не допускается |
| Toyota Venza | от 2014 |
| Toyota Verso | не допускается |
| Toyota Verso-S | от 2018 |
| Toyota Vios | от 2021 |
| Toyota Vista | не допускается |
| Toyota Vitz | не допускается |
| Toyota Voxy | от 2018 |
| Toyota Wildlander | от 2020 |
| Toyota Windom | не допускается |
| Toyota Wish | не допускается |
| Toyota Yaris | не допускается |
| Toyota Yaris Verso | не допускается |
| Venucia V-Online | от 2021 |
| Volkswagen Bora | от 2018 |
| Volkswagen Caddy | не допускается |
| Volkswagen Caravelle | от 2018 |
| Volkswagen e-Bora | от 2018 |
| Volkswagen Gol | не допускается |
| Volkswagen Golf | от 2018 |
| Volkswagen Golf Country | не допускается |
| Volkswagen Golf GTI | от 2018 |
| Volkswagen Golf Plus | не допускается |
| Volkswagen ID.4 | от 2020 |
| Volkswagen ID.6 | от 2021 |
| Volkswagen Jetta | от 2018 |
| Volkswagen Lavida | от 2018 |
| Volkswagen Multivan | от 2018 |
| Volkswagen Passat | от 2014 |
| Volkswagen Passat (North America) | от 2014 |
| Volkswagen Passat CC | от 2014 |
| Volkswagen Phaeton | от 2013 |
| Volkswagen Polo | от 2021 |
| Volkswagen Polo GTI | от 2021 |
| Volkswagen Santana | от 2018 |
| Volkswagen Sharan | от 2018 |
| Volkswagen Taos | от 2020 |
| Volkswagen Tayron | от 2018 |
| Volkswagen T-Cross | от 2021 |
| Volkswagen Teramont | от 2017 |
| Volkswagen Tiguan | от 2018 |
| Volkswagen Touareg | от 2013 |
| Volkswagen Touran | от 2018 |
| Volkswagen Transporter | не допускается |
| Volkswagen T-Roc | от 2021 |
| Volkswagen Vento | не допускается |
| Volvo 850 | не допускается |
| Volvo 940 | не допускается |
| Volvo S40 | не допускается |
| Volvo S60 | от 2014 |
| Volvo S70 | не допускается |
| Volvo S80 | от 2013 |
| Volvo V70 | от 2014 |
| Volvo XC70 | от 2014 |
| Volvo XC90 | от 2013 |
| Vortex Estina | не допускается |
| Voyah Dream | от 2021 |
| Voyah Free | от 2021 |
| Weltmeister EX5 | от 2018 |
| Weltmeister W6 | от 2021 |
| Wuling Binguo | от 2023 |
| Wuling Starlight | от 2023 |
| Wuling Xingchi | от 2022 |
| Zeekr 001 | от 2021 |
| Zeekr 007 | от 2023 |
| Zeekr 009 | от 2022 |
| Zeekr X | от 2023 |
| Zotye T300 | не допускается |
| ГАЗ Volga Siber | не допускается |
| ЗАЗ Chance | не допускается |
| ЗАЗ Forza | не допускается |
| ЗАЗ Sens | не допускается |
| ЗАЗ Vida | не допускается |
| УАЗ Patriot | не допускается |
| УАЗ Patriot Фургон | не допускается |

$str$,
  'Список автомобилей и годов выпуска, подходящих для работы по тарифу Тариф «Комфорт» в Алматы.',
  (SELECT id FROM categories WHERE slug = 'tariffs'),
  TRUE,
  150
);

INSERT INTO articles (title, slug, content, summary, category_id, published, views) VALUES
(
  'Тариф «Комфорт+»',
  'auto-list-комфорт-plus',
  $str$# Тариф «Комфорт+»

[← Назад к общему списку](/articles/auto-list)

| Марка и модель | Требования |
| --- | --- |
| AC 378 GT Zagato | не допускается |
| AC Ace | не допускается |
| Acura ILX | от 2021 |
| Acura MDX | от 2018 |
| Acura RDX | от 2021 |
| Acura RL | не допускается |
| Acura TL | не допускается |
| Acura TLX | от 2021 |
| Acura TSX | не допускается |
| Audi A1 | не допускается |
| Audi A2 | не допускается |
| Audi A3 | не допускается |
| Audi A4 | от 2021 |
| Audi A4 allroad | от 2021 |
| Audi A5 | от 2021 |
| Audi A6 | от 2018 |
| Audi A6 allroad | от 2018 |
| Audi A7 | от 2018 |
| Audi A8 | от 2018 |
| Audi e-tron | не допускается |
| Audi e-tron Sportback | от 2019 |
| Audi Q3 | от 2023 |
| Audi Q5 | от 2021 |
| Audi Q7 | от 2018 |
| Audi Q8 | от 2018 |
| Audi Quattro | не допускается |
| Audi S3 | от 2024 |
| Audi S4 | от 2021 |
| Audi S6 | от 2018 |
| Audi S8 | от 2018 |
| Avatr 12 | от 2023 |
| BAIC EC3 | не допускается |
| BAIC EU5 | от 2024 |
| BAIC EV200 | не допускается |
| BAIC EX5 | не допускается |
| BAIC U5 | не допускается |
| BAIC U5 Plus | от 2024 |
| BAIC X35 | не допускается |
| BAIC X7 | от 2021 |
| Baojun Yunduo | от 2024 |
| BAW Ace M7 | не допускается |
| Beijing EU7 | от 2021 |
| Belgee X50 | не допускается |
| Belgee X70 | от 2024 |
| Bentley Flying Spur | от 2018 |
| Bentley Mulsanne | от 2018 |
| BMW 1er | не допускается |
| BMW 2er | от 2024 |
| BMW 2er Active Tourer | не допускается |
| BMW 2er Grand Tourer | не допускается |
| BMW 3er | от 2021 |
| BMW 4er | от 2021 |
| BMW 5er | от 2018 |
| BMW 6er | от 2018 |
| BMW 7er | от 2018 |
| BMW i3 | не допускается |
| BMW M3 | от 2022 |
| BMW M5 | от 2019 |
| BMW X1 | не допускается |
| BMW X2 | от 2023 |
| BMW X3 | от 2021 |
| BMW X4 | от 2021 |
| BMW X5 | от 2018 |
| BMW X6 | от 2018 |
| Brilliance H230 | не допускается |
| Brilliance H530 | не допускается |
| Brilliance M1 (BS6) | не допускается |
| Brilliance M2 (BS4) | не допускается |
| Brilliance V3 | не допускается |
| Brilliance V5 | не допускается |
| Buick Encore | не допускается |
| Buick Encore GX | от 2023 |
| Buick Envision | от 2023 |
| Buick Excelle | не допускается |
| Buick LaCrosse | от 2018 |
| Buick Velite 6 | не допускается |
| BYD Chazor | от 2024 |
| BYD D1 | от 2024 |
| BYD Destroyer 05 | от 2022 |
| BYD Dolphin | не допускается |
| BYD E2 | не допускается |
| BYD E3 | не допускается |
| BYD E5 | не допускается |
| BYD E6 | от 2024 |
| BYD F3 | не допускается |
| BYD F5 | не допускается |
| BYD F6 | не допускается |
| BYD FangChengBao Titanium 3 | от 2024 |
| BYD G3 | не допускается |
| BYD Han | от 2020 |
| BYD L3 | не допускается |
| BYD New F3 | не допускается |
| BYD Qin | от 2024 |
| BYD Qin Plus | от 2024 (а также машины 2023 года, которые были зарегистрированы в сервисе не позднее 22 января 2026) |
| BYD Qin Pro | от 2024 |
| BYD S6 | не допускается |
| BYD Sea Lion 05 | от 2024 |
| BYD Sea Lion 07 | от 2024 |
| BYD Seagull | не допускается |
| BYD Seal | от 2022 |
| BYD Seal 05 | от 2025 |
| BYD Seal 06 | от 2024 |
| BYD Song L | от 2023 |
| BYD Song Plus | от 2021 |
| BYD Song Pro | от 2021 |
| BYD Tang | от 2021 |
| BYD Yuan | не допускается |
| BYD Yuan Plus | от 2023 |
| BYD Yuan Up | не допускается |
| Cadillac ATS | не допускается |
| Cadillac BLS | не допускается |
| Cadillac CTS | от 2018 |
| Cadillac Escalade | от 2018 |
| Cadillac SRX | не допускается |
| Cadillac STS | не допускается |
| Cadillac XT5 | от 2021 |
| Changan Alsvin | не допускается |
| Changan Alsvin V3 | не допускается |
| Changan Alsvin V7 | не допускается |
| Changan Benben E-Star | не допускается |
| Changan CS35 | не допускается |
| Changan CS35 Max | от 2025 |
| Changan CS35 Plus | не допускается |
| Changan CS55 | от 2023 |
| Changan CS55PLUS | от 2023 |
| Changan CS75 | от 2021 |
| Changan CS75PLUS | от 2021 |
| Changan CS95 | от 2018 |
| Changan Deepal G318 | от 2024 |
| Changan Deepal L07 | от 2024 |
| Changan Deepal S05 | от 2024 |
| Changan Deepal S07 | от 2023 |
| Changan Deepal S09 | от 2024 |
| Changan Deepal SL03 | от 2022 |
| Changan Eado | от 2024 |
| Changan Eado EV | от 2024 |
| Changan Eado Plus | от 2024 |
| Changan Hunter Plus | не допускается |
| Changan Lamore | от 2023 |
| Changan Raeton | не допускается |
| Changan Star | не допускается |
| Changan UNI-K | от 2020 |
| Changan UNI-S | от 2024 |
| Changan UNI-T | от 2023 |
| Changan UNI-V | от 2024 |
| Changan UNI-Z | от 2024 |
| Changan X5 Plus | от 2024 |
| Changan X7 Plus | от 2024 |
| ChangFeng Leopaard CS9 | не допускается |
| Chery Amulet (A15) | не допускается |
| Chery Arizzo 5 Plus | от 2024 |
| Chery Arrizo 5 | от 2024 |
| Chery Arrizo 6 Pro | не допускается |
| Chery Arrizo 7 | не допускается |
| Chery Arrizo 8 | от 2022 |
| Chery Bonus (A13) | не допускается |
| Chery Bonus 3 (E3/A19) | не допускается |
| Chery CrossEastar (B14) | не допускается |
| Chery E5 | не допускается |
| Chery Eastar | не допускается |
| Chery eQ5 | от 2021 |
| Chery eQ7 | от 2023 |
| Chery Explore 06 | от 2023 |
| Chery Fora (A21) | не допускается |
| Chery Fulwin A8 | от 2023 |
| Chery IndiS (S18D) | не допускается |
| Chery M11 (A3) | не допускается |
| Chery QQ6 (S21) | не допускается |
| Chery Tiggo (T11) | не допускается |
| Chery Tiggo 2 | не допускается |
| Chery Tiggo 2 Pro | не допускается |
| Chery Tiggo 3 | не допускается |
| Chery Tiggo 4 | не допускается |
| Chery Tiggo 4 Pro | не допускается |
| Chery Tiggo 5 | не допускается |
| Chery Tiggo 7 | от 2023 |
| Chery Tiggo 7 Plus | от 2023 |
| Chery Tiggo 7 Pro | от 2023 |
| Chery Tiggo 7 Pro Max | от 2023 |
| Chery Tiggo 8 | от 2021 |
| Chery Tiggo 8 Plus | от 2021 |
| Chery Tiggo 8 Pro | от 2021 |
| Chery Tiggo 8 Pro Max | от 2022 |
| Chery Tiggo 9 | от 2023 |
| Chery Very (A13) | не допускается |
| Chevrolet Alero | не допускается |
| Chevrolet Aveo | не допускается |
| Chevrolet Blazer | не допускается |
| Chevrolet Bolt | не допускается |
| Chevrolet Captiva | от 2021 |
| Chevrolet Celta | не допускается |
| Chevrolet Classic | не допускается |
| Chevrolet Cobalt | не допускается |
| Chevrolet Colorado | не допускается |
| Chevrolet Cruze | не допускается |
| Chevrolet Damas | не допускается |
| Chevrolet Epica | не допускается |
| Chevrolet Equinox | от 2021 |
| Chevrolet Evanda | не допускается |
| Chevrolet Groove | не допускается |
| Chevrolet HHR | не допускается |
| Chevrolet Impala | от 2018 |
| Chevrolet Kalos | не допускается |
| Chevrolet Lacetti | не допускается |
| Chevrolet Lanos | не допускается |
| Chevrolet Malibu | от 2021 |
| Chevrolet MATIZ | не допускается |
| Chevrolet Menlo | от 2023 |
| Chevrolet Monza | не допускается |
| Chevrolet MW | не допускается |
| Chevrolet Nexia | не допускается |
| Chevrolet Niva | не допускается |
| Chevrolet Nubira | не допускается |
| Chevrolet Onix | не допускается |
| Chevrolet Sonic | не допускается |
| Chevrolet Tahoe | не допускается |
| Chevrolet Tosca | не допускается |
| Chevrolet Tracker | не допускается |
| Chevrolet TrailBlazer | не допускается |
| Chevrolet Traverse | от 2018 |
| Chevrolet Trax | не допускается |
| Chevrolet Viva | не допускается |
| Chevrolet Volt | не допускается |
| Chrysler 200 | не допускается |
| Chrysler 300C | от 2018 |
| Chrysler 300M | не допускается |
| Chrysler Concorde | не допускается |
| Chrysler Neon | не допускается |
| Chrysler PT Cruiser | не допускается |
| Chrysler Sebring | не допускается |
| Chrysler Stratus | не допускается |
| Citroen C3 | не допускается |
| Citroen C4 | от 2024 |
| Citroen C4 Aircross | не допускается |
| Citroen C5 | не допускается |
| Citroen C-Crosser | не допускается |
| Citroen C-Elysee | не допускается |
| Citroen DS4 | не допускается |
| Citroen DS5 | не допускается |
| Citroen Xantia | не допускается |
| Citroen Xsara | не допускается |
| Daewoo Espero | не допускается |
| Daewoo Gentra | не допускается |
| Daewoo Kalos | не допускается |
| Daewoo Lacetti | не допускается |
| Daewoo Lanos | не допускается |
| Daewoo Leganza | не допускается |
| Daewoo Magnus | не допускается |
| Daewoo Nexia | не допускается |
| Daewoo Nubira | не допускается |
| Daewoo Prince | не допускается |
| Daewoo Racer | не допускается |
| Daewoo Sens | не допускается |
| Daewoo Tosca | не допускается |
| Daewoo Winstorm | не допускается |
| Daihatsu Altis | от 2018 |
| Daihatsu Boon | не допускается |
| Daihatsu Materia | не допускается |
| Daihatsu Sirion | не допускается |
| Daimler Sovereign (XJ6) | не допускается |
| Daimler X300 | не допускается |
| Daimler X308 | не допускается |
| Datsun mi-DO | не допускается |
| Datsun on-DO | не допускается |
| Dayun ES3 | не допускается |
| Denza D9 | от 2022 |
| Derways Aurora | не допускается |
| DFSK Glory 580 | от 2021 |
| DFSK Seres 3 | от 2023 |
| Dodge Avenger | не допускается |
| Dodge Caliber | не допускается |
| Dodge Charger | не допускается |
| Dodge Dart | не допускается |
| Dodge Durango | не допускается |
| Dodge Journey | от 2018 |
| Dodge Neon | не допускается |
| Dodge Nitro | не допускается |
| Dodge Stratus | не допускается |
| DongFeng 580 | от 2021 |
| DongFeng A30 | не допускается |
| DongFeng A60 | не допускается |
| DongFeng A9 | от 2018 |
| DongFeng Aeolus E70 | не допускается |
| DongFeng Aeolus Haoji | от 2022 |
| DongFeng Aeolus L7 | от 2024 |
| DongFeng Aeolus Yixuan GS | от 2023 |
| DongFeng Aeolus Yixuan Max | от 2024 |
| DongFeng AX7 | не допускается |
| DongFeng E1 | не допускается |
| DongFeng H30 Cross | не допускается |
| DongFeng S30 | не допускается |
| DongFeng S50 | от 2024 |
| DongFeng S50 EV | от 2024 |
| DongFeng S60 | не допускается |
| DongFeng Shine | от 2024 |
| DongFeng Shine Max | от 2023 |
| DongFeng T5 EVO | от 2023 |
| Enovate ME7 | от 2021 |
| Evolute I-joy | не допускается |
| Evolute I-pro | от 2024 |
| Evolute i-SKY | от 2023 |
| Evolute i-Space | от 2023 |
| EXEED LX | от 2023 |
| EXEED RX | от 2023 |
| EXEED TXL | от 2022 |
| EXEED VX | от 2021 |
| FAW Bestune B70 | от 2021 |
| FAW Bestune NAT | от 2023 |
| FAW Bestune T55 | от 2023 |
| FAW Bestune T77 | от 2023 |
| FAW Bestune T99 | от 2021 |
| FAW Besturn B50 | не допускается |
| FAW Besturn B70 | не допускается |
| FAW Besturn X40 | не допускается |
| FAW Besturn X80 | не допускается |
| FAW Oley | не допускается |
| FAW V2 | не допускается |
| FAW V5 | не допускается |
| FAW Vita | не допускается |
| FAW X80 | не допускается |
| Fiat Albea | не допускается |
| Fiat Brava | не допускается |
| Fiat Bravo | не допускается |
| Fiat Croma | не допускается |
| Fiat Linea | не допускается |
| Fiat Marea | не допускается |
| Fiat Palio | не допускается |
| Fiat Punto | не допускается |
| Fiat Stilo | не допускается |
| Fiat Tipo | от 2024 |
| Ford Contour | не допускается |
| Ford EcoSport | не допускается |
| Ford Edge | от 2021 |
| Ford Escape | от 2023 |
| Ford Escort | не допускается |
| Ford Expedition | не допускается |
| Ford Explorer | от 2018 |
| Ford F-150 | не допускается |
| Ford Festiva | не допускается |
| Ford Fiesta | не допускается |
| Ford Five Hundred | не допускается |
| Ford Focus | от 2024 |
| Ford Focus (North America) | не допускается |
| Ford Focus RS | не допускается |
| Ford Fusion | не допускается |
| Ford Fusion (North America) | не допускается |
| Ford Kuga | от 2023 |
| Ford Maverick | не допускается |
| Ford Mondeo | от 2021 |
| Ford Mustang | не допускается |
| Ford Mustang Mach-E | от 2021 |
| Ford Ranger | не допускается |
| Ford Scorpio | не допускается |
| Ford Sierra | не допускается |
| Ford Taurus | не допускается |
| Ford Territory | от 2023 |
| Forthing Yacht | от 2022 |
| Foton Tunland | не допускается |
| GAC Aion S | от 2024 |
| GAC Aion V | от 2023 |
| GAC Aion Y | не допускается |
| GAC GS3 | от 2024 |
| GAC GS5 | от 2021 |
| GAC GS8 | от 2018 |
| GAC Trumpchi Empow | от 2024 |
| GAC Trumpchi GS4 | от 2023 |
| GAC Trumpchi M6 | не допускается |
| GAC Trumpchi M8 | не допускается |
| Geely Atlas | от 2023 |
| Geely Atlas Pro | от 2023 |
| Geely Azkarra | от 2023 |
| Geely Boyue | от 2023 |
| Geely Boyue Cool | от 2023 |
| Geely Cityray | от 2024 |
| Geely CK (Otaka) | не допускается |
| Geely Coolray | не допускается |
| Geely Emgrand | от 2022 |
| Geely Emgrand 7 | не допускается |
| Geely Emgrand EC7 | не допускается |
| Geely Emgrand EC8 | не допускается |
| Geely Emgrand EV | от 2021 |
| Geely Emgrand GT | не допускается |
| Geely Emgrand L | от 2024 |
| Geely Emgrand X7 | не допускается |
| Geely FC (Vision) | не допускается |
| Geely Galaxy Starship 7 | от 2024 |
| Geely GC6 | не допускается |
| Geely GC9 | от 2021 |
| Geely Geometry A | от 2024 |
| Geely Geometry C | от 2023 |
| Geely Geometry E | не допускается |
| Geely GS | не допускается |
| Geely Jiaji | не допускается |
| Geely LC (Panda) Cross | не допускается |
| Geely MK | не допускается |
| Geely MK Cross | не допускается |
| Geely Monjaro | от 2021 |
| Geely Okavango | от 2021 |
| Geely Preface | от 2021 |
| Geely SC7 | не допускается |
| Geely Tugella | от 2023 |
| Geely TX4 | не допускается |
| Geely Xingyue | от 2023 |
| Geely Xingyue L | от 2021 |
| Genesis G70 | от 2021 |
| Genesis G80 | от 2018 |
| Genesis G90 | от 2018 |
| Great Wall Coolbear | не допускается |
| Great Wall Deer | не допускается |
| Great Wall Florid | не допускается |
| Great Wall Hover | не допускается |
| Great Wall Hover H3 | не допускается |
| Great Wall Hover H5 | не допускается |
| Great Wall Hover H6 | не допускается |
| Great Wall Hover M2 | не допускается |
| Great Wall Hover M4 | не допускается |
| Great Wall Poer | не допускается |
| Great Wall Safe | не допускается |
| Great Wall Voleex C30 | не допускается |
| Haima 2 | не допускается |
| Haima 3 | не допускается |
| Haima 7 | не допускается |
| Haima M3 | не допускается |
| Hanteng X7 | от 2021 |
| Haval Dargo | от 2023 |
| Haval F7 | от 2023 |
| Haval F7x | от 2023 |
| Haval H2 | не допускается |
| Haval H5 | не допускается |
| Haval H6 | от 2023 |
| Haval H8 | не допускается |
| Haval H9 | не допускается |
| Haval Jolion | от 2023 |
| Haval M6 | от 2023 |
| Haval Raptor | от 2023 |
| Hawtai Boliger | не допускается |
| Honda Accord | от 2021 |
| Honda Airwave | не допускается |
| Honda Avancier | от 2021 |
| Honda Civic | от 2024 |
| Honda Crider | от 2024 |
| Honda Crosstour | не допускается |
| Honda CR-V | не допускается |
| Honda Domani | не допускается |
| Honda e:NP1 | не допускается |
| Honda e:NP2 | от 2024 |
| Honda e:NS1 | не допускается |
| Honda Element | не допускается |
| Honda Envix | от 2024 |
| Honda Everus VE-1 | не допускается |
| Honda FCX Clarity | от 2021 |
| Honda Fit | не допускается |
| Honda Fit Aria | не допускается |
| Honda Fit Shuttle | не допускается |
| Honda Grace | не допускается |
| Honda HR-V | не допускается |
| Honda Insight | не допускается |
| Honda Inspire | от 2021 |
| Honda Integra | не допускается |
| Honda Integra SJ | не допускается |
| Honda Jade | не допускается |
| Honda Legend | от 2021 |
| Honda Logo | не допускается |
| Honda MDX | не допускается |
| Honda M-NV | не допускается |
| Honda Orthia | не допускается |
| Honda Partner | не допускается |
| Honda Passport | не допускается |
| Honda Pilot | от 2018 |
| Honda Ridgeline | не допускается |
| Honda Saber | не допускается |
| Honda Torneo | не допускается |
| Honda Vezel | не допускается |
| Honda X-NV | не допускается |
| Hongqi E-HS3 | от 2023 |
| Hongqi E-HS9 | от 2020 |
| Hongqi E-QM5 | от 2021 |
| Hongqi H5 | от 2021 |
| Hongqi H9 | от 2020 |
| Hongqi HQ9 | не допускается |
| Hongqi HS5 | от 2021 |
| Hozon Neta U | не допускается |
| HuangHai Antelope | не допускается |
| Hummer H3 | не допускается |
| Hycan A06 | от 2024 |
| Hyundai Accent | не допускается |
| Hyundai Alcazar | от 2023 |
| Hyundai Aslan | от 2018 |
| Hyundai Avante | от 2024 |
| Hyundai Azera | от 2018 |
| Hyundai Bayon | не допускается |
| Hyundai Casper | не допускается |
| Hyundai Celesta | не допускается |
| Hyundai Click | не допускается |
| Hyundai Creta | не допускается |
| Hyundai Custo | от 2023 |
| Hyundai Elantra | от 2024 |
| Hyundai Equus | от 2018 |
| Hyundai Genesis | не допускается |
| Hyundai Getz | не допускается |
| Hyundai Grandeur | от 2018 |
| Hyundai i20 | не допускается |
| Hyundai i30 | не допускается |
| Hyundai i40 | от 2021 |
| Hyundai IONIQ | не допускается |
| Hyundai IONIQ 5 | от 2023 |
| Hyundai IONIQ 6 | от 2022 |
| Hyundai ix20 | не допускается |
| Hyundai ix25 | не допускается |
| Hyundai ix35 | от 2023 |
| Hyundai ix55 | не допускается |
| Hyundai Kona | не допускается |
| Hyundai Kona Electric | не допускается |
| Hyundai Lafesta | не допускается |
| Hyundai Lantra | не допускается |
| Hyundai Mistra | от 2021 |
| Hyundai Mufasa | от 2023 |
| Hyundai Palisade | от 2018 |
| Hyundai Pony | не допускается |
| Hyundai Santa Fe | от 2021 |
| Hyundai Solaris | не допускается |
| Hyundai Sonata | от 2021 |
| Hyundai Terracan | не допускается |
| Hyundai Tiburon | не допускается |
| Hyundai Tucson | от 2023 |
| Hyundai Veloster | не допускается |
| Hyundai Venue | не допускается |
| Hyundai Veracruz | не допускается |
| Hyundai Verna | не допускается |
| Hyundai XG | не допускается |
| iCar 03 | от 2023 |
| Infiniti EX | не допускается |
| Infiniti FX | не допускается |
| Infiniti G | не допускается |
| Infiniti I | не допускается |
| Infiniti J | не допускается |
| Infiniti M | не допускается |
| Infiniti Q30 | не допускается |
| Infiniti Q50 | от 2021 |
| Infiniti Q70 | от 2018 |
| Infiniti QX30 | не допускается |
| Infiniti QX4 | не допускается |
| Infiniti QX50 | от 2021 |
| Infiniti QX56 | не допускается |
| Infiniti QX60 | от 2018 |
| Infiniti QX70 | не допускается |
| Infiniti QX80 | не допускается |
| Iran Khodro Runna | не допускается |
| Iran Khodro Samand | не допускается |
| Iran Khodro Soren | не допускается |
| Iran Khodro Tara | не допускается |
| Isuzu Aska | не допускается |
| Isuzu Axiom | не допускается |
| Isuzu Rodeo | не допускается |
| Isuzu Trooper | не допускается |
| JAC e-J7 | от 2022 |
| JAC iEV7S | не допускается |
| JAC J3 (Tagaz C10) | не допускается |
| JAC J5 (Heyue) | не допускается |
| JAC J7 | от 2021 |
| JAC J7 (Binyue) | не допускается |
| JAC J7 Plus | от 2024 |
| JAC JS3 | не допускается |
| JAC JS4 | не допускается |
| JAC JS5 | от 2023 |
| JAC JS6 | от 2023 |
| JAC JS8 | не допускается |
| JAC Refine M4 | не допускается |
| JAC S3 | не допускается |
| JAC S4 | не допускается |
| JAC S5 (Eagle) | не допускается |
| JAC S7 | от 2021 |
| JAC Sehol A5 Plus | от 2024 |
| JAC T6 | не допускается |
| Jaecoo J7 | от 2023 |
| Jaecoo J8 | от 2024 |
| Jaguar E-Pace | от 2023 |
| Jaguar F-Pace | от 2021 |
| Jaguar I-Pace | от 2021 |
| Jaguar S-Type | не допускается |
| Jaguar XE | от 2021 |
| Jaguar XF | от 2018 |
| Jaguar XJ | от 2018 |
| Jaguar X-Type | не допускается |
| Jeep Cherokee | не допускается |
| Jeep Commander | не допускается |
| Jeep Compass | от 2023 |
| Jeep Grand Cherokee | от 2018 |
| Jeep Liberty (North America) | не допускается |
| Jeep Liberty (Patriot) | не допускается |
| Jeep Renegade | не допускается |
| Jeep Wrangler | не допускается |
| Jetour Dashing | от 2023 |
| Jetour Shanhai L9 | от 2023 |
| Jetour T2 | от 2023 |
| Jetour X50 | не допускается |
| Jetour X70 | от 2023 |
| Jetour X70 PLUS | от 2022 |
| Jetour X90 | от 2021 |
| Jetour X90 PLUS | от 2022 |
| Jetour X95 | от 2021 |
| Jetta VA3 | не допускается |
| Jetta VS5 | от 2023 |
| Jetta VS7 | от 2021 |
| Kaiyi E5 | от 2024 |
| Kaiyi X3 | не допускается |
| Kaiyi X3 Pro | не допускается |
| Kaiyi X7 Kunlun | от 2023 |
| Karry K60 EV | от 2024 |
| Kia Cadenza | от 2018 |
| Kia Carnival | не допускается |
| Kia Cee'd | не допускается |
| Kia Cee'd SW | не допускается |
| Kia Cerato | от 2024 |
| Kia Clarus | не допускается |
| Kia EV5 | от 2023 |
| Kia EV6 | от 2021 |
| Kia Forte | от 2024 |
| Kia K3 | от 2024 |
| Kia K5 | от 2021 |
| Kia K7 | от 2018 |
| Kia K8 | от 2021 |
| Kia K9 | от 2018 |
| Kia K900 | от 2018 |
| Kia KX1 | не допускается |
| Kia Lotze | не допускается |
| Kia Magentis | не допускается |
| Kia Mohave (Borrego) | не допускается |
| Kia Niro | от 2023 |
| Kia Opirus | не допускается |
| Kia Optima | не допускается |
| Kia Pegas | не допускается |
| Kia Pride | не допускается |
| Kia ProCeed | не допускается |
| Kia Quoris | от 2018 |
| Kia Rio | не допускается |
| Kia Seltos | не допускается |
| Kia Shuma | не допускается |
| Kia Sorento | от 2021 |
| Kia Soul | не допускается |
| Kia Soul EV | не допускается |
| Kia Spectra | не допускается |
| Kia Sportage | от 2023 |
| Kia Stinger | от 2021 |
| Kia Stonic | не допускается |
| Kia XCeed | от 2023 |
| LADA (ВАЗ) 2105 | не допускается |
| LADA (ВАЗ) 2106 | не допускается |
| LADA (ВАЗ) 2107 | не допускается |
| LADA (ВАЗ) 2109 | не допускается |
| LADA (ВАЗ) 21099 | не допускается |
| LADA (ВАЗ) 2110 | не допускается |
| LADA (ВАЗ) 2111 | не допускается |
| LADA (ВАЗ) 2112 | не допускается |
| LADA (ВАЗ) 2113 | не допускается |
| LADA (ВАЗ) 2114 | не допускается |
| LADA (ВАЗ) 2115 | не допускается |
| LADA (ВАЗ) 2121 (4x4) | не допускается |
| LADA (ВАЗ) 2129 | не допускается |
| LADA (ВАЗ) 2131 (4x4) | не допускается |
| LADA (ВАЗ) Granta | не допускается |
| LADA (ВАЗ) Kalina | не допускается |
| LADA (ВАЗ) Largus | не допускается |
| LADA (ВАЗ) Niva Travel | не допускается |
| LADA (ВАЗ) Priora | не допускается |
| LADA (ВАЗ) Vesta | не допускается |
| LADA (ВАЗ) XRAY | не допускается |
| Lancia Lybra | не допускается |
| Land Rover Discovery | от 2018 |
| Land Rover Discovery Sport | от 2021 |
| Land Rover Freelander | не допускается |
| Land Rover Range Rover | от 2018 |
| Land Rover Range Rover Evoque | от 2023 |
| Land Rover Range Rover Sport | от 2018 |
| Land Rover Range Rover Velar | от 2021 |
| Leapmotor C01 | от 2022 |
| Leapmotor C11 | от 2021 |
| Leapmotor T03 | не допускается |
| Levdeo i3 | не допускается |
| Lexus CT | не допускается |
| Lexus ES | от 2018 |
| Lexus GS | от 2018 |
| Lexus GX | от 2018 |
| Lexus HS | не допускается |
| Lexus IS | от 2021 |
| Lexus LC | не допускается |
| Lexus LS | от 2018 |
| Lexus LX | от 2018 |
| Lexus NX | от 2021 |
| Lexus RX | от 2018 |
| Lifan Breez (520) | не допускается |
| Lifan Cebrium (720) | не допускается |
| Lifan Celliya (530) | не допускается |
| Lifan Murman | не допускается |
| Lifan Myway | не допускается |
| Lifan Solano | не допускается |
| Lifan X50 | не допускается |
| Lifan X60 | не допускается |
| Lifan X70 | не допускается |
| Lincoln Continental | не допускается |
| Lincoln MKZ | от 2018 |
| Lincoln Nautilus | от 2021 |
| Lincoln Navigator | не допускается |
| Livan S6 Pro | от 2024 |
| Livan X3 Pro | не допускается |
| Livan X6 Pro | от 2023 |
| LiXiang L6 | от 2024 |
| LiXiang L7 | от 2023 |
| LiXiang L8 | от 2022 |
| LiXiang L9 | от 2022 |
| Lynk & Co 01 | от 2023 |
| Lynk & Co 02 | от 2023 |
| Lynk&Co 06 | не допускается |
| Lynk&Co 08 | от 2023 |
| Maxus D90 | от 2023 |
| MAXUS G50 | не допускается |
| Mazda 2 | не допускается |
| Mazda 3 | не допускается |
| Mazda 323 | не допускается |
| Mazda 6 | от 2021 |
| Mazda 626 | не допускается |
| Mazda 929 | не допускается |
| Mazda Atenza | от 2021 |
| Mazda Axela | не допускается |
| Mazda Capella | не допускается |
| Mazda Cronos | не допускается |
| Mazda CX-3 | не допускается |
| Mazda CX-30 | от 2023 |
| Mazda CX-4 | от 2023 |
| Mazda CX-5 | от 2023 |
| Mazda CX-50 | от 2023 |
| Mazda CX-7 | не допускается |
| Mazda CX-9 | от 2018 |
| Mazda Demio | не допускается |
| Mazda Familia | не допускается |
| Mazda Millenia | не допускается |
| Mazda Protege | не допускается |
| Mazda Tribute | не допускается |
| Mazda Verisa | не допускается |
| Mazda Xedos 6 | не допускается |
| Mazda Xedos 9 | не допускается |
| Mercedes-Benz 190 (W201) | не допускается |
| Mercedes-Benz A-klasse | от 2024 |
| Mercedes-Benz A-klasse AMG | не допускается |
| Mercedes-Benz B-klasse | не допускается |
| Mercedes-Benz C-klasse | от 2021 |
| Mercedes-Benz C-klasse AMG | от 2021 |
| Mercedes-Benz CLA-klasse | не допускается |
| Mercedes-Benz CLA-klasse AMG | не допускается |
| Mercedes-Benz CLC-klasse | не допускается |
| Mercedes-Benz CLK-klasse | не допускается |
| Mercedes-Benz CL-klasse | не допускается |
| Mercedes-Benz CLS-klasse | от 2018 |
| Mercedes-Benz CLS-klasse AMG | от 2018 |
| Mercedes-Benz E-klasse | от 2018 |
| Mercedes-Benz E-klasse AMG | от 2018 |
| Mercedes-Benz EQS | от 2021 |
| Mercedes-Benz G-klasse | от 2018 |
| Mercedes-Benz G-klasse AMG | от 2018 |
| Mercedes-Benz GLA-klasse | от 2023 |
| Mercedes-Benz GLB-klasse | от 2023 |
| Mercedes-Benz GLC | от 2021 |
| Mercedes-Benz GLC Coupe | от 2021 |
| Mercedes-Benz GLE | от 2018 |
| Mercedes-Benz GLK-klasse | не допускается |
| Mercedes-Benz GL-klasse | не допускается |
| Mercedes-Benz GLS-klasse | от 2018 |
| Mercedes-Benz Maybach S-klasse | от 2017 |
| Mercedes-Benz M-klasse | не допускается |
| Mercedes-Benz M-klasse AMG | не допускается |
| Mercedes-Benz S-klasse | от 2017 |
| Mercedes-Benz S-klasse AMG | от 2017 |
| Mercedes-Benz SL-klasse | не допускается |
| Mercedes-Benz W124 | не допускается |
| Mercedes-Benz X-klasse | не допускается |
| Mercury Mariner | не допускается |
| MG 3 | не допускается |
| MG 350 | не допускается |
| MG 5 | от 2024 |
| MG 6 | от 2021 |
| MG GS | не допускается |
| MG ZS | не допускается |
| MG ZS EV | не допускается |
| MINI Countryman | не допускается |
| MINI Coupe | не допускается |
| MINI Hatch | не допускается |
| Mitsubishi Airtrek | не допускается |
| Mitsubishi Aspire | не допускается |
| Mitsubishi ASX | не допускается |
| Mitsubishi Attrage | не допускается |
| Mitsubishi Carisma | не допускается |
| Mitsubishi Challenger | не допускается |
| Mitsubishi Colt | не допускается |
| Mitsubishi Diamante | не допускается |
| Mitsubishi Eclipse Cross | от 2023 |
| Mitsubishi Endeavor | не допускается |
| Mitsubishi Galant | не допускается |
| Mitsubishi Galant Fortis | не допускается |
| Mitsubishi L200 | не допускается |
| Mitsubishi Lancer | не допускается |
| Mitsubishi Lancer Cargo | не допускается |
| Mitsubishi Lancer Evolution | не допускается |
| Mitsubishi Lancer Ralliart | от 2024 |
| Mitsubishi Legnum | не допускается |
| Mitsubishi Libero | не допускается |
| Mitsubishi Mirage | не допускается |
| Mitsubishi Montero | не допускается |
| Mitsubishi Montero Sport | не допускается |
| Mitsubishi Outlander | от 2021 |
| Mitsubishi Pajero | не допускается |
| Mitsubishi Pajero Sport | не допускается |
| Mitsubishi Sigma | не допускается |
| Mitsubishi Xpander | от 2024 |
| Mobilize Limo | от 2021 |
| Neta S | от 2022 |
| Neta U Pro | не допускается |
| Neta V | от 2023 |
| Neta X | от 2023 |
| Nevo A05 | от 2023 |
| Nevo Q05 | от 2023 |
| Nissan AD | от 2024 |
| Nissan Almera | не допускается |
| Nissan Almera Classic | не допускается |
| Nissan Altima | от 2021 |
| Nissan Armada | не допускается |
| Nissan Avenir | не допускается |
| Nissan Bluebird | не допускается |
| Nissan Bluebird Sylphy | не допускается |
| Nissan Cedric | не допускается |
| Nissan Cefiro | не допускается |
| Nissan Datsun | не допускается |
| Nissan Dualis | не допускается |
| Nissan Expert | не допускается |
| Nissan Fuga | от 2018 |
| Nissan Gloria | не допускается |
| Nissan Juke | не допускается |
| Nissan Kicks | не допускается |
| Nissan Latio | не допускается |
| Nissan Laurel | не допускается |
| Nissan Leaf | не допускается |
| Nissan March | не допускается |
| Nissan Maxima | от 2021 |
| Nissan Murano | от 2018 |
| Nissan Note | не допускается |
| Nissan Pathfinder | от 2018 |
| Nissan Patrol | не допускается |
| Nissan Presea | не допускается |
| Nissan Primera | не допускается |
| Nissan Pulsar | не допускается |
| Nissan Qashqai | от 2023 |
| Nissan Qashqai+2 | не допускается |
| Nissan R'nessa | не допускается |
| Nissan Rogue | от 2021 |
| Nissan Safari | не допускается |
| Nissan Sentra | от 2024 |
| Nissan Skyline | от 2021 |
| Nissan Skyline Crossover | не допускается |
| Nissan Stagea | не допускается |
| Nissan Sunny | не допускается |
| Nissan Sylphy | от 2024 |
| Nissan Teana | не допускается |
| Nissan Terrano | не допускается |
| Nissan Tiida | от 2024 |
| Nissan Titan | не допускается |
| Nissan Versa | не допускается |
| Nissan Wingroad | не допускается |
| Nissan Xterra | не допускается |
| Nissan X-Trail | от 2021 |
| Omoda C5 | от 2023 |
| Omoda S5 | от 2024 |
| Omoda S5 GT | от 2024 |
| Opel Antara | не допускается |
| Opel Astra | не допускается |
| Opel Corsa | не допускается |
| Opel Frontera | не допускается |
| Opel Insignia | от 2021 |
| Opel Mokka | не допускается |
| Opel Omega | не допускается |
| Opel Signum | не допускается |
| Opel Vectra | не допускается |
| Opel Vita | не допускается |
| Opel Zafira OPC | не допускается |
| Ora iQ | не допускается |
| Oshan X5 | от 2023 |
| Oshan X5 Plus | от 2023 |
| Oshan X7 | от 2021 |
| Oshan X7 Plus | от 2021 |
| Oshan Z6 | от 2022 |
| Peugeot 1007 | не допускается |
| Peugeot 2008 | не допускается |
| Peugeot 205 | не допускается |
| Peugeot 206 | не допускается |
| Peugeot 207 | не допускается |
| Peugeot 208 | не допускается |
| Peugeot 3008 | от 2023 |
| Peugeot 301 | не допускается |
| Peugeot 306 | не допускается |
| Peugeot 307 | не допускается |
| Peugeot 308 | не допускается |
| Peugeot 4007 | не допускается |
| Peugeot 4008 | от 2023 |
| Peugeot 405 | не допускается |
| Peugeot 406 | не допускается |
| Peugeot 407 | не допускается |
| Peugeot 408 | от 2024 |
| Peugeot 5008 | не допускается |
| Peugeot 508 | от 2021 |
| Peugeot 605 | не допускается |
| Peugeot 607 | не допускается |
| Peugeot Pars | от 2021 |
| Polestar 2 | от 2021 |
| Pontiac Grand Prix | не допускается |
| Porsche Cayenne | от 2018 |
| Porsche Taycan | от 2019 |
| Qiyuan A06 | от 2024 |
| Ravon Gentra | не допускается |
| Ravon Nexia R3 | не допускается |
| Ravon R4 | не допускается |
| Renault 19 | не допускается |
| Renault 21 | не допускается |
| Renault 4 | не допускается |
| Renault Arkana | от 2023 |
| Renault Captur | не допускается |
| Renault Clio | не допускается |
| Renault Duster | не допускается |
| Renault Fluence | не допускается |
| Renault Kadjar | не допускается |
| Renault Kaptur | не допускается |
| Renault Koleos | от 2021 |
| Renault Laguna | не допускается |
| Renault Latitude | не допускается |
| Renault Logan | не допускается |
| Renault Logan Stepway | не допускается |
| Renault Megane | от 2024 |
| Renault Safrane | не допускается |
| Renault Samsung QM5 | не допускается |
| Renault Samsung QM6 | от 2021 |
| Renault Samsung SM3 | не допускается |
| Renault Samsung SM5 | не допускается |
| Renault Samsung SM6 | от 2021 |
| Renault Samsung SM7 | от 2018 |
| Renault Samsung XM3 | от 2023 |
| Renault Sandero | не допускается |
| Renault Symbol | не допускается |
| Renault Talisman | от 2021 |
| Renault Vel Satis | не допускается |
| Roewe D7 | от 2023 |
| Rolls-Royce Cullinan | от 2018 |
| Rolls-Royce Ghost | от 2018 |
| Rolls-Royce Phantom | от 2018 |
| Rover 400 | не допускается |
| Rover 45 | не допускается |
| Rover 600 | не допускается |
| Rover 75 | не допускается |
| Saab 9-3 | не допускается |
| Saab 9-5 | не допускается |
| Saturn Astra | не допускается |
| Saturn Aura | не допускается |
| Saturn ION | не допускается |
| Saturn VUE | не допускается |
| Scion tC | не допускается |
| Scion xA | не допускается |
| Scion xD | не допускается |
| SEAT Cordoba | не допускается |
| SEAT Ibiza | не допускается |
| SEAT Leon | от 2024 |
| SEAT Toledo | не допускается |
| ShuangHuan Sceo | не допускается |
| Skoda Fabia | не допускается |
| Skoda Felicia | не допускается |
| Skoda Kamiq | не допускается |
| Skoda Karoq | от 2023 |
| Skoda Kodiaq | от 2021 |
| Skoda Octavia | от 2024 |
| Skoda Rapid | не допускается |
| Skoda Superb | от 2021 |
| Skoda Yeti | не допускается |
| Skywell ET5 | от 2021 |
| Skywell HT-i | от 2022 |
| Soueast DX8S | от 2022 |
| Soueast S07 | от 2022 |
| Spyker C8 | не допускается |
| SsangYong Actyon | не допускается |
| SsangYong Actyon Sports | не допускается |
| SsangYong Chairman | не допускается |
| SsangYong Kyron | не допускается |
| SsangYong Musso | не допускается |
| SsangYong Nomad | не допускается |
| SsangYong Rexton | не допускается |
| SsangYong Tivoli | не допускается |
| Subaru Crosstrek | от 2023 |
| Subaru Forester | от 2021 |
| Subaru Impreza | от 2024 |
| Subaru Legacy | от 2021 |
| Subaru Levorg | от 2021 |
| Subaru Outback | от 2021 |
| Subaru Trezia | не допускается |
| Subaru Tribeca | не допускается |
| Subaru XV | от 2023 |
| Suzuki Aerio | не допускается |
| Suzuki Baleno | не допускается |
| Suzuki Cultus | не допускается |
| Suzuki Dzire | не допускается |
| Suzuki Escudo | не допускается |
| Suzuki Grand Vitara | не допускается |
| Suzuki Ignis | не допускается |
| Suzuki Kizashi | не допускается |
| Suzuki Liana | не допускается |
| Suzuki Swift | не допускается |
| Suzuki SX4 | не допускается |
| Suzuki Vitara | не допускается |
| Suzuki XL7 | не допускается |
| SWM G01 | от 2023 |
| SWM G05 | не допускается |
| Tank 300 | не допускается |
| Tank 500 | не допускается |
| Tesla Model 3 | от 2021 |
| Tesla Model S | от 2018 |
| Tesla Model X | от 2018 |
| Tesla Model Y | от 2021 |
| Tofas Sahin | не допускается |
| Toyota 4Runner | от 2018 |
| Toyota Agya | не допускается |
| Toyota Allex | не допускается |
| Toyota Allion | не допускается |
| Toyota Alphard | не допускается |
| Toyota Altezza | не допускается |
| Toyota Aqua | не допускается |
| Toyota Aristo | не допускается |
| Toyota Aurion | не допускается |
| Toyota Auris | не допускается |
| Toyota Avalon | от 2018 |
| Toyota Avensis | не допускается |
| Toyota Belta | не допускается |
| Toyota Blade | не допускается |
| Toyota Brevis | не допускается |
| Toyota bZ3 | от 2024 |
| Toyota bZ3X | от 2025 |
| Toyota bZ4X | от 2022 |
| Toyota Caldina | не допускается |
| Toyota Cami | не допускается |
| Toyota Camry | от 2021 |
| Toyota Camry Solara | не допускается |
| Toyota Carina | не допускается |
| Toyota Carina ED | не допускается |
| Toyota Celica | не допускается |
| Toyota Celsior | не допускается |
| Toyota Chaser | не допускается |
| Toyota C-HR | не допускается |
| Toyota Corolla | не допускается |
| Toyota Corolla Axio | не допускается |
| Toyota Corolla Cross | от 2023 |
| Toyota Corolla Fielder | не допускается |
| Toyota Corolla Rumion | не допускается |
| Toyota Corona | не допускается |
| Toyota Corsa | не допускается |
| Toyota Cresta | не допускается |
| Toyota Crown | от 2018 |
| Toyota Cynos | не допускается |
| Toyota Duet | не допускается |
| Toyota Echo | не допускается |
| Toyota Fortuner | от 2018 |
| Toyota Harrier | от 2021 |
| Toyota Highlander | от 2018 |
| Toyota Hilux | не допускается |
| Toyota Hilux Surf | не допускается |
| Toyota Ist | не допускается |
| Toyota Kluger | не допускается |
| Toyota Land Cruiser | от 2018 |
| Toyota Land Cruiser Prado | от 2018 |
| Toyota Levin | не допускается |
| Toyota Mark II | не допускается |
| Toyota Mark X | не допускается |
| Toyota Opa | не допускается |
| Toyota Platz | не допускается |
| Toyota Premio | не допускается |
| Toyota Prius | от 2024 |
| Toyota Prius c | не допускается |
| Toyota Probox | от 2024 |
| Toyota Progres | не допускается |
| Toyota Pronard | не допускается |
| Toyota Raize | не допускается |
| Toyota RAV 4 | от 2023 |
| Toyota Rush | не допускается |
| Toyota Sai | не допускается |
| Toyota Scepter | не допускается |
| Toyota Scion | не допускается |
| Toyota Sequoia | не допускается |
| Toyota Sprinter | не допускается |
| Toyota Sprinter Carib | не допускается |
| Toyota Sprinter Marino | не допускается |
| Toyota Starlet | не допускается |
| Toyota Succeed | не допускается |
| Toyota Tacoma | не допускается |
| Toyota Vanguard | не допускается |
| Toyota Veloz | не допускается |
| Toyota Venza | от 2021 |
| Toyota Verossa | не допускается |
| Toyota Vios | не допускается |
| Toyota Vista | не допускается |
| Toyota Vitz | не допускается |
| Toyota Voltz | не допускается |
| Toyota Wigo | не допускается |
| Toyota WiLL | не допускается |
| Toyota Windom | не допускается |
| Toyota Yaris | не допускается |
| Vauxhall Astra | не допускается |
| Vauxhall Vectra | не допускается |
| Venucia D60 | от 2024 |
| Venucia D60 EV | от 2024 |
| Venucia V-Online | от 2023 |
| VGV VX7 | не допускается |
| Volkswagen Arteon | от 2021 |
| Volkswagen Beetle | не допускается |
| Volkswagen Bora | от 2024 |
| Volkswagen e-Bora | от 2024 |
| Volkswagen Golf | от 2024 |
| Volkswagen ID.3 | от 2024 |
| Volkswagen ID.4 | от 2023 |
| Volkswagen ID.6 | от 2021 |
| Volkswagen Jetta | от 2024 |
| Volkswagen Lavida | от 2024 |
| Volkswagen Parati | не допускается |
| Volkswagen Passat | от 2021 |
| Volkswagen Passat (North America) | от 2021 |
| Volkswagen Passat CC | от 2021 |
| Volkswagen Phaeton | не допускается |
| Volkswagen Pointer | не допускается |
| Volkswagen Polo | не допускается |
| Volkswagen Tacqua | не допускается |
| Volkswagen Taos | от 2023 |
| Volkswagen Teramont | от 2018 |
| Volkswagen Tiguan | от 2023 |
| Volkswagen Touareg | от 2018 |
| Volkswagen T-Roc | не допускается |
| Volkswagen Vento | не допускается |
| Volvo 850 | не допускается |
| Volvo 940 | не допускается |
| Volvo S40 | не допускается |
| Volvo S60 | от 2021 |
| Volvo S70 | не допускается |
| Volvo S80 | не допускается |
| Volvo S90 | от 2018 |
| Volvo V40 | не допускается |
| Volvo V50 | не допускается |
| Volvo V60 | от 2021 |
| Volvo V60 Cross Country | от 2021 |
| Volvo V70 | не допускается |
| Volvo V90 | от 2018 |
| Volvo XC60 | от 2021 |
| Volvo XC70 | не допускается |
| Volvo XC90 | от 2018 |
| Vortex Corda | не допускается |
| Vortex Estina | не допускается |
| Vortex Tingo | не допускается |
| Voyah Dream | не допускается |
| Voyah Free | от 2021 |
| Voyah Passion | от 2022 |
| Weltmeister E5 | не допускается |
| Weltmeister EX5 | не допускается |
| Weltmeister W6 | от 2021 |
| Wuling Binguo | не допускается |
| Wuling Hongguang V | от 2024 |
| Wuling Starlight | от 2023 |
| Wuling Starlight S | от 2024 |
| Wuling Xingguang | не допускается |
| Xcite X-Cross 7 | от 2024 |
| Xpeng G3 | от 2023 |
| Xpeng P5 | от 2021 |
| Xpeng P7 | от 2021 |
| Yipai 007 | от 2024 |
| Yudo Pi1 | не допускается |
| Zeekr 001 | от 2021 |
| Zeekr 007 | от 2023 |
| Zeekr 009 | от 2022 |
| Zeekr X | от 2023 |
| Zotye Coupa | от 2021 |
| Zotye T600 | от 2021 |
| ZX Landmark | не допускается |
| АмберАвто А5 | от 2023 |
| ГАЗ 3102 «Волга» | не допускается |
| ГАЗ 31029 «Волга» | не допускается |
| ГАЗ 31105 «Волга» | не допускается |
| ЗАЗ 1103 «Славута» | не допускается |
| ЗАЗ Forza | не допускается |
| ЗАЗ Sens | не допускается |
| ЗАЗ Vida | не допускается |
| Москвич 3 | не допускается |
| Москвич 6 | не допускается |
| УАЗ Patriot | не допускается |

$str$,
  'Список автомобилей и годов выпуска, подходящих для работы по тарифу Тариф «Комфорт+» в Алматы.',
  (SELECT id FROM categories WHERE slug = 'tariffs'),
  TRUE,
  150
);

INSERT INTO articles (title, slug, content, summary, category_id, published, views) VALUES
(
  'Тариф «Электро»',
  'auto-list-электро',
  $str$# Тариф «Электро»

[← Назад к общему списку](/articles/auto-list)

После 5 мая 2025 года тариф будет доступен только для электромобилей.

| Марка и модель | Требования |
| --- | --- |
| Arcfox Alpha S | от 2024 |
| Audi e-tron Sportback | от 2019 |
| BAIC EU5 | от 2022 |
| Baojun Yunduo | от 2023 |
| BYD Han | от 2020 |
| BYD Qin Plus | от 2022 |
| BYD Seal | от 2022 |
| BYD Song Plus | от 2024 |
| BYD Yuan Plus | от 2021 |
| Changan Eado EV | от 2018 |
| Chery eQ5 | от 2020 |
| Chevrolet Menlo | от 2022 |
| FAW Bestune NAT | от 2021 |
| GAC Aion S | от 2022 |
| Hongqi E-QM5 | от 2021 |
| Hyundai IONIQ 5 | от 2022 |
| Kia EV6 | от 2021 |
| Mitsubishi Airtrek | от 2021 |
| Neta X | от 2023 |
| Tesla Model 3 | от 2018 |
| Tesla Model S | от 2018 |
| Tesla Model Y | от 2020 |
| Toyota bZ3 | от 2023 |
| Toyota bZ4X | от 2022 |
| Volkswagen e-Bora | от 2021 |
| Volkswagen ID.4 | от 2022 |
| Volkswagen ID.6 | от 2021 |
| Xpeng G9 | от 2022 |
| Zeekr 001 | от 2021 |
| Zeekr 007 | от 2023 |
| Zeekr X | от 2023 |

$str$,
  'Список автомобилей и годов выпуска, подходящих для работы по тарифу Тариф «Электро» в Алматы.',
  (SELECT id FROM categories WHERE slug = 'tariffs'),
  TRUE,
  150
);

INSERT INTO articles (title, slug, content, summary, category_id, published, views) VALUES
(
  'Тариф «Бизнес»',
  'auto-list-бизнес',
  $str$# Тариф «Бизнес»

[← Назад к общему списку](/articles/auto-list)

<h3 style="text-align: start">**Общие требования**</h3>**Цвет автомобиля:**

* чёрный,

* близкий к чёрному (тёмно-синий, тёмно-серый, тёмно-коричневый или тёмно-зелёный),

* белый,

* двухцветный вдоль линии остекления  (черный или близкий к черному низ и белый верх).

**Модель:** подходят только машины, у которых не менее 3 пассажирских мест, 4 двери. Не допускаются автомобили: с типом кузова универсал, хэтчбек, а также с правым расположением руля.

**Без брендирования.**

**Салон**: обивка из кожи, заменителя кожи или комбинированная отделка (кожа+ткань). В автомобиле на заднем диване обязательно должен быть подлокотник, который всегда разложен.

**В салоне должны быть**: зарядные устройства для Android и iOS (в том числе Type-C), зонт, бутылка воды для каждого пассажира.

После 31 января 2023 года подключить к тарифу можно только автомобили без ГБО.

| Марка и модель | Требования |
| --- | --- |
| Audi A6 | от 2020 |
| Audi A8 | от 2018 |
| Audi Q7 | от 2020 |
| Audi S8 | от 2020 |
| Bentley Flying Spur | от 2020 |
| BMW 5er | от 2020 |
| BMW 7er | от 2019 |
| BMW X5 | от 2020 |
| BMW X6 | от 2020 |
| BYD Han | от 2021 |
| BYD Seal | от 2023 |
| Changan Deepal S09 | от 2024 |
| Chery Arrizo 8 | от 2023 |
| Denza D9 | от 2022 |
| FAW Bestune B70 | от 2023 |
| Genesis G70 | от 2023 |
| Genesis G80 | от 2020 |
| Genesis G90 | от 2020 |
| Genesis GV80 | от 2020 |
| Hongqi E-QM5 | от 2021 |
| Hongqi H5 | от 2023 |
| Hongqi H9 | от 2020 |
| Hyundai Grandeur | от 2020 |
| Hyundai Sonata | от 2023 |
| Jaguar XF | от 2020 |
| Kia Cadenza | от 2020 |
| Kia K5 | от 2023 |
| Kia K7 | от 2020 |
| Kia K8 | от 2021 |
| Kia K9 | от 2019 |
| Lexus ES | от 2020 |
| Lexus GS | от 2020 |
| Lexus LS | от 2020 |
| LiXiang L7 | от 2023 |
| LiXiang L8 | от 2022 |
| LiXiang L9 | от 2022 |
| Mercedes-Benz E-klasse | от 2020 |
| Mercedes-Benz E-klasse AMG | от 2020 |
| Mercedes-Benz GLE | от 2020 |
| Mercedes-Benz Maybach S-klasse | от 2017 |
| Mercedes-Benz S-klasse | от 2017 |
| Mercedes-Benz S-klasse AMG | от 2017 |
| Roewe M7 | от 2025 |
| Rolls-Royce Cullinan | от 2020 |
| Rolls-Royce Ghost | от 2020 |
| Rolls-Royce Phantom | от 2020 |
| Seres Aito M9 | от 2023 |
| Skoda Superb | от 2023 |
| Tesla Model 3 | от 2023 |
| Tesla Model Y | от 2023 |
| Toyota Avalon | от 2020 |
| Toyota Camry | от 2023 |
| Yipai 007 | от 2024 |
| Zeekr 001 | от 2022 |
| Zeekr 007 | от 2023 |
| Zeekr 009 | от 2022 |

$str$,
  'Список автомобилей и годов выпуска, подходящих для работы по тарифу Тариф «Бизнес» в Алматы.',
  (SELECT id FROM categories WHERE slug = 'tariffs'),
  TRUE,
  150
);

INSERT INTO articles (title, slug, content, summary, category_id, published, views) VALUES
(
  'Тариф «Ultima: тариф Premier»',
  'auto-list-ultima-тариф-premier',
  $str$# Тариф «Ultima: тариф Premier»

[← Назад к общему списку](/articles/auto-list)

<h3>Общие требования</h3>**Цвет автомобиля**:

* чёрный.

**Модель:** подходят только машины, у которых не менее 4 мест, 4 двери или больше за исключением автомобилей с типом кузова универсал или хэтчбек. Не допускаются автомобили, с правым расположением руля

**Без брендирования.**

**Салон**: обивка из заменителя кожи или натуральной кожи. В автомобиле на заднем диване обязательно должен быть подлокотник, который всегда разложен.

**В салоне должны быть**: зарядные устройства для Android и iOS (в том числе Type-C), зонт, бутылка воды для каждого пассажира.

| Модель | Год выпуска |
| --- | --- |
| Audi A8 | от 2018 |
| BMW 7er | от 2019 |
| BYD Han | от 2022 (только комплектации с сидениями, не в спортивном стиле) |
| Changan Deepal S09 | от 2024 |
| Denza D9 | от 2022 |
| Genesis G80 | от 2021 |
| Genesis G90 | от 2021 |
| Genesis GV80 | от 2020 |
| Hongqi H5 | от 2023 |
| Hongqi H9 | от 2020 |
| Hyundai Grandeur | от 2023 |
| Kia K8 | от 2021 |
| Kia K9 | от 2019 |
| Leapmotor C16 | от 2024 |
| LiXiang L7 | от 2023 |
| LiXiang L8 | от 2022 |
| LiXiang L9 | от 2022 |
| Mercedes-Benz Maybach S-klasse | от 2017 |
| Mercedes-Benz S-klasse | от 2017 |
| Mercedes-Benz S-klasse AMG | от 2017 |
| Seres Aito M9 | от 2023 |
| Zeekr 009 | от 2022 |

Автомобили для работы в тарифе доступны в таксопарках:

* парк Business Cars, адрес: Алматы, Булкушева 4е лит В, тел.: +77019113456, ⁠+77763565158

* парк Concierge Taxi, адрес: Алматы, Пензенская 11, тел.: +77005000121

* парк Underground, тел.: +77001631919

* парк Апекс Авто, адрес: Алматы, Рахмадиева 2/1, тел.: +7 775 287 15 73

$str$,
  'Список автомобилей и годов выпуска, подходящих для работы по тарифу Тариф «Ultima: тариф Premier» в Алматы.',
  (SELECT id FROM categories WHERE slug = 'tariffs'),
  TRUE,
  150
);

