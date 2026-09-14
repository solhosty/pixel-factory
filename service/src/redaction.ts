export const redactCodexText = (value: string) => value
  .replace(/\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g, 'sk-[redacted]')
  .replace(/Bearer\s+[A-Za-z0-9._~+/=-]{16,}/gi, 'Bearer [redacted]');
