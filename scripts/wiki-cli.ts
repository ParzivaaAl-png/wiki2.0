import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import * as XLSX from 'xlsx';

// Load .env.codex.local first, fallback to .env
const envLocalPath = path.resolve(process.cwd(), '.env.codex.local');
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else {
  dotenv.config();
}

const WIKI_API_URL = process.env.WIKI_API_URL || process.env.WIKI_LOCAL_API_URL || 'https://wiki-backend-combined.onrender.com/api';
const WIKI_ADMIN_USERNAME = process.env.WIKI_ADMIN_USERNAME || 'admin';
const WIKI_ADMIN_PASSWORD = process.env.WIKI_ADMIN_PASSWORD || 'admin';

export interface PublishOptions {
  filePath: string;
  title?: string;
  slug?: string;
  summary?: string;
  sectionIds?: number[];
  published?: boolean;
  articleType?: string;
  changeDescription?: string;
}

export class CodexWikiCLI {
  private token: string | null = null;
  private baseUrl: string;

  constructor(baseUrl: string = WIKI_API_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  /**
   * Authenticate admin account using credentials from .env.codex.local
   */
  async login(): Promise<string> {
    if (this.token) return this.token;

    try {
      const response = await axios.post(`${this.baseUrl}/auth/login`, {
        username: WIKI_ADMIN_USERNAME,
        password: WIKI_ADMIN_PASSWORD,
      });

      if (response.data && response.data.token) {
        this.token = response.data.token;
        console.log(`[Codex CLI] Authenticated as Admin (${WIKI_ADMIN_USERNAME})`);
        return this.token;
      }
      throw new Error('Authentication response did not contain token');
    } catch (err: any) {
      console.error(`[Codex CLI Auth Error] ${err.response?.data?.error || err.message}`);
      throw new Error(`Failed to login to Wiki API at ${this.baseUrl}: ${err.message}`);
    }
  }

  /**
   * Fetch available sections in Wiki 2.0
   */
  async listSections(): Promise<Array<{ id: number; name: string; space_name?: string }>> {
    await this.login();
    const response = await axios.get(`${this.baseUrl}/wiki/sections`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    return response.data;
  }

  /**
   * Parse document (docx, pdf, xlsx, txt, md) and transform to rich HTML for Wiki 2.0
   */
  async convertDocumentToWikiHtml(filePath: string): Promise<{ title: string; htmlContent: string; summary: string }> {
    const ext = path.extname(filePath).toLowerCase();
    const fileNameWithoutExt = path.basename(filePath, ext);
    let rawHtml = '';
    let autoTitle = fileNameWithoutExt.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

    if (ext === '.docx' || ext === '.doc') {
      const buffer = fs.readFileSync(filePath);
      const result = await mammoth.convertToHtml({ buffer });
      rawHtml = result.value;
    } else if (ext === '.pdf') {
      const buffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(buffer);
      const paragraphs = pdfData.text
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean);

      rawHtml = paragraphs
        .map((p) => {
          if (p.length < 80 && !p.endsWith('.')) {
            return `<h2>${this.escapeHtml(p)}</h2>`;
          }
          return `<p>${this.escapeHtml(p).replace(/\n/g, '<br/>')}</p>`;
        })
        .join('\n');
    } else if (ext === '.xlsx' || ext === '.xls' || ext === '.csv') {
      const workbook = XLSX.readFile(filePath);
      let tablesHtml = '';
      workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        const sheetHtml = XLSX.utils.sheet_to_html(worksheet);
        tablesHtml += `<h3>Лист: ${this.escapeHtml(sheetName)}</h3>\n${sheetHtml}\n`;
      });
      rawHtml = tablesHtml;
    } else if (ext === '.md' || ext === '.markdown') {
      const content = fs.readFileSync(filePath, 'utf-8');
      rawHtml = this.markdownToHtml(content);
    } else {
      // Plain text or html
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.trim().startsWith('<')) {
        rawHtml = content;
      } else {
        const paragraphs = content.split(/\n\s*\n/).filter(Boolean);
        rawHtml = paragraphs.map((p) => `<p>${this.escapeHtml(p.trim()).replace(/\n/g, '<br/>')}</p>`).join('\n');
      }
    }

    // Enhance raw HTML with rich typography, styled tables, and callouts
    const enhancedHtml = this.enhanceWikiFormatting(rawHtml);

    // Extract short summary
    const plainText = enhancedHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const summary = plainText.length > 200 ? plainText.slice(0, 197) + '...' : plainText;

    return {
      title: autoTitle,
      htmlContent: enhancedHtml,
      summary,
    };
  }

  /**
   * Publish document to Wiki 2.0 as a structured article
   */
  async publishDocument(options: PublishOptions): Promise<any> {
    await this.login();

    const fullPath = path.resolve(options.filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${fullPath}`);
    }

    console.log(`[Codex CLI] Processing document: ${path.basename(fullPath)}...`);
    const { title: autoTitle, htmlContent, summary: autoSummary } = await this.convertDocumentToWikiHtml(fullPath);

    const title = options.title || autoTitle;
    const slug = options.slug || this.slugify(title);
    const summary = options.summary || autoSummary;
    let sectionIds = options.sectionIds || [];

    if (sectionIds.length === 0) {
      const sections = await this.listSections();
      if (sections.length > 0) {
        sectionIds = [sections[0].id];
        console.log(`[Codex CLI] Auto-assigned to section: "${sections[0].name}" (ID: ${sections[0].id})`);
      } else {
        throw new Error('No sections found in Wiki. Please create a section first.');
      }
    }

    const payload = {
      title,
      slug,
      summary,
      content: htmlContent,
      published: options.published !== false,
      status: options.published !== false ? 'published' : 'draft',
      section_ids: sectionIds,
      article_type: options.articleType || 'general',
      tags: ['codex-import', path.extname(fullPath).replace('.', '')].filter(Boolean),
      change_description: options.changeDescription || `Автоматический импорт документа "${path.basename(fullPath)}" через Codex CLI`,
    };

    console.log(`[Codex CLI] Publishing article "${title}" to section(s) [${sectionIds.join(', ')}]...`);

    const response = await axios.post(`${this.baseUrl}/articles`, payload, {
      headers: { Authorization: `Bearer ${this.token}` },
    });

    console.log(`[Codex CLI Success] Article created successfully! ID: ${response.data.id}, Slug: ${response.data.slug}`);
    return response.data;
  }

  /**
   * Helper: Enhance converted HTML with modern Wiki 2.0 typography, table styles, callout blocks
   */
  private enhanceWikiFormatting(html: string): string {
    let result = html;

    // Enhance tables with class="wiki-table"
    result = result.replace(/<table(\s+[^>]*)?>/gi, '<table className="w-full border-collapse border border-border my-4 rounded-lg overflow-hidden text-sm">');
    result = result.replace(/<th(\s+[^>]*)?>/gi, '<th className="bg-muted px-4 py-2.5 font-bold text-left text-foreground border border-border">');
    result = result.replace(/<td(\s+[^>]*)?>/gi, '<td className="px-4 py-2 text-foreground border border-border">');

    // Add callout styling to notes/warnings
    result = result.replace(/<p>\s*<strong>(Примечание|Заметка|Note):<\/strong>\s*(.*?)<\/p>/gi, 
      '<div className="my-4 rounded-lg border border-indigo-500/20 bg-indigo-500/10 p-4 text-xs leading-relaxed text-foreground"><strong>💡 Примечание:</strong> $2</div>'
    );
    result = result.replace(/<p>\s*<strong>(Внимание|Важно|Warning|Important):<\/strong>\s*(.*?)<\/p>/gi, 
      '<div className="my-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-xs leading-relaxed text-foreground"><strong>⚠️ Важно:</strong> $2</div>'
    );

    return result;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private markdownToHtml(md: string): string {
    let html = md;
    // Headings
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    // Bold / Italic
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Lists
    html = html.replace(/^\s*\-\s+(.*$)/gim, '<li>$1</li>');
    // Wrap consecutive list items in <ul>
    html = html.replace(/(<li>.*<\/li>\s*)+/g, '<ul>$&</ul>');
    // Paragraphs
    html = html.replace(/\n\s*\n/g, '</p><p>');
    return `<p>${html}</p>`;
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\u0400-\u04FF-]+/g, '')
      .replace(/--+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '') || `doc-${Date.now()}`;
  }
}

// CLI Execution Entrypoint
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  const cli = new CodexWikiCLI();

  (async () => {
    try {
      if (command === 'publish') {
        const filePath = args[1];
        if (!filePath) {
          console.log('Usage: npx ts-node scripts/wiki-cli.ts publish <path-to-file> [--sectionId=<id>] [--title="..."]');
          process.exit(1);
        }

        const sectionIdArg = args.find((a) => a.startsWith('--sectionId='));
        const titleArg = args.find((a) => a.startsWith('--title='));

        const sectionIds = sectionIdArg ? [Number(sectionIdArg.split('=')[1])] : undefined;
        const title = titleArg ? titleArg.split('=')[1].replace(/^"(.*)"$/, '$1') : undefined;

        await cli.publishDocument({ filePath, sectionIds, title });
      } else if (command === 'list-sections') {
        const sections = await cli.listSections();
        console.log('\n--- Доступные Разделы Wiki 2.0 ---');
        sections.forEach((s) => console.log(`[ID: ${s.id}] ${s.name} ${s.space_name ? `(${s.space_name})` : ''}`));
      } else {
        console.log('Codex Wiki CLI Commands:');
        console.log('  publish <file> [--sectionId=1] [--title="Title"]');
        console.log('  list-sections');
      }
    } catch (err: any) {
      console.error('CLI execution error:', err.message);
      process.exit(1);
    }
  })();
}
