// ── lib/utils/uuid.ts ─────────────────────────────────────────────────────────
// Safe UUID generation. crypto.randomUUID requires a secure context and
// iOS 15.4+ / Chrome 92+ — on older mobile browsers or plain http:// it is
// undefined and throws. Always use generateId() instead of calling it directly.

export function generateId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  // Fallback: RFC4122 v4 UUID without crypto
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
