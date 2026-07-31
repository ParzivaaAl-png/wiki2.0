import * as fs from 'fs';
import * as path from 'path';
import mammoth from 'mammoth';
const pdfParse = require('pdf-parse');
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import cheerio from 'cheerio';

export interface ParsedDocument {
  title: string;
  content: string; // HTML representation for WYSIWYG
  summary: string;
}

export const enrichDocxHtml = async (filePath: string, mammothHtml: string): Promise<string> => {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(fileBuffer);
    const xmlFile = zip.file('word/document.xml');
    if (!xmlFile) return mammothHtml;

    const xmlString = await xmlFile.async('string');
    const $xml = cheerio.load(xmlString, { xmlMode: true });
    const $html = cheerio.load(mammothHtml, null, false);

    // 1. Extract tables formatting (shading background, cell alignment, text color)
    const xmlTables: Array<Array<Array<{ fill?: string; align?: string; textColor?: string }>>> = [];
    $xml('w\\:tbl, tbl').each((_, tblEl) => {
      const rows: Array<Array<{ fill?: string; align?: string; textColor?: string }>> = [];
      $xml(tblEl).children('w\\:tr, tr').each((_, trEl) => {
        const cells: Array<{ fill?: string; align?: string; textColor?: string }> = [];
        $xml(trEl).children('w\\:tc, tc').each((_, tcEl) => {
          const $tc = $xml(tcEl);
          const shd = $tc.find('w\\:shd, shd').first();
          let fill = shd.attr('w:fill') || shd.attr('fill');

          const jc = $tc.find('w\\:jc, jc').first();
          let align = jc.attr('w:val') || jc.attr('val');

          const color = $tc.find('w\\:color, color').first();
          let textColor = color.attr('w:val') || color.attr('val');

          cells.push({
            fill: fill && fill !== 'auto' && fill !== 'none' && fill !== 'FFFFFF' ? `#${fill}` : undefined,
            align: align || undefined,
            textColor: textColor && textColor !== 'auto' ? `#${textColor}` : undefined,
          });
        });
        rows.push(cells);
      });
      xmlTables.push(rows);
    });

    // Apply XML table styling to Cheerio HTML DOM
    $html('table').each((tblIdx, tblEl) => {
      const xmlRows = xmlTables[tblIdx];
      const $tbl = $html(tblEl);
      $tbl.addClass('imported-table w-full border-collapse my-4 text-sm');

      if (!xmlRows) return;

      $tbl.find('tr').each((rowIdx, trEl) => {
        const xmlCells = xmlRows[rowIdx];
        if (!xmlCells) return;

        const $tr = $html(trEl);
        $tr.find('td, th').each((cellIdx, tdEl) => {
          const cellData = xmlCells[cellIdx];
          if (!cellData) return;

          const $td = $html(tdEl);
          const styles: string[] = [];

          if (cellData.fill) {
            styles.push(`background-color: ${cellData.fill} !important`);
          }
          if (cellData.textColor) {
            styles.push(`color: ${cellData.textColor} !important`);
          }
          if (cellData.align) {
            styles.push(`text-align: ${cellData.align}`);
          }

          styles.push('border: 1px solid rgba(148, 163, 184, 0.35)');
          styles.push('padding: 10px 14px');

          const currentStyle = $td.attr('style') || '';
          $td.attr('style', `${currentStyle}; ${styles.join('; ')}`.trim());

          // Apply text color to internal tags
          if (cellData.textColor) {
            $td.find('p, span, strong, em').each((_, child) => {
              const $c = $html(child);
              const childStyle = $c.attr('style') || '';
              $c.attr('style', `${childStyle}; color: ${cellData.textColor} !important`.trim());
            });
          }
        });
      });
    });

    // 2. Extract paragraph alignment outside tables
    const xmlParagraphs: Array<{ align?: string; textColor?: string }> = [];
    $xml('w\\:body > w\\:p, w\\:body > w\\:sdt > w\\:sdtContent > w\\:p').each((_, pEl) => {
      const $p = $xml(pEl);
      const jc = $p.find('w\\:jc, jc').first();
      let align = jc.attr('w:val') || jc.attr('val');

      const color = $p.find('w\\:color, color').first();
      let textColor = color.attr('w:val') || color.attr('val');

      xmlParagraphs.push({
        align: align || undefined,
        textColor: textColor && textColor !== 'auto' ? `#${textColor}` : undefined,
      });
    });

    $html('body > p, body > h1, body > h2, body > h3, body > div').each((pIdx, pEl) => {
      const pData = xmlParagraphs[pIdx];
      if (!pData) return;

      const $p = $html(pEl);
      const styles: string[] = [];

      if (pData.align) {
        styles.push(`text-align: ${pData.align}`);
      }
      if (pData.textColor) {
        styles.push(`color: ${pData.textColor} !important`);
      }

      if (styles.length > 0) {
        const currentStyle = $p.attr('style') || '';
        $p.attr('style', `${currentStyle}; ${styles.join('; ')}`.trim());
      }
    });

    return $html.html() || mammothHtml;
  } catch (err) {
    console.error('Failed to enrich DOCX HTML styles:', err);
    return mammothHtml;
  }
};

export const parseDocument = async (filePath: string, originalName: string): Promise<ParsedDocument> => {
  const ext = path.extname(originalName).toLowerCase();
  const title = path.basename(originalName, ext).replace(/[_-]/g, ' ').trim();
  let content = '';
  let summary = '';

  if (ext === '.txt') {
    const text = fs.readFileSync(filePath, 'utf-8');
    // Convert newlines to paragraphs for TipTap HTML format
    content = text
      .split('\n\n')
      .map(p => `<p>${p.replace(/\n/g, '<br />')}</p>`)
      .join('');
    summary = text.substring(0, 200) + (text.length > 200 ? '...' : '');
  } 
  else if (ext === '.docx' || ext === '.doc') {
    const result = await mammoth.convertToHtml({ path: filePath });
    content = await enrichDocxHtml(filePath, result.value);
    
    const textResult = await mammoth.extractRawText({ path: filePath });
    summary = textResult.value.substring(0, 200).trim() + (textResult.value.length > 200 ? '...' : '');
  } 
  else if (ext === '.pdf') {
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    content = pdfData.text
      .split('\n\n')
      .map((p: string) => `<p>${p.replace(/\n/g, '<br />')}</p>`)
      .join('');
    summary = pdfData.text.substring(0, 200).replace(/\s+/g, ' ').trim() + (pdfData.text.length > 200 ? '...' : '');
  } 
  else if (ext === '.xlsx' || ext === '.csv') {
    const workbook = XLSX.readFile(filePath);
    let htmlTable = '';
    
    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      const sheetHtml = XLSX.utils.sheet_to_html(worksheet);
      htmlTable += `<div class="excel-sheet-import mb-6"><h3>Лист: ${sheetName}</h3>${sheetHtml}</div>`;
    });
    
    content = htmlTable;
    summary = `Импортированная таблица Excel/CSV из файла "${originalName}" с листами: ${workbook.SheetNames.join(', ')}.`;
  } 
  else {
    throw new Error(`Unsupported file type: ${ext}`);
  }

  return {
    title,
    content,
    summary,
  };
};

