import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ParsedBackupChat {
  chatName: string;
  speakers: Map<string, number>;
  myMessages: number;
  totalMessages: number;
  isGroup: boolean;
}

export interface ParsedMessage {
  chatName: string;
  sender: string;
  content: string;
  messageDate: string | null;
  direction: 'incoming' | 'outgoing';
}

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
function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function isBackupHeaderRow(cols: string[]): boolean {
  if (cols.length < 10) return false;
  const col3 = stripAccents(cols[3]?.trim().toLowerCase() || '');
  return col3 === 'tipo' || col3 === 'direction' || !cols[1]?.trim().match(/^\d{4}-\d{2}-\d{2}/);
}

function tryParseBackupCSV(lines: string[]): string | null {
  if (lines.length < 2) return null;

  // Detect and skip header row
  const firstCols = parseCSVFields(lines[0]);
  const startIdx = isBackupHeaderRow(firstCols) ? 1 : 0;

  // Check first few data lines for backup format indicators
  const samplesToCheck = Math.min(10, lines.length - startIdx);
  let backupHits = 0;

  for (let i = startIdx; i < startIdx + samplesToCheck; i++) {
    const cols = parseCSVFields(lines[i]);
    if (cols.length < 10) continue;

    const direction = stripAccents(cols[3]?.trim() || '');
    const dateStr = cols[1]?.trim();

    if (
      (direction === 'Entrante' || direction === 'Saliente' || direction === 'Notificacion') &&
      dateStr.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    ) {
      backupHits++;
    }
  }

  if (backupHits < 3 && backupHits < samplesToCheck * 0.5) return null;

  const result: string[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const cols = parseCSVFields(lines[i]);
    if (cols.length < 10) continue;

    const direction = stripAccents(cols[3]?.trim() || '');
    // Skip system notifications
    if (direction === 'Notificacion') continue;

    const date = cols[1]?.trim() || '';
    const contactName = cols[5]?.trim();
    const message = cols[8]?.trim();
    const mediaType = cols[10]?.trim();

    let sender: string;
    if (direction === 'Saliente') {
      sender = 'Yo';
    } else {
      sender = contactName || cols[4]?.trim() || 'Desconocido';
    }

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

  const txtFiles = Object.keys(zip.files).filter(
    name => name.endsWith('.txt') && !zip.files[name].dir
  );

  if (txtFiles.length === 0) {
    throw new Error('No se encontró ningún archivo .txt dentro del ZIP');
  }

  const chatFile = txtFiles.find(n => n.toLowerCase().includes('chat')) || txtFiles[0];
  return zip.files[chatFile].async('string');
}

// ── Backup CSV: parse by chat ────────────────────────────────────────────────

/**
 * Parses a WhatsApp backup CSV (12-column format) and groups messages by chat name (Col 0).
 * Returns an array of ParsedBackupChat with speaker counts, my message count, and group detection.
 */
export function parseBackupCSVByChat(
  csvText: string,
  myIdentifiers: string[] = []
): ParsedBackupChat[] {
  const lines = csvText.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const firstCols = parseCSVFields(lines[0]);
  const startIdx = isBackupHeaderRow(firstCols) ? 1 : 0;

  // Validate it's actually a backup CSV by sampling
  const samplesToCheck = Math.min(10, lines.length - startIdx);
  let backupHits = 0;
  for (let i = startIdx; i < startIdx + samplesToCheck; i++) {
    const cols = parseCSVFields(lines[i]);
    if (cols.length < 10) continue;
    const direction = stripAccents(cols[3]?.trim() || '');
    const dateStr = cols[1]?.trim();
    if (
      (direction === 'Entrante' || direction === 'Saliente' || direction === 'Notificacion') &&
      dateStr.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    ) {
      backupHits++;
    }
  }
  if (backupHits < 3 && backupHits < samplesToCheck * 0.5) return [];

  const myIds = myIdentifiers.map(id => id.toLowerCase().trim());
  const chatMap = new Map<string, { speakers: Map<string, number>; myMessages: number }>();

  for (let i = startIdx; i < lines.length; i++) {
    const cols = parseCSVFields(lines[i]);
    if (cols.length < 10) continue;

    const chatName = cols[0]?.trim() || '(sin nombre)';
    const direction = stripAccents(cols[3]?.trim() || '');

    if (direction === 'Notificacion') continue;

    const contactName = cols[5]?.trim();
    const message = cols[8]?.trim();
    const mediaType = cols[10]?.trim();

    if (!message && !mediaType) continue;

    if (!chatMap.has(chatName)) {
      chatMap.set(chatName, { speakers: new Map(), myMessages: 0 });
    }
    const chat = chatMap.get(chatName)!;

    if (direction === 'Saliente') {
      chat.myMessages++;
    } else {
      const sender = contactName || cols[4]?.trim() || 'Desconocido';
      if (myIds.length > 0 && myIds.includes(sender.toLowerCase().trim())) {
        chat.myMessages++;
      } else {
        chat.speakers.set(sender, (chat.speakers.get(sender) || 0) + 1);
      }
    }
  }

  const result: ParsedBackupChat[] = [];
  chatMap.forEach((data, chatName) => {
    const uniqueSpeakers = data.speakers.size;
    const isGroup = uniqueSpeakers >= 2;
    const totalMessages = Array.from(data.speakers.values()).reduce((a, b) => a + b, 0) + data.myMessages;

    result.push({
      chatName,
      speakers: data.speakers,
      myMessages: data.myMessages,
      totalMessages,
      isGroup,
    });
  });

  result.sort((a, b) => {
    if (a.isGroup !== b.isGroup) return a.isGroup ? -1 : 1;
    return b.totalMessages - a.totalMessages;
  });

  return result;
}

/**
 * Extracts individual messages from a WhatsApp backup CSV for a specific chat.
 * Used to store message content for RAG analysis.
 */
/**
 * Extracts individual messages from a WhatsApp .txt export file.
 * Supports formats:
 *   [DD/MM/YY, HH:MM:SS] Name: message
 *   DD/MM/YYYY, HH:MM - Name: message
 *   And variants with AM/PM, different separators, etc.
 */
export function extractMessagesFromWhatsAppTxt(
  text: string,
  chatName: string,
  myIdentifiers: string[] = []
): ParsedMessage[] {
  const lines = text.split('\n');
  const myIds = myIdentifiers.map(id => id.toLowerCase().trim());
  const messages: ParsedMessage[] = [];

  // Regex for WhatsApp message lines - two main formats:
  // Format 1: [DD/MM/YY, HH:MM:SS] Name: text
  // Format 2: DD/MM/YYYY, HH:MM - Name: text
  const msgRegex = /^(?:\[(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}),?\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:AM|PM|a\.\s?m\.|p\.\s?m\.)?)?)\]\s*(.+?):\s([\s\S]*)$|^(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}),?\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:AM|PM|a\.\s?m\.|p\.\s?m\.)?)?)\s*[-–]\s*(.+?):\s([\s\S]*)$)/i;

  // System message patterns to discard
  const systemPatterns = [
    /los mensajes y las llamadas están cifrados/i,
    /messages and calls are end-to-end encrypted/i,
    /cambió el asunto/i, /changed the subject/i,
    /cambió el ícono/i, /changed this group/i,
    /se unió usando/i, /joined using/i,
    /salió del grupo/i, /left the group/i, /left$/i,
    /fue añadido/i, /was added/i, /added you/i,
    /creó el grupo/i, /created group/i,
    /cambió la descripción/i, /changed the description/i,
    /ahora es administrador/i, /is now an admin/i,
    /ya no es administrador/i, /is no longer an admin/i,
    /eliminó este mensaje/i, /deleted this message/i,
    /número cambió/i, /number changed/i,
    /Se eliminó este mensaje/i, /This message was deleted/i,
    /tu código de seguridad/i, /security code changed/i,
  ];

  // Media patterns for classification
  const mediaPatterns: [RegExp, string][] = [
    [/imagen omitida|image omitted/i, 'media'],
    [/video omitido|video omitted/i, 'media'],
    [/sticker omitido|sticker omitted/i, 'media'],
    [/GIF omitido|GIF omitted/i, 'media'],
    [/audio omitido|audio omitted/i, 'audio'],
    [/documento omitido|document omitted/i, 'document'],
    [/contacto omitido|contact card omitted/i, 'document'],
    [/ubicación:/i, 'link'],
  ];
  const urlRegex = /https?:\/\/[^\s]+/;

  function classifyContent(content: string): string {
    for (const [pattern, type] of mediaPatterns) {
      if (pattern.test(content)) return type;
    }
    if (urlRegex.test(content)) return 'link';
    return 'text';
  }

  function parseDateToISO(datePart: string, timePart: string): string | null {
    try {
      const cleanDate = datePart.replace(/[\-\.]/g, '/');
      const parts = cleanDate.split('/');
      if (parts.length !== 3) return null;

      let day = parseInt(parts[0], 10);
      let month = parseInt(parts[1], 10);
      let year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;

      let cleanTime = timePart.trim();
      let hours = 0, minutes = 0, seconds = 0;
      const isPM = /PM|p\.\s?m\./i.test(cleanTime);
      const isAM = /AM|a\.\s?m\./i.test(cleanTime);
      cleanTime = cleanTime.replace(/\s*(AM|PM|a\.\s?m\.|p\.\s?m\.)\s*/gi, '').trim();
      const timeParts = cleanTime.split(':');
      hours = parseInt(timeParts[0], 10);
      minutes = parseInt(timeParts[1], 10);
      if (timeParts[2]) seconds = parseInt(timeParts[2], 10);

      if (isPM && hours < 12) hours += 12;
      if (isAM && hours === 12) hours = 0;

      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    } catch {
      return null;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(msgRegex);

    if (match) {
      // Extract from either format group
      const datePart = match[1] || match[5];
      const timePart = match[2] || match[6];
      const sender = (match[3] || match[7] || '').trim();
      const content = (match[4] || match[8] || '').trim();

      // Skip phone-number-only senders and system messages
      if (!sender || sender.match(/^\+?\d[\d\s]+$/)) continue;

      const isSystem = systemPatterns.some(p => p.test(content)) || systemPatterns.some(p => p.test(sender));
      if (isSystem) continue;

      const messageDate = parseDateToISO(datePart, timePart);
      const isMe = myIds.length > 0 && myIds.includes(sender.toLowerCase().trim());

      messages.push({
        chatName,
        sender: isMe ? 'Yo' : sender,
        content,
        messageDate,
        direction: isMe ? 'outgoing' : 'incoming',
      });
    } else if (messages.length > 0 && line.trim()) {
      // Multi-line message: append to previous message
      messages[messages.length - 1].content += '\n' + line;
    }
  }

  return messages;
}

export function extractMessagesFromBackupCSV(
  csvText: string,
  chatNameFilter: string | null,
  myIdentifiers: string[] = []
): ParsedMessage[] {
  const lines = csvText.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const firstCols = parseCSVFields(lines[0]);
  const startIdx = isBackupHeaderRow(firstCols) ? 1 : 0;
  const myIds = myIdentifiers.map(id => id.toLowerCase().trim());
  const messages: ParsedMessage[] = [];

  for (let i = startIdx; i < lines.length; i++) {
    const cols = parseCSVFields(lines[i]);
    if (cols.length < 10) continue;

    const chatName = cols[0]?.trim() || '(sin nombre)';
    if (chatNameFilter && chatName !== chatNameFilter) continue;

    const direction = stripAccents(cols[3]?.trim() || '');
    if (direction === 'Notificacion') continue;

    const dateStr = cols[1]?.trim() || null;
    const contactName = cols[5]?.trim();
    const message = cols[8]?.trim();
    const mediaType = cols[10]?.trim();

    let content = message;
    if (!content && mediaType) content = `[${mediaType}]`;
    if (!content) continue;

    const isOutgoing = direction === 'Saliente';
    let sender: string;
    if (isOutgoing) {
      sender = 'Yo';
    } else {
      sender = contactName || cols[4]?.trim() || 'Desconocido';
      if (myIds.length > 0 && myIds.includes(sender.toLowerCase().trim())) {
        sender = 'Yo';
      }
    }

    messages.push({
      chatName,
      sender,
      content,
      messageDate: dateStr,
      direction: sender === 'Yo' ? 'outgoing' : 'incoming',
    });
  }

  return messages;
}
