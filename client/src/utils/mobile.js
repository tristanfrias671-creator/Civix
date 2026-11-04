// A Philippine mobile number typed into a form (the citizen's report form and the
// staff's Walk-in report): digits only, starting with 09, 11 in all. A pasted
// "+63 917 123 4567" or "917 123 4567" becomes "09171234567".
export const MOBILE_DIGITS = 11;

export function cleanMobile(raw) {
  const digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('63')) return `0${digits.slice(2)}`;
  if (digits.startsWith('9')) return `0${digits}`;
  return digits;
}

// What the box holds after a key press or a paste, given what it holds now: null when
// the change would break the 09 start (the box keeps its number, and a note under it
// says why), else the cleaned number. A 12th digit is ignored rather than pushing out
// the last one.
export function typedMobile(raw, current) {
  const next = cleanMobile(raw);
  if (next !== '' && next !== '0' && !next.startsWith('09')) return null;
  return next.length > MOBILE_DIGITS && current.length >= MOBILE_DIGITS ? current : next.slice(0, MOBILE_DIGITS);
}
