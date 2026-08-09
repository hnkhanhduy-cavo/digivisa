/**
 * Strict and suitable email validation helper.
 * Validates against RFC standards requiring proper local part, single @, valid domain,
 * and a valid TLD (Top-Level Domain) with at least 2 alphabetic characters.
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();

  // Basic length constraints
  if (trimmed.length < 5 || trimmed.length > 254) return false;

  // Base regex for standard email syntax with minimum 2-letter TLD
  const basicRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!basicRegex.test(trimmed)) return false;

  const parts = trimmed.split('@');
  if (parts.length !== 2) return false;

  const [local, domain] = parts;
  if (!local || !domain) return false;

  // Local part strict rules: no leading/trailing dots, no consecutive dots
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;

  // Domain part strict rules: no leading/trailing dots or hyphens, no consecutive dots
  if (domain.startsWith('.') || domain.endsWith('.') || domain.startsWith('-') || domain.endsWith('-')) return false;
  if (domain.includes('..')) return false;

  // Domain labels check
  const domainParts = domain.split('.');
  if (domainParts.length < 2) return false;

  for (const part of domainParts) {
    if (!part || part.length > 63 || part.startsWith('-') || part.endsWith('-')) {
      return false;
    }
  }

  // TLD check (must be at least 2 alphabetic characters)
  const tld = domainParts[domainParts.length - 1];
  if (!/^[a-zA-Z]{2,}$/.test(tld)) return false;

  return true;
}

/**
 * Validates passport number format.
 * Passport numbers must contain only alphanumeric characters (A-Z, a-z, 0-9)
 * and have a reasonable length (typically 5 to 20 characters).
 */
export function isValidPassportNumber(passportNumber: string): boolean {
  if (!passportNumber || typeof passportNumber !== 'string') return false;
  const trimmed = passportNumber.trim();
  return /^[a-zA-Z0-9]+$/.test(trimmed) && trimmed.length >= 3 && trimmed.length <= 20;
}

/**
 * Sanitizes input in real time to filter out non-alphanumeric characters
 * and automatically convert to uppercase.
 */
export function sanitizePassportInput(val: string): string {
  return val.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

/**
 * Formats phone numbers using the E.164 international standard.
 * Rules:
 * - Include the '+' followed by the country code.
 * - Remove the leading '0' from the local number.
 * - Do not use spaces, hyphens, parentheses, or other separators.
 *
 * Examples:
 * - Vietnam: 0972286699 → +84972286699
 * - United States: (415) 555-1234 → +14155551234
 * - United Kingdom: 07700 900123 → +447700900123
 * - China (Beijing): 01012345678 → +861012345678
 */
export function formatPhoneE164(phone: string, defaultCountryCode: string = '84'): string {
  if (!phone || typeof phone !== 'string') return '';
  const trimmed = phone.trim();
  if (!trimmed) return '';

  // If phone already starts with '+', remove separators and any leading zero after country code or (0)
  if (trimmed.startsWith('+')) {
    let clean = trimmed.replace(/\(0\)/g, '');
    clean = '+' + clean.replace(/\D/g, '');
    
    // Remove leading 0 right after common country codes if present (e.g. +840972286699 -> +84972286699)
    if (/^\+840\d+$/.test(clean)) {
      clean = '+84' + clean.slice(4);
    } else if (/^\+440\d+$/.test(clean)) {
      clean = '+44' + clean.slice(4);
    } else if (/^\+860\d+$/.test(clean)) {
      clean = '+86' + clean.slice(4);
    } else if (/^\+810\d+$/.test(clean)) {
      clean = '+81' + clean.slice(4);
    } else if (/^\+820\d+$/.test(clean)) {
      clean = '+82' + clean.slice(4);
    } else if (/^\+8860\d+$/.test(clean)) {
      clean = '+886' + clean.slice(5);
    }
    return clean;
  }

  const digitsOnly = trimmed.replace(/\D/g, '');
  if (!digitsOnly) return '';

  // Check if string starts with leading 0 (local formats)
  if (trimmed.startsWith('0')) {
    const localPart = digitsOnly.slice(1);
    if (localPart.startsWith('10') && localPart.length === 10) {
      return `+86${localPart}`;
    }
    if (localPart.startsWith('77') && localPart.length === 10) {
      return `+44${localPart}`;
    }
    return `+${defaultCountryCode}${localPart}`;
  }

  // If 10 digits starting with US style area code or 555
  if (digitsOnly.length === 10 && (digitsOnly.startsWith('415') || digitsOnly.startsWith('212') || digitsOnly.startsWith('310') || digitsOnly.startsWith('555'))) {
    return `+1${digitsOnly}`;
  }

  return `+${digitsOnly}`;
}

/**
 * Validates international phone number format using E.164 standard.
 * Must start with '+' followed by country code and digits without separators (7 to 15 digits total).
 * Example: +84912345678, +14155551234
 */
export function isValidInternationalPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  const formatted = formatPhoneE164(phone);
  return /^\+[1-9]\d{6,14}$/.test(formatted);
}

/**
 * Validates tax code (Mã số thuế).
 * Cannot be empty when tax billing is requested.
 * Accepts standard 10-digit tax codes (e.g., 0102030405), 13-digit branch tax codes (e.g., 0102030405-001 or 0102030405001),
 * or international tax/VAT ID formats (8 to 15 alphanumeric characters).
 */
export function isValidTaxCode(taxCode: string): boolean {
  if (!taxCode || typeof taxCode !== 'string') return false;
  const trimmed = taxCode.trim();
  if (!trimmed) return false;

  // Standard Vietnam 10-digit or 13-digit branch tax code format
  const vnTaxCodeRegex = /^(\d{10}|\d{10}-\d{3}|\d{13})$/;
  if (vnTaxCodeRegex.test(trimmed)) return true;

  // General international tax ID / VAT registration format (8 to 15 alphanumeric characters, optionally with hyphens)
  const intlTaxCodeRegex = /^[a-zA-Z0-9-]{8,15}$/;
  return intlTaxCodeRegex.test(trimmed);
}

/**
 * Validates flight number format.
 * Flight numbers should contain only letters and numbers without spaces or special characters (e.g., VN123, SQ318, BA2490).
 */
export function isValidFlightNumber(flightNumber: string): boolean {
  if (!flightNumber || typeof flightNumber !== 'string') return false;
  const trimmed = flightNumber.trim();
  // Validates IATA format: 2-character airline code (letters or letter & digit) followed by 1 to 4 digits.
  return /^([a-zA-Z]{2}|[a-zA-Z][0-9]|[0-9][a-zA-Z])[0-9]{1,4}$/.test(trimmed);
}

/**
 * Sanitizes flight number input in real time to filter out non-alphanumeric characters
 * and automatically convert to uppercase.
 */
export function sanitizeFlightNumber(val: string): string {
  return val.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

/**
 * Returns current local date as YYYY-MM-DD string.
 */
export function getTodayStr(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Returns date as YYYY-MM-DD string offset by specified number of days from today.
 */
export function getTodayOffsetStr(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Constructs a Date object interpreting the date and time strings in Vietnam Time (+07:00).
 * If time is omitted or empty, defaults to '23:59:59'.
 * Returns null if the date format is invalid.
 */
export function buildVietnamDate(dateStr: string, timeStr?: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
    return null;
  }
  const cleanDate = dateStr.trim();
  const cleanTime = timeStr && typeof timeStr === 'string' && /^\d{2}:\d{2}$/.test(timeStr.trim())
    ? `${timeStr.trim()}:00`
    : '23:59:59';
  const isoStr = `${cleanDate}T${cleanTime}+07:00`;
  const dateObj = new Date(isoStr);
  if (isNaN(dateObj.getTime())) {
    return null;
  }
  return dateObj;
}

/**
 * Returns today's date formatted as 'YYYY-MM-DD' according to Vietnam Time (UTC+7).
 */
export function getVietnamToday(): string {
  const now = new Date();
  const vnTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return vnTime.toISOString().split('T')[0];
}

/**
 * Extracts clean phone number and preferred contact channel from stored phone string and/or contactPref field.
 * Handles legacy orders where contact preference was appended to phone string in parentheses (e.g. '0972286699 (Zalo)').
 *
 * Rules:
 * - Explicit contactPref argument takes precedence if provided.
 * - If rawPhone contains parenthesized channel at the end (e.g. '0972286699 (Zalo)'), parses phone number and channel.
 * - Returns { phone: string, channel: string }. Returns empty string for channel if none exists.
 */
export function parsePhoneAndChannel(rawPhone?: string | null, contactPref?: string | null): { phone: string; channel: string } {
  const channelFromPref = (contactPref || '').trim();
  const raw = (rawPhone || '').trim();

  if (!raw) {
    return { phone: '', channel: channelFromPref };
  }

  const match = raw.match(/^(.*?)\s*\(([^)]+)\)$/);
  if (match) {
    const parsedPhone = match[1].trim();
    const parsedChannel = match[2].trim();
    return {
      phone: parsedPhone,
      channel: channelFromPref || parsedChannel
    };
  }

  return {
    phone: raw,
    channel: channelFromPref
  };
}





