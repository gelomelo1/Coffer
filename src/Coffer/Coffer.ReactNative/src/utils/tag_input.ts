/** Free-text tag field helpers ("#austria #travel"): tags are stored lowercase, without '#'. */

/** Tags in the field, in order, lowercase, without '#' and without duplicates. */
export function parseTags(text: string): string[] {
  const seen = new Set<string>();
  for (const raw of text.split(/\s+/)) {
    const tag = raw.replace(/^#+/, "").toLowerCase();
    if (tag.length > 0) seen.add(tag);
  }
  return [...seen];
}

/** The tag being typed at the end of the field (no trailing space yet), or null. */
export function currentTagToken(text: string): string | null {
  if (text.length === 0 || /\s$/.test(text)) return null;
  const last = text.split(/\s+/).pop() ?? "";
  const token = last.replace(/^#+/, "").toLowerCase();
  return token.length > 0 ? token : null;
}

/** Replaces the tag being typed with `tag` (or appends it) and leaves the caret ready for the next one. */
export function completeTag(text: string, tag: string): string {
  const head = /\s$/.test(text) || text.length === 0 ? text : text.replace(/\S+$/, "");
  return `${head}#${tag} `;
}
