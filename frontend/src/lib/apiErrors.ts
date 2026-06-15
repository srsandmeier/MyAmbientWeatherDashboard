/**
 * Parses a raw API error response body into a user-facing message.
 * Handles both plain-text and JSON responses, including 429 rate-limit hints.
 */
export function getApiErrorMessage(raw: string): string {
  // Try to find JSON even if prefixed with non-JSON text
  const jsonStart = raw.indexOf('{');
  const candidate = jsonStart >= 0 ? raw.slice(jsonStart) : raw;
  try {
    const parsed: unknown = JSON.parse(candidate);
    if (typeof parsed === 'object' && parsed !== null) {
      const obj = parsed as Record<string, unknown>;
      // Handle both camelCase and PascalCase message fields
      const message =
        (typeof obj.message === 'string' && obj.message.length > 0 ? obj.message : null) ??
        (typeof obj.Message === 'string' && obj.Message.length > 0 ? obj.Message : null);
      if (message) {
        if (typeof obj.statusCode === 'number' && obj.statusCode === 429) {
          return `${message} Please wait a moment before trying again.`;
        }
        return message;
      }
    }
  } catch {
    // Not JSON — use raw text
  }
  return raw.length > 0 ? raw : 'The server did not return an error message.';
}

/**
 * Returns a safe, user-facing summary of an Error message.
 * Strips internal paths and stack traces; falls back to a generic message.
 */
export function sanitizeErrorForDisplay(message: string | undefined): string {
  if (!message || message.length === 0) {
    return 'An unexpected error occurred. Please try again.';
  }
  // If the message looks like a raw HTTP response body (starts with { or contains stack frames),
  // return a safe generic message instead.
  const looksLikeRawResponse =
    message.startsWith('{') ||
    message.includes(' at ') ||
    message.includes('Exception') ||
    message.length > 200;
  if (looksLikeRawResponse) {
    return 'An unexpected error occurred. Please try again.';
  }
  return message;
}
