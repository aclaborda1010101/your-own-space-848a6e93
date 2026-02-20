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
  // Must contain at least one letter (any latin alphabet with accents)
  if (!/[a-zA-ZáéíóúÁÉÍÓÚñÑàèìòùüäëïöüçÀÈÌÒÙÜÄËÏÖÇ]/i.test(trimmed)) return false;
  // Cannot be just a formatted phone number
  if (/^\+?[\d\s\(\)\-\.]+$/.test(trimmed)) return false;
  return true;
}
