/**
 * vCard 3.0/4.0 parser
 * Parses .vcf files and returns structured contact data.
 */

export interface ParsedVCardContact {
  fullName: string;
  firstName: string;
  lastName: string;
  phones: string[];
  emails: string[];
  organization: string;
  title: string;
  address: string;
  notes: string;
  birthday: string;
  raw: Record<string, string>;
}

/**
 * Parse a .vcf file content into an array of contacts.
 * Supports multiple contacts per file (BEGIN:VCARD / END:VCARD).
 */
export function parseVCardFile(content: string): ParsedVCardContact[] {
  const contacts: ParsedVCardContact[] = [];
  const blocks = content.split(/(?=BEGIN:VCARD)/i);

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed.toUpperCase().startsWith('BEGIN:VCARD')) continue;

    const contact = parseVCard(trimmed);
    if (contact && contact.fullName) {
      contacts.push(contact);
    }
  }

  return contacts;
}

function unfoldLines(text: string): string {
  // vCard line folding: lines starting with space/tab are continuations
  return text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
}

function decodeQuotedPrintable(value: string): string {
  return value.replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
    String.fromCharCode(parseInt(hex, 16))
  ).replace(/=\r?\n/g, '');
}

function cleanValue(raw: string): string {
  let val = raw;
  // Handle CHARSET and ENCODING params embedded in value
  if (/QUOTED-PRINTABLE/i.test(val)) {
    val = decodeQuotedPrintable(val);
  }
  // Remove remaining property params prefix (e.g., "TYPE=WORK:")
  return val.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').trim();
}

function parseVCard(block: string): ParsedVCardContact | null {
  const unfolded = unfoldLines(block);
  const lines = unfolded.split(/\r?\n/);
  const raw: Record<string, string> = {};
  const phones: string[] = [];
  const emails: string[] = [];
  let fullName = '';
  let firstName = '';
  let lastName = '';
  let organization = '';
  let title = '';
  let address = '';
  let notes = '';
  let birthday = '';

  for (const line of lines) {
    if (!line.includes(':')) continue;
    const colonIdx = line.indexOf(':');
    const propPart = line.substring(0, colonIdx);
    const valuePart = line.substring(colonIdx + 1);

    // Extract base property name (before any ;PARAM)
    const propName = propPart.split(';')[0].toUpperCase();
    const value = cleanValue(valuePart);

    raw[propPart] = valuePart;

    switch (propName) {
      case 'FN':
        fullName = value;
        break;
      case 'N': {
        const parts = value.split(';');
        lastName = parts[0] || '';
        firstName = parts[1] || '';
        break;
      }
      case 'TEL': {
        const phone = value.replace(/[^\d+\s()-]/g, '').trim();
        if (phone && !phones.includes(phone)) phones.push(phone);
        break;
      }
      case 'EMAIL': {
        const email = value.trim().toLowerCase();
        if (email && !emails.includes(email)) emails.push(email);
        break;
      }
      case 'ORG':
        organization = value.split(';')[0] || '';
        break;
      case 'TITLE':
        title = value;
        break;
      case 'ADR':
        address = value.split(';').filter(Boolean).join(', ');
        break;
      case 'NOTE':
        notes = value;
        break;
      case 'BDAY':
        birthday = value;
        break;
      // PHOTO is intentionally ignored
    }
  }

  // Fallback: if no FN but we have N parts
  if (!fullName && (firstName || lastName)) {
    fullName = `${firstName} ${lastName}`.trim();
  }

  if (!fullName) return null;

  return {
    fullName,
    firstName,
    lastName,
    phones,
    emails,
    organization,
    title,
    address,
    notes,
    birthday,
    raw,
  };
}
