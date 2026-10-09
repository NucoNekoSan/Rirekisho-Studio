const chapters = [
  { id: 'INDEX', label: '目次' },
  { id: '01-introduction', label: '1. はじめに' },
  { id: '02-overview', label: '2. 全体の流れ' },
  { id: '03-input-guide', label: '3. 入力ガイド' },
  { id: '04-accommodation', label: '4. 配慮事項シート' },
  { id: '05-pdf-output', label: '5. 仕上がり確認・保存' },
  { id: '06-save-load', label: '6. 入力データ保存・読込' },
  { id: '07-faq', label: '7. よくある質問' },
  { id: '08-appendix', label: '8. 巻末資料' },
];

const navEl = document.getElementById('nav');
const contentEl = document.getElementById('content');

function buildNav(current) {
  navEl.replaceChildren();
  for (const chapter of chapters) {
    const link = document.createElement('a');
    link.href = `#${chapter.id}`;
    link.textContent = chapter.label;
    if (chapter.id === current) link.className = 'current';
    navEl.appendChild(link);
  }
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function renderInline(value) {
  let text = escapeHtml(value);
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  text = text.replace(/\[([^\]]+)]\(([^)]+)\)/g, (_match, label, href) => {
    const hrefWithoutMarkdown = href.replace(/\.md$/, '');
    const isExternal = /^https?:/.test(hrefWithoutMarkdown);
    const targetAttributes = isExternal ? ' target="_blank" rel="noopener"' : '';
    const finalHref = isExternal ? hrefWithoutMarkdown : `#${hrefWithoutMarkdown}`;
    return `<a href="${finalHref}"${targetAttributes}>${label}</a>`;
  });
  return text;
}

function renderList(lines) {
  const isOrdered = /^\s*\d+\./.test(lines[0]);
  const tag = isOrdered ? 'ol' : 'ul';
  const items = [];

  for (const line of lines) {
    const match = line.match(/^\s*([-*]|\d+\.)\s+(.*)$/);
    if (match) {
      let content = match[2];
      const checkbox = content.match(/^\[( |x|X)]\s+(.*)$/);
      if (checkbox) {
        const checked = checkbox[1].toLowerCase() === 'x' ? ' checked' : '';
        content = `<input type="checkbox" disabled${checked} /> ${escapeHtml(checkbox[2])}`;
        items.push(`<li>${content}</li>`);
      } else {
        items.push(`<li>${renderInline(content)}</li>`);
      }
    } else if (items.length) {
      items[items.length - 1] = items[items.length - 1].replace(
        /<\/li>$/,
        ` ${renderInline(line.trim())}</li>`,
      );
    }
  }

  return `<${tag}>${items.join('')}</${tag}>`;
}

function renderMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/);
  const output = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      const code = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      output.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      output.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^---+\s*$/.test(line)) {
      output.push('<hr />');
      index += 1;
      continue;
    }

    if (line.startsWith('>')) {
      const quote = [];
      while (index < lines.length && lines[index].startsWith('>')) {
        quote.push(lines[index].replace(/^>\s?/, ''));
        index += 1;
      }
      output.push(`<blockquote>${renderMarkdown(quote.join('\n'))}</blockquote>`);
      continue;
    }

    if (/^\|.*\|\s*$/.test(line) && index + 1 < lines.length && /^\|[\s\-:|]+\|\s*$/.test(lines[index + 1])) {
      const headers = line.split('|').slice(1, -1).map((cell) => cell.trim());
      index += 2;
      const rows = [];
      while (index < lines.length && /^\|.*\|\s*$/.test(lines[index])) {
        rows.push(lines[index].split('|').slice(1, -1).map((cell) => cell.trim()));
        index += 1;
      }
      let table = '<table><thead><tr>';
      for (const header of headers) table += `<th>${renderInline(header)}</th>`;
      table += '</tr></thead><tbody>';
      for (const row of rows) {
        table += '<tr>';
        for (const cell of row) table += `<td>${renderInline(cell)}</td>`;
        table += '</tr>';
      }
      table += '</tbody></table>';
      output.push(table);
      continue;
    }

    if (/^(\s*)([-*]|\d+\.)\s+/.test(line)) {
      const list = [];
      while (index < lines.length && (/^(\s*)([-*]|\d+\.)\s+/.test(lines[index]) || /^\s+\S/.test(lines[index]))) {
        list.push(lines[index]);
        index += 1;
      }
      output.push(renderList(list));
      continue;
    }

    if (line.trim() === '') {
      index += 1;
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (
      index < lines.length
      && lines[index].trim() !== ''
      && !/^(#{1,6}\s|>\s|---+\s*$|```|\|.*\|\s*$|(\s*)([-*]|\d+\.)\s+)/.test(lines[index])
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    output.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
  }

  return output.join('\n');
}

async function loadChapter(id) {
  buildNav(id);
  contentEl.textContent = '読み込み中…';
  try {
    const response = await fetch(`${id}.md`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const markdown = await response.text();
    contentEl.innerHTML = renderMarkdown(markdown);
    window.scrollTo({ top: 0 });
  } catch (error) {
    contentEl.textContent = `読み込めませんでした：${error instanceof Error ? error.message : String(error)}`;
  }
}

function pickChapter() {
  const hash = (location.hash || '#INDEX').slice(1);
  return chapters.find((chapter) => chapter.id === hash)?.id ?? chapters[0].id;
}

window.addEventListener('hashchange', () => loadChapter(pickChapter()));
loadChapter(pickChapter());
