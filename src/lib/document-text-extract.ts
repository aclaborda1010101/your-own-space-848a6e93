import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';

// Disable external worker — parse on main thread (reliable in Vite/preview)
pdfjsLib.GlobalWorkerOptions.workerSrc = "";

export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;
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
  const matches = xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
  const text = matches
    .map(m => m.replace(/<[^>]+>/g, ''))
    .join('');
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
  return { text: await file.text(), type: 'document' };
}
