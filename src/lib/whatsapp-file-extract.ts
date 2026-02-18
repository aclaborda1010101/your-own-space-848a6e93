import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';

// Configure pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

/**
 * Extracts plain text from a WhatsApp export file.
 * Supports: .txt, .csv, .pdf, .zip
 */
export async function extractTextFromFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  switch (ext) {
    case 'txt':
    case 'md':
      return file.text();

    case 'csv':
      return parseCSVToWhatsAppText(await file.text());

    case 'pdf':
      return extractTextFromPDF(file);

    case 'zip':
      return extractTextFromZip(file);

    default:
      // Fallback: try reading as text
      return file.text();
  }
}

/**
 * Converts a CSV chat export to WhatsApp-style text lines.
 * Detects columns by header name or assumes order: date, sender, message.
 */
function parseCSVToWhatsAppText(csvText: string): string {
  const lines = csvText.split('\n').filter(l => l.trim());
  if (lines.length < 2) return csvText;

  // Try backup CSV format first (12-column WhatsApp backup tool)
  const backupResult = tryParseBackupCSV(lines);
  if (backupResult) return backupResult;

  const firstLine = lines[0];
  // Heuristic: if first line looks like a WhatsApp message, it's not a CSV
  if (firstLine.match(/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/)) {
    return csvText; // Already WhatsApp format
  }

  const headers = parseCSVFields(firstLine);
  const headerLower = headers.map(h => h.toLowerCase().trim());

  // Detect column indices
  const dateIdx = findColumnIndex(headerLower, ['date', 'fecha', 'timestamp', 'datetime', 'time']);
  const senderIdx = findColumnIndex(headerLower, ['sender', 'remitente', 'from', 'nombre', 'author', 'contact']);
  const messageIdx = findColumnIndex(headerLower, ['message', 'mensaje', 'text', 'texto', 'content', 'body']);

  const hasHeaders = dateIdx >= 0 || senderIdx >= 0 || messageIdx >= 0;
  const startLine = hasHeaders ? 1 : 0;

  // If no headers detected, assume order: date(0), sender(1), message(2)
  const dIdx = hasHeaders ? (dateIdx >= 0 ? dateIdx : 0) : 0;
  const sIdx = hasHeaders ? (senderIdx >= 0 ? senderIdx : 1) : 1;
  const mIdx = hasHeaders ? (messageIdx >= 0 ? messageIdx : 2) : 2;

  const result: string[] = [];
  for (let i = startLine; i < lines.length; i++) {
    const cols = parseCSVFields(lines[i]);
    if (cols.length < 3) continue;

    const date = (cols[dIdx] || '').trim();
    const sender = (cols[sIdx] || '').trim();
    const message = (cols[mIdx] || '').trim();

    if (!sender || !message) continue;

    // Format as WhatsApp line
    result.push(`${date} - ${sender}: ${message}`);
  }

  return result.length > 0 ? result.join('\n') : csvText;
}

/**
 * Detects and parses WhatsApp backup CSV format (12 columns, no headers).
 * Columns: chat_name, send_date, read_date, direction, phone, contact_name,
 *          status, reply_context, message, media_file, media_type, media_size
 */
function tryParseBackupCSV(lines: string[]): string | null {
  // Check first few data lines for backup format indicators
  const samplesToCheck = Math.min(10, lines.length);
  let backupHits = 0;

  for (let i = 0; i < samplesToCheck; i++) {
    const cols = parseCSVFields(lines[i]);
    if (cols.length < 10) continue;

    const direction = cols[3]?.trim();
    const dateStr = cols[1]?.trim();

    // Check for direction values and date format yyyy-MM-dd HH:mm:ss
    if (
      (direction === 'Entrante' || direction === 'Saliente' || direction === 'Notificacion') &&
      dateStr.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    ) {
      backupHits++;
    }
  }

  // Need at least 3 matches or >50% of samples
  if (backupHits < 3 && backupHits < samplesToCheck * 0.5) return null;

  const result: string[] = [];
  for (const line of lines) {
    const cols = parseCSVFields(line);
    if (cols.length < 10) continue;

    const direction = cols[3]?.trim();
    // Skip system notifications
    if (direction === 'Notificacion') continue;

    const date = cols[1]?.trim() || '';
    const contactName = cols[5]?.trim();
    const message = cols[8]?.trim();
    const mediaType = cols[10]?.trim();

    // Determine sender
    let sender: string;
    if (direction === 'Saliente') {
      sender = 'Yo';
    } else {
      sender = contactName || cols[4]?.trim() || 'Desconocido';
    }

    // Determine message content
    let content = message;
    if (!content && mediaType) {
      content = `[${mediaType}]`;
    }
    if (!content) continue;

    result.push(`${date} - ${sender}: ${content}`);
  }

  return result.length > 0 ? result.join('\n') : null;
}

function findColumnIndex(headers: string[], candidates: string[]): number {
  for (const candidate of candidates) {
    const idx = headers.findIndex(h => h.includes(candidate));
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseCSVFields(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',' || ch === ';' || ch === '\t') { result.push(current.trim()); current = ''; }
      else { current += ch; }
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Extract text from a PDF file using pdf.js
 */
async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const textParts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str)
      .join(' ');
    textParts.push(pageText);
  }

  return textParts.join('\n');
}

/**
 * Extract the .txt file from a WhatsApp .zip export
 */
async function extractTextFromZip(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  // Find the .txt file (WhatsApp exports typically have one _chat.txt or .txt)
  const txtFiles = Object.keys(zip.files).filter(
    name => name.endsWith('.txt') && !zip.files[name].dir
  );

  if (txtFiles.length === 0) {
    throw new Error('No se encontró ningún archivo .txt dentro del ZIP');
  }

  // Prefer file with "chat" in name, otherwise take the largest .txt
  const chatFile = txtFiles.find(n => n.toLowerCase().includes('chat')) || txtFiles[0];
  return zip.files[chatFile].async('string');
}
