/**
 * Formats a phone number to E.164 format required by Supabase
 * E.164 format: +[country code][number] (e.g., +1234567890)
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // If it already starts with +, return as is (assuming it's already formatted)
  if (phone.trim().startsWith('+')) {
    return phone.trim();
  }

  // If it starts with 0, remove the leading 0 (common in some countries)
  const cleaned = digits.startsWith('0') ? digits.slice(1) : digits;

  // If it doesn't start with a country code, try to detect
  // For US/Canada numbers (10 digits), add +1
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }

  // For Indian numbers (10 digits starting with 6-9), add +91
  if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) {
    return `+91${cleaned}`;
  }

  // If it already has country code (11+ digits), add +
  if (cleaned.length >= 10) {
    return `+${cleaned}`;
  }

  // Return with + prefix as fallback
  return `+${cleaned}`;
}

/**
 * Validates if a phone number is in a valid format
 */
export function isValidPhoneNumber(phone: string): boolean {
  const formatted = formatPhoneNumber(phone);
  // E.164 format: + followed by 1-15 digits
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(formatted);
}

/**
 * Normalizes phone number to consistent format (without + prefix)
 * This is used for storing in database to ensure consistent queries
 * @param phone - Phone number in any format (with or without +)
 * @returns Normalized phone number (e.g., 917539944795)
 */
export function normalizePhoneNumber(phone: string): string {
  // Get the E.164 formatted version first
  const formatted = formatPhoneNumber(phone);
  // Remove the + prefix to get normalized format
  return formatted.replace(/^\+/, '');
}

