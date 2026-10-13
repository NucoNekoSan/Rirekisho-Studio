/** Word bookmarks and Excel defined names share a short, stable identifier. */
export function officeAnchor(key: string): string {
  let first = 2166136261;
  let second = 5381;
  for (const char of key) {
    const code = char.charCodeAt(0);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second, 33) ^ code;
  }
  return `rs_${(first >>> 0).toString(36)}_${(second >>> 0).toString(36)}`;
}
