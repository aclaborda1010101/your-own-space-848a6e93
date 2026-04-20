// Parser para el CSV de Contactos de Mac (formato 41 columnas en español).
// Headers esperados (parcial): Nombre, Segundo nombre, Apellidos, Puesto de trabajo,
// Empresa, ..., Teléfono móvil, Teléfono de la casa, Email de la casa, ...,
// Teléfono del trabajo, Email del trabajo, ..., Otro teléfono, Email (otro), Nota.

export interface ParsedMacContact {
  fullName: string;
  organization: string | null;
  title: string | null;
  phones: string[];           // tal cual aparecen (con + y formato)
  phonesNormalized: string[]; // solo dígitos, con prefijo país añadido si falta
  emails: string[];
  notes: string | null;
  birthday: string | null;
}

const DEFAULT_COUNTRY_PREFIX = "34"; // España

export function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  // Quita todo lo que no sea dígito o + inicial
  const cleaned = String(raw).replace(/[^\d+]/g, "");
  if (!cleaned) return null;

  let digits = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;
  // Quita ceros iniciales internacionales tipo "0034..."
  if (digits.startsWith("00")) digits = digits.slice(2);

  // Si tiene 9 dígitos y empieza por 6/7/9 → asume España
  if (/^[679]\d{8}$/.test(digits)) {
    digits = DEFAULT_COUNTRY_PREFIX + digits;
  }

  // Validar mínimo razonable
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

/** Parser CSV simple que respeta comillas y comas internas. */
function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else {
      if (c === ",") {
        out.push(cur);
        cur = "";
      } else if (c === '"') {
        inQuotes = true;
      } else {
        cur += c;
      }
    }
  }
  out.push(cur);
  return out;
}

/** Splittea el CSV completo respetando comillas multilinea. */
function splitCSVRows(text: string): string[] {
  const rows: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      // toggle quote (con escape "")
      if (inQuotes && text[i + 1] === '"') {
        cur += '""';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      cur += c;
    } else if ((c === "\n" || c === "\r") && !inQuotes) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      if (cur.trim().length > 0) rows.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  if (cur.trim().length > 0) rows.push(cur);
  return rows;
}

export function parseMacContactsCSV(text: string): ParsedMacContact[] {
  const rows = splitCSVRows(text);
  if (rows.length < 2) return [];

  const headers = parseCSVLine(rows[0]).map(h => h.trim());
  const idx = (name: string) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase());

  const iNombre = idx("Nombre");
  const iSegundo = idx("Segundo nombre");
  const iApellidos = idx("Apellidos");
  const iPuesto = idx("Puesto de trabajo");
  const iEmpresa = idx("Empresa");
  const iMovil = idx("Teléfono móvil");
  const iCasa = idx("Teléfono de la casa");
  const iTrabajo = idx("Teléfono del trabajo");
  const iOtro = idx("Otro teléfono");
  const iEmailCasa = idx("Email de la casa");
  const iEmailTrabajo = idx("Email del trabajo");
  const iEmailOtro = idx("Email (otro)");
  const iNota = idx("Nota");
  const iCumple = idx("Cumpleaños");

  const result: ParsedMacContact[] = [];

  for (let r = 1; r < rows.length; r++) {
    const cols = parseCSVLine(rows[r]);
    const name = [cols[iNombre], cols[iSegundo], cols[iApellidos]]
      .filter(s => s && s.trim())
      .join(" ")
      .trim();

    const phonesRaw = [
      cols[iMovil],
      cols[iCasa],
      cols[iTrabajo],
      cols[iOtro],
    ].filter(p => p && p.trim());

    const phonesNormalized = Array.from(
      new Set(
        phonesRaw
          .map(normalizePhone)
          .filter((p): p is string => !!p)
      )
    );

    const emails = Array.from(
      new Set(
        [cols[iEmailCasa], cols[iEmailTrabajo], cols[iEmailOtro]]
          .filter(e => e && e.trim())
          .map(e => e.trim().toLowerCase())
      )
    );

    // Saltar filas totalmente vacías
    if (!name && phonesNormalized.length === 0 && emails.length === 0) continue;

    result.push({
      fullName: name || phonesNormalized[0] || emails[0] || "(sin nombre)",
      organization: (cols[iEmpresa] || "").trim() || null,
      title: (cols[iPuesto] || "").trim() || null,
      phones: phonesRaw.map(p => p.trim()),
      phonesNormalized,
      emails,
      notes: (cols[iNota] || "").trim() || null,
      birthday: (cols[iCumple] || "").trim() || null,
    });
  }

  return result;
}
