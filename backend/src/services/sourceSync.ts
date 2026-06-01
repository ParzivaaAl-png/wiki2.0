import axios from 'axios';
import * as cheerio from 'cheerio';
import { query, pool } from '../config/db';
import * as msService from './meilisearch';
import * as ArticleModel from '../models/article';

// Dict mapping Accordion titles to DB slugs
const TARIFF_SLUG_MAP: Record<string, string> = {
  'Тариф «Эконом»': 'auto-list-эконом',
  'Тариф «Межгород»': 'auto-list-межгород',
  'Тариф «Комфорт»': 'auto-list-комфорт',
  'Тариф «Комфорт+»': 'auto-list-комфорт-plus',
  'Тариф «Электро»': 'auto-list-электро',
  'Тариф «Бизнес»': 'auto-list-бизнес',
  'Тариф «Ultima: тариф Premier»': 'auto-list-ultima-тариф-premier',
};

// Dict mapping Accordion titles to classifier keys used by the UI
const TARIFF_KEY_MAP: Record<string, string> = {
  'Тариф «Эконом»': 'econom',
  'Тариф «Межгород»': 'intercity',
  'Тариф «Комфорт»': 'comfort',
  'Тариф «Комфорт+»': 'comfort_plus',
  'Тариф «Электро»': 'electro',
  'Тариф «Бизнес»': 'business',
  'Тариф «Ultima: тариф Premier»': 'ultima',
};

const MULTI_WORD_BRANDS = [
  'Mercedes-Benz', 'Land Rover', 'Iran Khodro', 'Lada (VAZ)',
  'Great Wall', 'Alfa Romeo', 'Aston Martin', 'DongFeng',
  'Belgee', 'Rolls-Royce', 'BMW Alpina', 'Dodge Ram',
  'Fiat Professional', 'Ford Commercial', 'GAZ Commercial',
  'HAIMA', 'Hyundai Commercial', 'Iveco', 'Kia Commercial',
  'Mercedes-Benz Commercial', 'Nissan Commercial', 'Opel Commercial',
  'Peugeot Commercial', 'Renault Commercial', 'Seres Aito',
  'Skywell', 'SsangYong', 'Volkswagen Commercial', 'AmberAuto',
  'АмберАвто', 'ГАЗ', 'Москвич'
];

interface CarRow {
  model: string;
  requirement: string;
}

interface CarRequirement {
  brand: string;
  model: string;
  years: Record<string, number>;
  warnings?: Record<string, string>;
}

// Convert Yandex Pro HTML text blocks to Markdown
function htmlToMarkdown(html: string): string {
  if (!html) return '';
  let md = html
    .replace(/&nbsp;/g, ' ')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–');
    
  md = md.replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, (match, content) => `### ${content}\n\n`);
  
  md = md.replace(/<ul[^>]*>/gi, '\n')
         .replace(/<\/ul>/gi, '\n')
         .replace(/<ol[^>]*>/gi, '\n')
         .replace(/<\/ol>/gi, '\n')
         .replace(/<li[^>]*>(.*?)<\/li>/gi, '* $1\n');
         
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
         .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
         .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
         .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
         
  md = md.replace(/<a[^>]*href=["'](.*?)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)');
  
  md = md.replace(/<p[^>]*>/gi, '')
         .replace(/<\/p>/gi, '\n\n')
         .replace(/<br\s*\/?>/gi, '\n');
         
  md = md.replace(/<[^>]*>/g, '');
  
  return md.trim();
}

// Split full car name into Brand and Model
function splitBrandAndModel(fullName: string): { brand: string; model: string } {
  const name = fullName.trim();
  for (const b of MULTI_WORD_BRANDS) {
    if (name.toLowerCase().startsWith(b.toLowerCase())) {
      return {
        brand: b,
        model: name.substring(b.length).trim()
      };
    }
  }
  
  const firstSpace = name.indexOf(' ');
  if (firstSpace === -1) {
    return { brand: name, model: '' };
  }
  return {
    brand: name.substring(0, firstSpace).trim(),
    model: name.substring(firstSpace + 1).trim()
  };
}

// Parse markdown table rows back to objects for comparison
function parseMarkdownTable(content: string): CarRow[] {
  const rows: CarRow[] = [];
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed.startsWith('|') &&
      !trimmed.includes('---') &&
      !trimmed.toLowerCase().includes('марка и модель') &&
      !trimmed.toLowerCase().includes('требования') &&
      !trimmed.toLowerCase().includes('модель')
    ) {
      const parts = trimmed.split('|').map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        rows.push({ model: parts[0], requirement: parts[1] });
      }
    }
  }
  return rows;
}

// Compare two tables and return changes summary
function compareCarTables(oldContent: string, newContent: string) {
  const oldRows = parseMarkdownTable(oldContent);
  const newRows = parseMarkdownTable(newContent);
  
  const oldMap = new Map(oldRows.map(r => [r.model.toLowerCase(), r]));
  const newMap = new Map(newRows.map(r => [r.model.toLowerCase(), r]));
  
  const added: string[] = [];
  const removed: string[] = [];
  const updated: string[] = [];
  
  for (const [key, newRow] of newMap.entries()) {
    const oldRow = oldMap.get(key);
    if (!oldRow) {
      added.push(`${newRow.model} (${newRow.requirement})`);
    } else if (oldRow.requirement !== newRow.requirement) {
      updated.push(`${newRow.model}: ${oldRow.requirement} -> ${newRow.requirement}`);
    }
  }
  
  for (const [key, oldRow] of oldMap.entries()) {
    if (!newMap.has(key)) {
      removed.push(`${oldRow.model} (${oldRow.requirement})`);
    }
  }
  
  const changesCount = added.length + removed.length + updated.length;
  
  return {
    changesCount,
    changesSummary: { added, removed, updated }
  };
}

// Insert admin/editor notifications
async function createNotification(title: string, message: string, role: string, type = 'info') {
  try {
    await query(
      `INSERT INTO notifications (title, message, role, type) VALUES ($1, $2, $3, $4)`,
      [title, message, role, type]
    );
  } catch (err) {
    console.error('Failed to create in-app notification:', err);
  }
}

// Main sync logic
export async function syncArticle(articleId: number, options: { force?: boolean } = {}): Promise<void> {
  const artRes = await query('SELECT * FROM articles WHERE id = $1', [articleId]);
  if (artRes.rows.length === 0) {
    throw new Error(`Article with ID ${articleId} not found.`);
  }
  const mainArticle = artRes.rows[0];
  const sourceUrl = mainArticle.source_url;
  if (!sourceUrl) {
    throw new Error(`Article "${mainArticle.title}" does not have a Source URL configured.`);
  }

  console.log(`Fetching content from: ${sourceUrl}...`);
  let htmlContent = '';
  try {
    const response = await axios.get(sourceUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 15000
    });
    htmlContent = response.data;
  } catch (err: any) {
    await logSyncFailure(articleId, sourceUrl, `Failed to load page: ${err.message}`);
    throw new Error(`Failed to load page: ${err.message}`);
  }

  // Find Next.js payload marker
  const marker = 'id="__NEXT_DATA__"';
  const markerIdx = htmlContent.indexOf(marker);
  if (markerIdx === -1) {
    // Falls back to generic scraping if it is a general website
    await logSyncFailure(articleId, sourceUrl, 'Not a Yandex Pro Next.js article. Fallback generic parsing is not configured.');
    throw new Error('Unsupported HTML source layout. Next.js payload tag not found.');
  }

  const jsonStart = htmlContent.indexOf('>', markerIdx) + 1;
  const jsonEnd = htmlContent.indexOf('</script>', jsonStart);
  if (jsonEnd === -1) {
    await logSyncFailure(articleId, sourceUrl, 'Invalid HTML: closing script tag not found.');
    throw new Error('Invalid HTML: closing script tag not found.');
  }

  const jsonString = htmlContent.substring(jsonStart, jsonEnd).trim();
  let payload: any;
  try {
    payload = JSON.parse(jsonString);
  } catch (err: any) {
    await logSyncFailure(articleId, sourceUrl, `JSON Parse Error: ${err.message}`);
    throw new Error(`JSON Parse Error: ${err.message}`);
  }

  const articleData = payload.props?.initialProps?.pageProps?.data?.article;
  if (!articleData || !articleData.text_components) {
    await logSyncFailure(articleId, sourceUrl, 'Article components structure not found in page payload.');
    throw new Error('Article components structure not found in page payload.');
  }

  const components = articleData.text_components;
  let introMarkdown = '';
  let footerMarkdown = '';
  const parsedTariffs: { title: string; key: string; slug: string; contentMarkdown: string; carData: CarRow[] }[] = [];

  // Consolidate global car data requirements in Almaty
  const carDataMap = new Map<string, CarRequirement>();

  let inAccordions = false;

  for (const comp of components) {
    if (comp.type === 'YTextArea') {
      const text = htmlToMarkdown(comp.values?.text || '');
      if (!inAccordions) {
        introMarkdown += text + '\n\n';
      } else {
        footerMarkdown += text + '\n\n';
      }
    } else if (comp.type === 'AccordionStart') {
      inAccordions = true;
      const title = comp.values?.title || '';
      const key = TARIFF_KEY_MAP[title];
      const slug = TARIFF_SLUG_MAP[title];
      
      if (key && slug) {
        let tariffContent = `# ${title}\n\n[← Назад к общему списку](/articles/auto-list)\n\n`;
        const carRows: CarRow[] = [];
        
        comp.children?.forEach((child: any) => {
          if (child.type === 'YTextArea') {
            tariffContent += htmlToMarkdown(child.values?.text || '') + '\n\n';
          } else if (child.type === 'Table') {
            const head = child.values?.head || ['Марка и модель', 'Требования'];
            const body = child.values?.body || [];
            
            // Build Markdown table
            tariffContent += `| ${head.join(' | ')} |\n`;
            tariffContent += `| ${head.map(() => '---').join(' | ')} |\n`;
            
            body.forEach((row: string[]) => {
              if (row.length >= 2) {
                const modelName = row[0].trim();
                const reqStr = row[1].trim();
                tariffContent += `| ${modelName} | ${reqStr} |\n`;
                
                carRows.push({ model: modelName, requirement: reqStr });

                // Accumulate structured JSON for client-side matching
                const { brand, model } = splitBrandAndModel(modelName);
                const mapKey = `${brand.toLowerCase()}::${model.toLowerCase()}`;
                
                // Parse year requirement
                let minYear: number | null = null;
                const yearMatch = reqStr.match(/от\s*(\d{4})/i);
                if (yearMatch) {
                  minYear = parseInt(yearMatch[1], 10);
                }

                // Parse parenthesized warnings
                let warning: string | undefined = undefined;
                const warningMatch = reqStr.match(/\(([^)]+)\)/);
                if (warningMatch) {
                  warning = warningMatch[1];
                }

                if (minYear !== null) {
                  if (!carDataMap.has(mapKey)) {
                    carDataMap.set(mapKey, {
                      brand,
                      model,
                      years: {},
                      warnings: {}
                    });
                  }
                  
                  const carReq = carDataMap.get(mapKey)!;
                  carReq.years[key] = minYear;
                  if (warning) {
                    carReq.warnings = carReq.warnings || {};
                    carReq.warnings[key] = warning;
                  }
                }
              }
            });
            tariffContent += '\n';
          }
        });
        
        parsedTariffs.push({
          title,
          key,
          slug,
          contentMarkdown: tariffContent.trim(),
          carData: carRows
        });
      }
    }
  }

  // Assemble Main Page markdown links to sub-articles
  let mainContentMarkdown = `# ${mainArticle.title}\n\n`;
  mainContentMarkdown += introMarkdown.trim() + '\n\n';
  mainContentMarkdown += `## Доступные тарифы в Алматы\n\nВыберите интересующий вас тариф, чтобы посмотреть список разрешенных автомобилей:\n\n`;
  
  parsedTariffs.forEach(tariff => {
    mainContentMarkdown += `* [${tariff.title}](/articles/${tariff.slug})\n`;
  });
  
  if (footerMarkdown.trim()) {
    mainContentMarkdown += '\n' + footerMarkdown.trim() + '\n';
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Sync Sub-articles (Tariffs)
    for (const tariff of parsedTariffs) {
      const childRes = await client.query('SELECT * FROM articles WHERE slug = $1', [tariff.slug]);
      if (childRes.rows.length > 0) {
        const childArticle = childRes.rows[0];
        const oldContent = childArticle.content;
        const newContent = tariff.contentMarkdown;
        
        const { changesCount, changesSummary } = compareCarTables(oldContent, newContent);
        
        if (changesCount > 0 || options.force) {
          // Content changed, write backup and update
          await client.query(
            `UPDATE articles SET content = $1, updated_at = NOW() WHERE id = $2`,
            [newContent, childArticle.id]
          );

          // Log sync details
          await client.query(
            `INSERT INTO article_sync_history (article_id, source_url, status, changes_count, changes_summary, backup_content)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [childArticle.id, sourceUrl, 'success', changesCount, JSON.stringify(changesSummary), oldContent]
          );

          // Trigger search indexing
          const catRes = await client.query('SELECT name FROM categories WHERE id = $1', [childArticle.category_id]);
          const catName = catRes.rows.length > 0 ? catRes.rows[0].name : '';
          
          const doc = {
            id: childArticle.id,
            title: childArticle.title,
            slug: childArticle.slug,
            content: newContent,
            summary: childArticle.summary,
            categoryName: catName,
            tags: [],
            published: childArticle.published,
            createdAt: childArticle.created_at.toISOString(),
          };
          await msService.indexArticle(doc);

          // Send in-app notification alerts
          const summaryStr = `Добавлено: ${changesSummary.added.length}, удалено: ${changesSummary.removed.length}, изменено: ${changesSummary.updated.length}`;
          const titleMsg = `Обновление тарифа: ${tariff.title}`;
          const bodyMsg = `Автоматическая синхронизация обновила данные в статье "${childArticle.title}". Изменения: ${summaryStr}.`;
          
          await createNotification(titleMsg, bodyMsg, 'Admin');
          await createNotification(titleMsg, bodyMsg, 'Editor');
        } else {
          // No changes, log empty sync log
          await client.query(
            `INSERT INTO article_sync_history (article_id, source_url, status, changes_count, changes_summary)
             VALUES ($1, $2, $3, 0, '{}')`,
            [childArticle.id, sourceUrl, 'success']
          );
        }
      }
    }

    // 2. Sync Main Article (auto-list index)
    const oldMainContent = mainArticle.content;
    const nextSyncAt = getNextSyncTime(mainArticle.sync_interval);
    const carDataArray = Array.from(carDataMap.values());

    await client.query(
      `UPDATE articles 
       SET content = $1, structured_data = $2, last_sync_at = NOW(), next_sync_at = $3, updated_at = NOW() 
       WHERE id = $4`,
      [mainContentMarkdown, JSON.stringify(carDataArray), nextSyncAt, articleId]
    );

    // Compare main page content
    const mainDiff = oldMainContent !== mainContentMarkdown;
    await client.query(
      `INSERT INTO article_sync_history (article_id, source_url, status, changes_count, backup_content)
       VALUES ($1, $2, $3, $4, $5)`,
      [articleId, sourceUrl, 'success', mainDiff ? 1 : 0, mainDiff ? oldMainContent : null]
    );

    // Index main page
    const catRes = await client.query('SELECT name FROM categories WHERE id = $1', [mainArticle.category_id]);
    const catName = catRes.rows.length > 0 ? catRes.rows[0].name : '';
    const mainDoc = {
      id: mainArticle.id,
      title: mainArticle.title,
      slug: mainArticle.slug,
      content: mainContentMarkdown,
      summary: mainArticle.summary,
      categoryName: catName,
      tags: [],
      published: mainArticle.published,
      createdAt: mainArticle.created_at.toISOString(),
    };
    await msService.indexArticle(mainDoc);

    await client.query('COMMIT');
    console.log(`Sync completed successfully for article ID ${articleId}`);
  } catch (error) {
    await client.query('ROLLBACK');
    await logSyncFailure(articleId, sourceUrl, `Database Transaction Error: ${(error as Error).message}`);
    throw error;
  } finally {
    client.release();
  }
}

// Log failure to sync history
async function logSyncFailure(articleId: number, url: string, errorMsg: string) {
  try {
    await query(
      `INSERT INTO article_sync_history (article_id, source_url, status, error_message)
       VALUES ($1, $2, $3, $4)`,
      [articleId, url, 'failed', errorMsg]
    );
    
    // Notify about sync failure
    const title = 'Ошибка авто-синхронизации';
    const message = `Не удалось синхронизировать статью ID ${articleId} с внешним источником ${url}. Ошибка: ${errorMsg}`;
    await createNotification(title, message, 'Admin', 'error');
    await createNotification(title, message, 'Editor', 'error');
  } catch (err) {
    console.error('Failed to log sync failure:', err);
  }
}

// Calculate the next sync timestamp based on interval
function getNextSyncTime(interval: string): Date | null {
  const now = new Date();
  if (interval === '6h') {
    return new Date(now.getTime() + 6 * 60 * 60 * 1000);
  }
  if (interval === '12h') {
    return new Date(now.getTime() + 12 * 60 * 60 * 1000);
  }
  if (interval === '24h') {
    return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
  return null; // manual
}

// Background scheduler checks
async function checkAndRunScheduledSyncs() {
  try {
    const res = await query(`
      SELECT id, title, source_url, sync_interval, next_sync_at
      FROM articles
      WHERE source_url IS NOT NULL 
        AND sync_interval != 'manual' 
        AND (next_sync_at IS NULL OR next_sync_at <= NOW())
    `);
    
    const articlesToSync = res.rows;
    if (articlesToSync.length === 0) return;

    console.log(`[Scheduler] Found ${articlesToSync.length} scheduled articles to synchronize.`);
    for (const art of articlesToSync) {
      try {
        console.log(`[Scheduler] Running sync for "${art.title}" (ID: ${art.id})...`);
        await syncArticle(art.id);
      } catch (err: any) {
        console.error(`[Scheduler] Sync failed for article "${art.title}":`, err.message);
      }
    }
  } catch (err: any) {
    console.error('[Scheduler] Error in checkAndRunScheduledSyncs:', err.message);
  }
}

// Cron daemon controllers
let schedulerInterval: NodeJS.Timeout | null = null;

export function startScheduler() {
  if (schedulerInterval) return;
  console.log('Starting Source Sync Scheduler Daemon (checks every 5 minutes)...');
  
  // Run initial check after 10s delay to let server boot up fully
  setTimeout(() => {
    checkAndRunScheduledSyncs().catch(err => console.error('Error in initial scheduled check:', err));
  }, 10000);
  
  // Run checks every 5 minutes
  schedulerInterval = setInterval(() => {
    checkAndRunScheduledSyncs().catch(err => console.error('Error in scheduled check interval:', err));
  }, 5 * 60 * 1000);
}

export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('Stopped Source Sync Scheduler Daemon.');
  }
}
