import * as XLSX from 'xlsx';

/**
 * Converts a WhatsApp backup XLSX file (12-column format) to CSV text
 * compatible with the existing backup CSV parsers.
 */
export async function convertXlsxToCSVText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  
  // Convert to array of arrays
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (rows.length === 0) return '';

  // Build CSV text - escape fields with commas/quotes
  return rows.map(row =>
    row.map((cell: any) => {
      const str = String(cell ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  ).join('\n');
}

/**
 * Converts a contacts XLSX file to CSV text for parseContactsCSV.
 */
export async function convertContactsXlsxToCSVText(file: File): Promise<string> {
  return convertXlsxToCSVText(file); // Same logic, just CSV output
}
