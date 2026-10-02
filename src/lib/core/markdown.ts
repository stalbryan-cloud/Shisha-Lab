/**
 * Minimal, safe Markdown → HTML renderer for comments, reviews and forum posts.
 *
 * Security model: ALL input is HTML-escaped first, then a small whitelist of constructs is re-introduced by this
 * file itself. There is no path by which user-supplied tags, attributes or URL schemes reach the output.
 * Supported: **bold**, *italic*, `code`, fenced code blocks, [text](http(s)/mailto url), bare http(s) URLs,
 * > quotes, - / * / 1. lists, paragraphs, line breaks, @mentions (plain text styling only).
 */

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ESC[c]);
const unescapeHtml = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** Only http(s) and mailto are allowed. Anything else (javascript:, data:, vbscript:, …) is rejected. */
export function safeUrl(raw: string): string | null {
  const url = raw.trim().replace(/[\u0000-\u001f\u007f\s]+/g, '');
  if (/^https?:\/\/[^\s]+$/i.test(url) || /^mailto:[^\s]+$/i.test(url)) {
    return url.replace(/"/g, '%22').replace(/'/g, '%27').replace(/</g, '%3C').replace(/>/g, '%3E');
  }
  return null;
}

function inline(escaped: string): string {
  let s = escaped;
  // inline code first, protecting its contents from further formatting
  const codes: string[] = [];
  s = s.replace(/`([^`\n]+)`/g, (_m, c: string) => { codes.push(`<code>${c}</code>`); return `\u0000${codes.length - 1}\u0000`; });
  // [text](url) — url was escaped, so un-escape only &amp; for matching purposes
  s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_m, text: string, href: string) => {
    const u = safeUrl(unescapeHtml(href));
    return u ? `<a href="${escapeHtml(u)}" rel="nofollow noopener ugc" target="_blank">${text}</a>` : `${text} (${href})`;
  });
  // bare URLs (not already inside an href)
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/gi, (_m, pre: string, href: string) => {
    const u = safeUrl(unescapeHtml(href));
    return u ? `${pre}<a href="${escapeHtml(u)}" rel="nofollow noopener ugc" target="_blank">${href}</a>` : `${pre}${href}`;
  });
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  s = s.replace(/(^|[\s(])@([a-z0-9_]{3,24})\b/g, '$1<span class="mention">@$2</span>');
  s = s.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => codes[Number(i)]);
  return s;
}

export function renderMarkdown(src: string, opts: { maxLength?: number } = {}): string {
  const max = opts.maxLength ?? 20000;
  const text = src.slice(0, max).replace(/\r\n?/g, '\n');
  const lines = escapeHtml(text).split('\n');
  const out: string[] = [];
  let i = 0;

  const flushPara = (buf: string[]) => { if (buf.length) out.push(`<p>${buf.map(inline).join('<br>')}</p>`); buf.length = 0; };
  let para: string[] = [];

  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {                                   // fenced code
      flushPara(para);
      const code: string[] = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i++; out.push(`<pre><code>${code.join('\n')}</code></pre>`); continue;
    }
    if (/^&gt;\s?/.test(line)) {                                // blockquote (> is escaped to &gt;)
      flushPara(para);
      const q: string[] = [];
      while (i < lines.length && /^&gt;\s?/.test(lines[i])) q.push(lines[i++].replace(/^&gt;\s?/, ''));
      out.push(`<blockquote>${q.map(inline).join('<br>')}</blockquote>`); continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {                             // unordered list
      flushPara(para);
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, ''));
      out.push(`<ul>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</ul>`); continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {                          // ordered list
      flushPara(para);
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ''));
      out.push(`<ol>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</ol>`); continue;
    }
    if (line.trim() === '') { flushPara(para); i++; continue; }
    para.push(line); i++;
  }
  flushPara(para);
  return out.join('\n');
}

/** Plain-text excerpt for notifications / meta descriptions. */
export function stripMarkdown(src: string, max = 160): string {
  const t = src.replace(/```[\s\S]*?```/g, ' ').replace(/[`*_>#-]/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
}

/** Extract unique @mentions (lowercase usernames) from raw text. */
export function extractMentions(src: string): string[] {
  return [...new Set([...src.matchAll(/(?:^|[\s(])@([a-z0-9_]{3,24})\b/gi)].map((m) => m[1].toLowerCase()))];
}
