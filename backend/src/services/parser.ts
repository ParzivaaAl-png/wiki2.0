import * as fs from 'fs';
import * as path from 'path';
import mammoth from 'mammoth';
const pdfParse = require('pdf-parse');
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import cheerio from 'cheerio';
import { randomUUID } from 'crypto';

export interface ParsedDocument {
  title: string;
  content: string; // HTML representation for WYSIWYG
  summary: string;
}

const getUploadsDir = (): string => {
  const uploadsDir = path.join(__dirname, '../../uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  return uploadsDir;
};

/**
 * Extracts all media files from a DOCX zip archive and saves them to disk storage (/uploads/),
 * returning a mapping of relationship IDs (rId) and filenames to permanent asset URLs (/uploads/...).
 */
export const extractDocxMedia = async (
  fileBuffer: Buffer
): Promise<{
  rIdToUrl: Map<string, string>;
  mediaNameToUrl: Map<string, string>;
  orderedUrls: string[];
}> => {
  const rIdToUrl = new Map<string, string>();
  const mediaNameToUrl = new Map<string, string>();
  const orderedUrls: string[] = [];

  try {
    const zip = await JSZip.loadAsync(fileBuffer);
    const uploadsDir = getUploadsDir();

    // 1. Extract relationships from word/_rels/document.xml.rels
    const relsFile = zip.file('word/_rels/document.xml.rels');
    const relsTargetMap = new Map<string, string>(); // rId -> target media path

    if (relsFile) {
      const relsXml = await relsFile.async('string');
      const $rels = cheerio.load(relsXml, { xmlMode: true });
      $rels('Relationship').each((_, el) => {
        const id = $rels(el).attr('Id');
        const target = $rels(el).attr('Target');
        if (id && target) {
          relsTargetMap.set(id, target.replace(/^..\//, ''));
        }
      });
    }

    // 2. Find and extract all media files in word/media/
    const mediaFiles = Object.keys(zip.files).filter((fileName) =>
      fileName.startsWith('word/media/') && !zip.files[fileName].dir
    );

    // Sort media files to maintain document sequence
    mediaFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    for (let i = 0; i < mediaFiles.length; i++) {
      const zipPath = mediaFiles[i];
      const fileZip = zip.file(zipPath);
      if (!fileZip) continue;

      const mediaBuffer = await fileZip.async('nodebuffer');
      const ext = path.extname(zipPath).toLowerCase() || '.png';
      const cleanBasename = path.basename(zipPath, ext).replace(/[^a-zA-Z0-9_-]/g, '');
      const uniqueFileName = `docx-img-${Date.now()}-${i}-${cleanBasename}${ext}`;
      const targetPath = path.join(uploadsDir, uniqueFileName);

      fs.writeFileSync(targetPath, mediaBuffer);

      const persistentUrl = `/uploads/${encodeURIComponent(uniqueFileName)}`;
      mediaNameToUrl.set(zipPath, persistentUrl);
      mediaNameToUrl.set(path.basename(zipPath), persistentUrl);
      orderedUrls.push(persistentUrl);

      // Map rId if relationship exists
      for (const [rId, target] of relsTargetMap.entries()) {
        if (target.endsWith(zipPath) || target.endsWith(path.basename(zipPath)) || zipPath.endsWith(target)) {
          rIdToUrl.set(rId, persistentUrl);
        }
      }
    }
  } catch (err) {
    console.error('Failed to extract DOCX media archive:', err);
  }

  return { rIdToUrl, mediaNameToUrl, orderedUrls };
};

export const enrichDocxHtml = async (
  filePath: string,
  mammothHtml: string,
  mediaMeta?: {
    rIdToUrl: Map<string, string>;
    mediaNameToUrl: Map<string, string>;
    orderedUrls: string[];
  }
): Promise<string> => {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const meta = mediaMeta || (await extractDocxMedia(fileBuffer));
    const zip = await JSZip.loadAsync(fileBuffer);
    const xmlFile = zip.file('word/document.xml');
    if (!xmlFile) return mammothHtml;

    const xmlString = await xmlFile.async('string');
    const $xml = cheerio.load(xmlString, { xmlMode: true });
    const $html = cheerio.load(mammothHtml, null, false);

    // 1. Ensure all images in HTML have permanent URLs (never broken or base64)
    $html('img').each((idx, imgEl) => {
      const $img = $html(imgEl);
      const src = $img.attr('src') || '';

      if (src.startsWith('data:') || src.startsWith('blob:') || !src || src.includes('undefined')) {
        // Replace with saved permanent URL from ordered list or media map
        const replacementUrl = meta.orderedUrls[idx] || Array.from(meta.mediaNameToUrl.values())[idx];
        if (replacementUrl) {
          $img.attr('src', replacementUrl);
        }
      }
      $img.addClass('rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm max-w-full h-auto my-4 block');
    });

    // 2. Check if any drawing images were missed by mammoth (e.g. inside wp:anchor or v:imagedata)
    const xmlImageUrls: string[] = [];
    $xml('a\\:blip, blip, v\\:imagedata, imagedata').each((_, el) => {
      const rId = $xml(el).attr('r:embed') || $xml(el).attr('r:id') || $xml(el).attr('r:link');
      if (rId && meta.rIdToUrl.has(rId)) {
        const url = meta.rIdToUrl.get(rId)!;
        if (!xmlImageUrls.includes(url)) {
          xmlImageUrls.push(url);
        }
      }
    });

    // If XML has images that were completely omitted by Mammoth, append them to corresponding sections
    const existingHtmlSrcs = new Set<string>();
    $html('img').each((_, imgEl) => {
      const src = $html(imgEl).attr('src');
      if (src) existingHtmlSrcs.add(src);
    });

    for (const url of xmlImageUrls) {
      if (!existingHtmlSrcs.has(url)) {
        $html.root().append(`<p><img src="${url}" class="rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-sm max-w-full h-auto my-4 block" /></p>`);
      }
    }

    // 3. Extract table formatting (background shading, text color, borders, cell alignment)
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
            $td.find('p, span, strong, em, h1, h2, h3, h4').each((_, child) => {
              const $c = $html(child);
              const childStyle = $c.attr('style') || '';
              $c.attr('style', `${childStyle}; color: ${cellData.textColor} !important`.trim());
            });
          }
        });
      });
    });

    // 4. Extract paragraph alignment, font color, shading/callout boxes outside tables
    const xmlParagraphs: Array<{ align?: string; textColor?: string; bgFill?: string }> = [];
    $xml('w\\:body > w\\:p, w\\:body > w\\:sdt > w\\:sdtContent > w\\:p').each((_, pEl) => {
      const $p = $xml(pEl);
      const jc = $p.find('w\\:jc, jc').first();
      let align = jc.attr('w:val') || jc.attr('val');

      const color = $p.find('w\\:color, color').first();
      let textColor = color.attr('w:val') || color.attr('val');

      const shd = $p.find('w\\:shd, shd').first();
      let bgFill = shd.attr('w:fill') || shd.attr('fill');

      xmlParagraphs.push({
        align: align || undefined,
        textColor: textColor && textColor !== 'auto' ? `#${textColor}` : undefined,
        bgFill: bgFill && bgFill !== 'auto' && bgFill !== 'none' && bgFill !== 'FFFFFF' ? `#${bgFill}` : undefined,
      });
    });

    $html('body > p, body > h1, body > h2, body > h3, body > h4, body > div').each((pIdx, pEl) => {
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
      if (pData.bgFill) {
        styles.push(`background-color: ${pData.bgFill}`);
        styles.push('padding: 12px 16px');
        styles.push('border-radius: 8px');
        styles.push('border-left: 4px solid #3b82f6');
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
    content = text
      .split('\n\n')
      .map((p) => `<p>${p.replace(/\n/g, '<br />')}</p>`)
      .join('');
    summary = text.substring(0, 200) + (text.length > 200 ? '...' : '');
  } else if (ext === '.docx' || ext === '.doc') {
    const fileBuffer = fs.readFileSync(filePath);
    const mediaMeta = await extractDocxMedia(fileBuffer);

    // Custom Mammoth options: convert inline images into permanent /uploads/ asset URLs
    const mammothOptions = {
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Heading 4'] => h4:fresh",
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Subtitle'] => h2:fresh",
      ],
      convertImage: async (element: any) => {
        try {
          const imageBuffer = await element.read();
          const contentType = element.contentType || 'image/png';
          const extName = contentType.includes('jpeg') ? '.jpg' : contentType.includes('png') ? '.png' : contentType.includes('webp') ? '.webp' : '.png';
          
          // Check if image is already mapped via rId or media name
          const rId = (element as any).relationshipId;
          if (rId && mediaMeta.rIdToUrl.has(rId)) {
            return { src: mediaMeta.rIdToUrl.get(rId)! };
          }

          // Save fallback stream directly to disk storage
          const uploadsDir = getUploadsDir();
          const fileName = `docx-img-inline-${Date.now()}-${randomUUID().slice(0, 8)}${extName}`;
          const filePathOnDisk = path.join(uploadsDir, fileName);
          fs.writeFileSync(filePathOnDisk, imageBuffer);

          const persistentUrl = `/uploads/${encodeURIComponent(fileName)}`;
          return { src: persistentUrl };
        } catch (err) {
          console.error('Error in mammoth convertImage:', err);
          return { src: '' };
        }
      },
    };

    const result = await mammoth.convertToHtml({ path: filePath }, mammothOptions as any);
    content = await enrichDocxHtml(filePath, result.value, mediaMeta);

    const textResult = await mammoth.extractRawText({ path: filePath });
    summary = textResult.value.substring(0, 200).trim() + (textResult.value.length > 200 ? '...' : '');
  } else if (ext === '.pdf') {
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    content = pdfData.text
      .split('\n\n')
      .map((p: string) => `<p>${p.replace(/\n/g, '<br />')}</p>`)
      .join('');
    summary = pdfData.text.substring(0, 200).replace(/\s+/g, ' ').trim() + (pdfData.text.length > 200 ? '...' : '');
  } else if (ext === '.xlsx' || ext === '.csv') {
    const workbook = XLSX.readFile(filePath);
    let htmlTable = '';

    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      const sheetHtml = XLSX.utils.sheet_to_html(worksheet);
      htmlTable += `<div class="excel-sheet-import mb-6"><h3>Лист: ${sheetName}</h3>${sheetHtml}</div>`;
    });

    content = htmlTable;
    summary = `Импортированная таблица Excel/CSV из файла "${originalName}" с листами: ${workbook.SheetNames.join(', ')}.`;
  } else {
    throw new Error(`Unsupported file type: ${ext}`);
  }

  return {
    title,
    content,
    summary,
  };
};
