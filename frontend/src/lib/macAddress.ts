/**
 * Normalizes a MAC address or station ID for comparison.
 * Converts to uppercase and removes all non-alphanumeric characters
 * (strips colons, hyphens, and other separators).
 *
 * Examples: "AA:BB:CC:DD:EE:FF" → "AABBCCDDEEFF"
 *           "aa-bb-cc-dd-ee-ff" → "AABBCCDDEEFF"
 */
export function normalizeMac(mac: string): string {
  return mac.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
