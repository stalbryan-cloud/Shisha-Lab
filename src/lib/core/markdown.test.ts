import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown, safeUrl, extractMentions, stripMarkdown } from './markdown.ts';

/**
 * Structural check: after removing the tags this renderer is allowed to emit, no angle bracket may remain, and
 * every <a> may only carry href (http/https/mailto), rel and target.
 */
const forbidden = (html: string) => {
  const allowedTag = /<\/?(p|br|strong|em|code|pre|ul|ol|li|blockquote)>|<span class="mention">|<\/span>|<\/a>/g;
  const anchors = [...html.matchAll(/<a ([^>]*)>/g)];
  for (const a of anchors) {
    assert.match(a[1], /^href="(https?:\/\/|mailto:)[^"]*" rel="nofollow noopener ugc" target="_blank"$/, `bad anchor: ${a[0]}`);
  }
  const rest = html.replace(/<a [^>]*>/g, '').replace(allowedTag, '');
  assert.ok(!/[<>]/.test(rest), `unexpected markup left: ${rest}`);
};

test('raw HTML is escaped, not rendered', () => {
  const html = renderMarkdown('<script>alert(1)</script><img src=x onerror=alert(1)>');
  forbidden(html);
  assert.ok(html.includes('&lt;script&gt;'));
});

test('javascript: and data: links are neutralised', () => {
  for (const bad of ['[x](javascript:alert(1))', '[x](JaVaScRiPt:alert(1))', '[x](data:text/html;base64,AAAA)', '[x](vbscript:msgbox(1))', '[x](  javascript:alert(1))']) {
    const html = renderMarkdown(bad);
    assert.ok(!/<a /.test(html), `${bad} → ${html}`);
    forbidden(html);
  }
});

test('attribute-breaking payloads in URLs cannot inject attributes', () => {
  const html = renderMarkdown('[x](https://a.test/"onmouseover="alert(1))');
  forbidden(html);
  assert.ok(!/<a [^>]*\sonmouseover=/i.test(html));
  assert.ok(!/href="[^"]*"[^>]*"/.test(html.replace(/ rel="[^"]*" target="[^"]*"/, '')) );
});

test('safe links get rel and target', () => {
  const html = renderMarkdown('[docs](https://example.com/a?b=1&c=2) and https://example.org');
  assert.ok(html.includes('rel="nofollow noopener ugc"'));
  assert.ok(html.includes('href="https://example.com/a?b=1&amp;c=2"'));
  assert.ok(html.includes('href="https://example.org"'));
});

test('basic formatting', () => {
  const html = renderMarkdown('**bold** and *italic* and `code`\n\n- a\n- b\n\n1. one\n2. two\n\n> quoted');
  assert.ok(html.includes('<strong>bold</strong>'));
  assert.ok(html.includes('<em>italic</em>'));
  assert.ok(html.includes('<code>code</code>'));
  assert.ok(html.includes('<ul><li>a</li><li>b</li></ul>'));
  assert.ok(html.includes('<ol><li>one</li><li>two</li></ol>'));
  assert.ok(html.includes('<blockquote>quoted</blockquote>'));
});

test('code spans/blocks do not interpret markdown or html', () => {
  const html = renderMarkdown('`<b>**x**</b>`\n\n```\n<script>1</script>\n```');
  forbidden(html);
  assert.ok(html.includes('<code>&lt;b&gt;**x**&lt;/b&gt;</code>'));
});

test('safeUrl', () => {
  assert.equal(safeUrl('https://ok.test/x'), 'https://ok.test/x');
  assert.equal(safeUrl('ftp://x'), null);
  assert.equal(safeUrl('//evil.test'), null);
  assert.equal(safeUrl('java\nscript:alert(1)'), null);
});

test('mentions and excerpts', () => {
  assert.deepEqual(extractMentions('hi @Leafwright and @leafwright, also @ab and (@moltenmill)'), ['leafwright', 'moltenmill']);
  assert.equal(stripMarkdown('**Hello** [world](https://x.test)'), 'Hello world');
});

test('output length is capped', () => {
  assert.ok(renderMarkdown('a'.repeat(50000), { maxLength: 100 }).length < 200);
});
