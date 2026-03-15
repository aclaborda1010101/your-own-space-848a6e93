import type { ParsedMessage } from './whatsapp-file-extract';
import type { ParsedBackupChat } from './whatsapp-file-extract';

const SEPARATOR_REGEX = /^-{4,}\s*$/;
// Updated: contactName + status suffix is now optional (notifications don't have it)
const HEADER_REGEX = /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(from|to|notification)(?:\s+(.+?)(?:\s+\([\+\d]+\))?\s*-\s*.+)?$/i;

/**
 * Detects if text uses the block format with ---- separators.
 */
export function detectBlockFormat(text: string): boolean {
  const lines = text.split('\n');
  let separatorCount = 0;
  let headerAfterSep = 0;

  for (let i = 0; i < lines.length; i++) {
    if (SEPARATOR_REGEX.test(lines[i].trim())) {
      separatorCount++;
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        if (HEADER_REGEX.test(lines[j].trim())) {
          headerAfterSep++;
          break;
        }
      }
    }
    // Early exit once we have enough evidence
    if (separatorCount >= 5 && headerAfterSep >= 3) return true;
  }

  return separatorCount >= 3 && headerAfterSep >= 3;
}

/**
 * Parses a single block and returns its components, or null if invalid.
 */
function parseBlock(lines: string[], startIndex: number): {
  nextIndex: number;
  chatName: string;
  dateStr: string;
  direction: string;
  contactName: string;
  content: string;
} | null {
  let i = startIndex;

  // Skip separator
  if (i >= lines.length || !SEPARATOR_REGEX.test(lines[i].trim())) return null;
  i++;

  // Chat name line
  if (i >= lines.length) return null;
  const chatName = lines[i].trim();
  i++;

  // Header line
  if (i >= lines.length) return null;
  const headerMatch = lines[i].trim().match(HEADER_REGEX);
  if (!headerMatch) return null;
  i++;

  const dateStr = headerMatch[1];
  const direction = headerMatch[2].toLowerCase();
  const contactName = (headerMatch[3] || '').trim();

  // Collect content until next separator
  const contentLines: string[] = [];
  while (i < lines.length && !SEPARATOR_REGEX.test(lines[i].trim())) {
    contentLines.push(lines[i]);
    i++;
  }

  return {
    nextIndex: i,
    chatName,
    dateStr,
    direction,
    contactName,
    content: contentLines.join('\n').trim(),
  };
}

/**
 * Parses the block-format TXT export into ParsedMessage[].
 * Includes notifications and empty content messages.
 */
export function parseBlockFormatTxt(
  text: string,
  chatName: string,
  myIdentifiers: string[] = []
): ParsedMessage[] {
  const lines = text.split('\n');
  const myIds = myIdentifiers.map(id => id.toLowerCase().trim());
  const messages: ParsedMessage[] = [];

  let i = 0;
  while (i < lines.length) {
    if (!SEPARATOR_REGEX.test(lines[i].trim())) {
      i++;
      continue;
    }

    const block = parseBlock(lines, i);
    if (!block) {
      i++;
      continue;
    }
    i = block.nextIndex;

    if (block.direction === 'notification') {
      messages.push({
        chatName: chatName || block.chatName,
        sender: 'system',
        content: block.content || '[Notificación del sistema]',
        messageDate: block.dateStr.replace(' ', 'T'),
        direction: 'notification',
      });
      continue;
    }

    const isOutgoing = block.direction === 'to';
    const isMe = isOutgoing || (myIds.length > 0 && myIds.includes(block.contactName.toLowerCase().trim()));
    const sender = isMe ? 'Yo' : block.contactName;

    messages.push({
      chatName: chatName || block.chatName,
      sender,
      content: block.content || '[Archivo multimedia]',
      messageDate: block.dateStr.replace(' ', 'T'),
      direction: isMe ? 'outgoing' : 'incoming',
    });
  }

  return messages;
}

/**
 * Parses the block-format TXT and groups messages by chat name.
 * Returns ParsedBackupChat[] compatible with the CSV backup flow.
 */
export function parseBlockFormatByChat(
  text: string,
  myIdentifiers: string[] = []
): ParsedBackupChat[] {
  const allMessages = parseBlockFormatTxt(text, '', myIdentifiers);

  const chatMap = new Map<string, {
    speakers: Map<string, number>;
    myMessages: number;
    totalMessages: number;
  }>();

  for (const msg of allMessages) {
    if (!chatMap.has(msg.chatName)) {
      chatMap.set(msg.chatName, {
        speakers: new Map(),
        myMessages: 0,
        totalMessages: 0,
      });
    }
    const chat = chatMap.get(msg.chatName)!;
    chat.totalMessages++;

    if (msg.direction === 'outgoing') {
      chat.myMessages++;
    } else if (msg.direction === 'incoming' && msg.sender && msg.sender !== 'system') {
      chat.speakers.set(msg.sender, (chat.speakers.get(msg.sender) || 0) + 1);
    }
  }

  const result: ParsedBackupChat[] = [];
  chatMap.forEach((data, cn) => {
    const uniqueSpeakers = data.speakers.size;
    result.push({
      chatName: cn,
      speakers: data.speakers,
      myMessages: data.myMessages,
      totalMessages: data.totalMessages,
      isGroup: uniqueSpeakers >= 2,
    });
  });

  result.sort((a, b) => b.totalMessages - a.totalMessages);
  return result;
}
