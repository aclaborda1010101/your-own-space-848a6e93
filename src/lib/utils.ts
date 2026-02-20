import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Validates that a contact name is a real name (not a phone number, emoji, or symbol).
 * Returns true if the name contains at least one letter and is not just a formatted phone number.
 */
export function isValidContactName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 2) return false;
  // Strip invisible unicode chars (zero-width spaces, RTL marks, etc.)
  const visible = trimmed.replace(/[\u200B-\u200F\u202A-\u202E\uFEFF\u00AD]/g, '');
  // Must contain at least 2 basic latin letters (excludes unicode-art, emoji-only)
  const latinLetters = visible.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑàèìòùüäëïöüçÀÈÌÒÙÜÄËÏÖÇ]/g, '');
  if (latinLetters.length < 2) return false;
  // Cannot be just a formatted phone number
  if (/^\+?[\d\s\(\)\-\.]+$/.test(visible)) return false;
  // Reject HTML/script injection
  if (/<\/?script/i.test(visible)) return false;
  // Reject names starting with & (VCF encoding artifacts)
  if (/^&/.test(visible)) return false;
  // Reject measurement/numeric patterns like "30cm x 30cm", "4 rpm**"
  if (/^\d+\s*(cm|rpm|de\s|a\s\d)/i.test(visible)) return false;
  if (/\*\*\)?\s*$/.test(visible)) return false;
  // Reject common system names
  if (['tú', 'whatsapp', 'tu'].includes(visible.toLowerCase())) return false;
  return true;
}
