import type { ParsedMessage } from './whatsapp-file-extract';

const SEPARATOR_REGEX = /^-{4,}\s*$/;
const HEADER_REGEX = /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(from|to|notification)\s+(.+?)(?:\s+\([\+\d]+\))?\s*-\s*.+$/i;

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
      // Check if within next 3 lines there's a from/to header
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        if (HEADER_REGEX.test(lines[j].trim())) {
          headerAfterSep++;
          break;
        }
      }
    }
  }

  return separatorCount >= 3 && headerAfterSep >= 3;
}

/**
 * Parses the block-format TXT export into ParsedMessage[].
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
    // Find separator line
    if (!SEPARATOR_REGEX.test(lines[i].trim())) {
      i++;
      continue;
    }
    i++; // skip separator

    // Next line should be chat/contact name
    if (i >= lines.length) break;
    const blockChatName = lines[i].trim();
    i++;

    // Next line should be the header with date/direction
    if (i >= lines.length) break;
    const headerMatch = lines[i].trim().match(HEADER_REGEX);
    if (!headerMatch) {
      // Not a valid block, skip
      continue;
    }
    i++;

    const dateStr = headerMatch[1]; // YYYY-MM-DD HH:MM:SS
    const direction = headerMatch[2].toLowerCase(); // from/to/notification
    const contactName = headerMatch[3].trim();

    // Skip notifications
    if (direction === 'notification') {
      // Skip until next separator
      while (i < lines.length && !SEPARATOR_REGEX.test(lines[i].trim())) i++;
      continue;
    }

    // Collect message content until next separator
    const contentLines: string[] = [];
    while (i < lines.length && !SEPARATOR_REGEX.test(lines[i].trim())) {
      contentLines.push(lines[i]);
      i++;
    }

    const content = contentLines.join('\n').trim();
    if (!content) continue;

    const isOutgoing = direction === 'to';
    const isMe = isOutgoing || (myIds.length > 0 && myIds.includes(contactName.toLowerCase().trim()));
    const sender = isMe ? 'Yo' : contactName;

    messages.push({
      chatName: chatName || blockChatName,
      sender,
      content,
      messageDate: dateStr.replace(' ', 'T'),
      direction: isMe ? 'outgoing' : 'incoming',
    });
  }

  return messages;
}
