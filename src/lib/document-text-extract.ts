import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const textParts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item.str).join(' ');
    textParts.push(pageText);
  }
  return textParts.join('\n');
}

export async function extractTextFromDOCX(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  const docXml = zip.file("word/document.xml");
  if (!docXml) throw new Error("No se encontró contenido en el archivo DOCX");
  const xml = await docXml.async("string");
  // Extract text from <w:t> tags
  const matches = xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
  const text = matches
    .map(m => m.replace(/<[^>]+>/g, ''))
    .join('');
  // Split by paragraph markers for readability
  return text.replace(/\s{2,}/g, '\n');
}

export async function extractTextFromFile(file: File): Promise<{ text: string; type: string }> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) {
    return { text: await extractTextFromPDF(file), type: 'document' };
  }
  if (name.endsWith('.docx')) {
    return { text: await extractTextFromDOCX(file), type: 'document' };
  }
  // Fallback: read as text
  return { text: await file.text(), type: 'document' };
}
