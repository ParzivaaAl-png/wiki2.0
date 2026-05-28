import * as fs from 'fs';
import * as path from 'path';
import mammoth from 'mammoth';
const pdfParse = require('pdf-parse');
import * as XLSX from 'xlsx';

export interface ParsedDocument {
  title: string;
  content: string; // HTML representation for WYSIWYG
  summary: string;
}

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
  else if (ext === '.docx') {
    const result = await mammoth.convertToHtml({ path: filePath });
    content = result.value; // Clean HTML
    
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
