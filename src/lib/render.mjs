import MarkdownIt from 'markdown-it';

const md = new MarkdownIt({
  html: true,     // preserve raw inline HTML -> data-figure escape hatch
  linkify: true,
  typographer: false,
});

export function renderMarkdown(body) {
  return md.render(body);
}
