import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_VIVLIOSTYLE_HTML_BYTES,
  renderVivliostylePdf,
  validateVivliostyleHtmlInput,
  withOfflinePdfPolicy,
} from '../server/dist/services/vivliostylePdfRenderer.js';

test('Vivliostyle PDF source accepts self-contained resources and interactive links', () => {
  const html = `<!doctype html>
<html><head><style>
figure { background-image: url("data:image/svg+xml;base64,PHN2Zy8+"); }
</style></head><body>
<a href="https://doi.org/10.1234/example">DOI</a>
<img src="data:image/png;base64,iVBORw0KGgo=" alt="Example">
</body></html>`;

  assert.equal(validateVivliostyleHtmlInput(html), undefined);
});

test('Vivliostyle PDF source rejects active markup and remote subresources', () => {
  assert.match(
    validateVivliostyleHtmlInput('<html><body><script>alert(1)</script></body></html>') ?? '',
    /active/i,
  );
  assert.match(
    validateVivliostyleHtmlInput('<html><body><img src="https://example.test/image.png"></body></html>') ?? '',
    /non-embedded resource/i,
  );
  assert.match(
    validateVivliostyleHtmlInput('<style>@import "https://example.test/style.css";</style>') ?? '',
    /import/i,
  );
  assert.match(
    validateVivliostyleHtmlInput('<style>body{background:url(../secret.png)}</style>') ?? '',
    /non-embedded resource/i,
  );
});

test('PDF resource checks also reject unquoted HTML, SVG and srcset URLs', () => {
  for (const html of [
    '<img src=https://127.0.0.1/secret>',
    '<video poster=https://169.254.169.254/latest/meta-data/>',
    '<svg><image href=https://example.test/private></image></svg>',
    '<img srcset=https://example.test/image.png>',
  ]) {
    assert.match(validateVivliostyleHtmlInput(html) ?? '', /non-embedded/i, html);
  }
  assert.equal(
    validateVivliostyleHtmlInput('<img src=data:image/png;base64,iVBORw0KGgo=>'),
    undefined,
  );
});

test('PDF renderer policy precedes author-controlled content and forbids network loads', () => {
  const source = '<!doctype html><html><head><style>body{color:black}</style></head><body><p>Hello</p></body></html>';
  const protectedHtml = withOfflinePdfPolicy(source);
  assert.ok(protectedHtml.indexOf('Content-Security-Policy') < protectedHtml.indexOf('<style>'));
  assert.match(protectedHtml, /default-src 'none'/);
  assert.match(protectedHtml, /img-src data:/);
  assert.match(protectedHtml, /font-src data:/);
  assert.match(protectedHtml, /style-src 'unsafe-inline'/);
  assert.match(protectedHtml, /connect-src 'none'/);

  const fragment = withOfflinePdfPolicy('<p>Hello</p>');
  assert.ok(fragment.indexOf('Content-Security-Policy') < fragment.indexOf('<p>'));
});

test('Vivliostyle PDF source enforces the HTML size boundary', () => {
  const oversized = 'x'.repeat(MAX_VIVLIOSTYLE_HTML_BYTES + 1);
  assert.match(validateVivliostyleHtmlInput(oversized) ?? '', /limit/i);
});

if (process.env.OMI_RUN_VIVLIOSTYLE_SMOKE === '1') {
  test('an inserted styled page occupies exactly one real PDF sheet and deletion closes the gap', async () => {
    const { renderStyleBasedHtml, clonePublicationStyleTemplate, clonePublicationPublisherTemplate } = await import('../src/services/publicationStyleExport.ts');
    const { capturePublicationPageStyle } = await import('../src/model/publicationPageStyles.ts');
    const { resolvePublicationProfile } = await import('../src/model/publicationProfile.ts');
    const { createTestManuscript } = await import('./testManuscriptFixture.ts');
    const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const manuscript = createTestManuscript();
    manuscript.abstract = ''; manuscript.keywords = []; manuscript.annotations = []; manuscript.bibliographicRecords = [];
    const rich = (text: string) => JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
    manuscript.sections = [{ id: 's', title: '', blocks: [
      { id: 'before', type: 'paragraph', content: rich('BEFORE_INSERT') },
      { id: 'after', type: 'paragraph', content: rich('AFTER_INSERT') },
    ] }];
    const style = clonePublicationStyleTemplate(); style.fonts.body.family = 'serif'; style.runningHeaders.enabled = false;
    const plate = capturePublicationPageStyle(style, 'plate', 'Plate'); plate.page.width = 180; plate.page.height = 200;
    const identity = clonePublicationPublisherTemplate(); identity.display.firstPageBranding = false; identity.display.firstPageLegalBlock = false;
    const directory = await mkdtemp(join(tmpdir(), 'omi-inserted-pages-'));
    try {
      for (const inserted of ['before', 'after', 'end', 'none'] as const) {
        style.pageStyles = { version: 1, styles: [plate], sections: [], pages: [],
          insertions: inserted === 'none' ? [] : [{ id: 'blank', styleId: 'plate', ...(inserted === 'before' ? { beforeBlockId: 'after' } : { afterBlockId: inserted === 'after' ? 'before' : 'after' }) }] };
        const html = await renderStyleBasedHtml(manuscript, resolvePublicationProfile(manuscript), 'print', { style, identity });
        const artifact = await renderVivliostylePdf(html);
        const path = join(directory, `${inserted}.pdf`); await writeFile(path, artifact.bytes);
        const { stdout } = await promisify(execFile)(process.env.PDFTOTEXT_BIN || 'pdftotext', ['-bbox', path, '-']);
        const pages = [...stdout.matchAll(/<page\b([^>]*)>([\s\S]*?)<\/page>/g)];
        const before = pages.findIndex((page) => page[2]!.includes('>BEFORE_INSERT</word>'));
        const after = pages.findIndex((page) => page[2]!.includes('>AFTER_INSERT</word>'));
        assert.ok(before >= 0); assert.equal(after - before, inserted === 'before' || inserted === 'after' ? 2 : 0);
        if (inserted === 'end') assert.equal(pages.length, after + 2, 'exactly one final blank sheet');
        if (inserted !== 'none') {
          const blank = pages[inserted === 'end' ? after + 1 : before + 1]!;
          assert.ok(Math.abs(Number(blank[1]!.match(/width="([^"]+)"/)![1]) - 180 * 72 / 25.4) < 1);
          assert.ok(Math.abs(Number(blank[1]!.match(/height="([^"]+)"/)![1]) - 200 * 72 / 25.4) < 1);
          assert.doesNotMatch(blank[2]!, /BEFORE_INSERT|AFTER_INSERT/);
        }
      }
    } finally { await rm(directory, { recursive: true, force: true }); }
  });

  test('PDF footnotes stay below their anchors on two different pages', async () => {
    const { buildPdfPrintDocument } = await import('../src/services/exportPdf.ts');
    const { createTestManuscript } = await import('./testManuscriptFixture.ts');
    const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execute = promisify(execFile);
    const manuscript = createTestManuscript();
    manuscript.abstract = '';
    manuscript.keywords = [];
    manuscript.sections[0]!.blocks = ['ONE', 'TWO'].map((id) => ({
      id, type: 'paragraph' as const,
      content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [
        { type: 'text', text: 'ANCHOR_' + id },
        { type: 'omiNote', attrs: { noteId: id } },
      ] }] }),
    }));
    manuscript.annotations = ['ONE', 'TWO'].map((id) => ({
      id, type: 'note', noteKind: 'footnote', targetBlockId: id,
      body: 'FOOTNOTE_' + id, renderingHint: 'footnote',
    }));
    const directory = await mkdtemp(join(tmpdir(), 'omi-footnote-layout-'));
    try {
      for (const contentMode of ['publication', 'editorial'] as const) {
        const html = buildPdfPrintDocument(manuscript, undefined, 'print', contentMode)
          .replace('</head>', '<style>#block-TWO { break-before: page; }</style></head>');
        const artifact = await renderVivliostylePdf(html);
        const path = join(directory, contentMode + '.pdf');
        await writeFile(path, artifact.bytes);
        const { stdout } = await execute(process.env.PDFTOTEXT_BIN || 'pdftotext', ['-bbox', path, '-']);
        const pages = [...stdout.matchAll(/<page\b([^>]*)>([\s\S]*?)<\/page>/g)];
        for (const id of ['ONE', 'TWO']) {
          const pageIndex = pages.findIndex((page) => page[2]!.includes('>ANCHOR_' + id + '</word>'));
          assert.ok(pageIndex >= 0, 'Missing anchor ' + id);
          const page = pages[pageIndex]!;
          const words = [...page[2]!.matchAll(/<word\b([^>]*)>([^<]*)<\/word>/g)];
          const anchor = words.find((word) => word[2] === 'ANCHOR_' + id)!;
          const note = words.find((word) => word[2] === 'FOOTNOTE_' + id);
          assert.ok(note, 'Footnote must share its anchor page: ' + id);
          const y = (attributes: string) => Number(attributes.match(/yMin="([^"]+)"/)![1]);
          const height = Number(page[1]!.match(/height="([^"]+)"/)![1]);
          assert.ok(y(note[1]!) > y(anchor[1]!));
          assert.ok(y(note[1]!) > height * .65, 'Footnote must be at the foot of the page');
          assert.equal(stdout.split('>FOOTNOTE_' + id + '</word>').length - 1, 1);
        }
        assert.notEqual(
          pages.findIndex((page) => page[2]!.includes('>ANCHOR_ONE</word>')),
          pages.findIndex((page) => page[2]!.includes('>ANCHOR_TWO</word>')),
        );
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test('section headers, opening-page suppression and a physical-page master survive real PDF pagination', async () => {
    const { renderStyleBasedHtml, clonePublicationStyleTemplate, clonePublicationPublisherTemplate } = await import('../src/services/publicationStyleExport.ts');
    const { capturePublicationPageStyle } = await import('../src/model/publicationPageStyles.ts');
    const { resolvePublicationProfile } = await import('../src/model/publicationProfile.ts');
    const { createPublicationMatter, PUBLICATION_MATTER_EXTENSION } = await import('../src/model/publicationMatter.ts');
    const { createTestManuscript } = await import('./testManuscriptFixture.ts');
    const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const manuscript = createTestManuscript();
    manuscript.abstract = ''; manuscript.keywords = []; manuscript.annotations = []; manuscript.bibliographicRecords = [];
    const block = (id: string, text: string) => ({ id, type: 'paragraph', content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }) });
    manuscript.sections = [
      { id: 'alpha', title: 'Alpha', blocks: [block('A1', 'ALPHA_START'), block('A2', 'ALPHA_CONT'), block('A3', 'PLATE_BODY')] },
      { id: 'beta', title: 'Beta', blocks: [block('B1', 'BETA_BODY')] },
    ];
    const matter = createPublicationMatter(manuscript);
    matter.pages.find((page) => page.kind === 'half-title')!.enabled = true;
    manuscript.extensions = { ...manuscript.extensions, [PUBLICATION_MATTER_EXTENSION]: matter };
    const style = clonePublicationStyleTemplate();
    style.fonts.body.family = 'serif';
    const plate = capturePublicationPageStyle(style, 'plate', 'Plate');
    plate.page.width = 180; plate.page.margins.top = 35; plate.showFirstPage = true;
    plate.runningHeaders.odd.left = plate.runningHeaders.even.left = 'PLATE_HEADER';
    const alpha = structuredClone(style.runningHeaders), beta = structuredClone(style.runningHeaders);
    alpha.odd.left = alpha.even.left = 'ALPHA_HEADER'; beta.odd.left = beta.even.left = 'BETA_HEADER';
    style.pageStyles = { version: 1, styles: [plate], sections: [
      { sectionId: 'alpha', startNewPage: true, runningHeaders: alpha, showFirstPage: false },
      { sectionId: 'beta', startNewPage: true, runningHeaders: beta, showFirstPage: true },
    ], pages: [{ from: 4, to: 4, styleId: 'plate' }] };
    const identity = clonePublicationPublisherTemplate();
    identity.display.firstPageBranding = false; identity.display.firstPageLegalBlock = false;
    const html = (await renderStyleBasedHtml(manuscript, resolvePublicationProfile(manuscript), 'print', { style, identity }))
      .replace('</head>', '<style>#block-A2,#block-A3{break-before:page}</style></head>');
    const directory = await mkdtemp(join(tmpdir(), 'omi-section-page-styles-'));
    try {
      const artifact = await renderVivliostylePdf(html);
      const path = join(directory, 'issue.pdf'); await writeFile(path, artifact.bytes);
      const { stdout } = await promisify(execFile)(process.env.PDFTOTEXT_BIN || 'pdftotext', ['-bbox', path, '-']);
      const pages = [...stdout.matchAll(/<page\b([^>]*)>([\s\S]*?)<\/page>/g)];
      const find = (word: string) => { const page = pages.find((item) => item[2]!.includes(`>${word}</word>`)); assert.ok(page, `Missing PDF marker: ${word}`); return page; };
      assert.doesNotMatch(find('ALPHA_START')[2]!, /ALPHA_HEADER/);
      assert.match(find('ALPHA_CONT')[2]!, /ALPHA_HEADER/);
      assert.match(find('BETA_BODY')[2]!, /BETA_HEADER/);
      const platePage = find('PLATE_BODY'); assert.match(platePage[2]!, /PLATE_HEADER/);
      assert.ok(Math.abs(Number(platePage[1]!.match(/width="([^"]+)"/)![1]) - 180 * 72 / 25.4) < 1);
      const plateWord = [...platePage[2]!.matchAll(/<word\b([^>]*)>([^<]*)<\/word>/g)].find((word) => word[2] === 'PLATE_BODY')!;
      assert.ok(Number(plateWord[1]!.match(/yMin="([^"]+)"/)![1]) >= 35 * 72 / 25.4 - 1);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });

  // Render actual paged PDF artifacts, not just the print HTML. These
  // acceptance contracts stay visible as TODO until the production renderer
  // demonstrates the expected multi-page behaviour; strict mode blocks on them.
  test('F04 and T04: rendered page continuity and non-overlap contracts', async t => {
    const { buildPdfPrintDocument } = await import('../src/services/exportPdf.ts');
    const { createTestManuscript } = await import('./testManuscriptFixture.ts');
    const { createTableBlock } = await import('../src/model/visualBlocks.ts');
    const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execute = promisify(execFile);
    const strict = process.env.OMI_FORMATTING_STRICT === '1';
    const directory = await mkdtemp(join(tmpdir(), 'omi-rendered-formatting-'));
    const fresh = () => {
      const manuscript = createTestManuscript();
      manuscript.abstract = ''; manuscript.keywords = []; manuscript.annotations = [];
      manuscript.bibliographicRecords = [];
      return manuscript;
    };
    type Word = { text: string; xMin: number; yMin: number; xMax: number; yMax: number };
    async function extractPages(html: string, name: string): Promise<Word[][]> {
      const result = await renderVivliostylePdf(html);
      assert.equal(new TextDecoder().decode(result.bytes.subarray(0, 5)), '%PDF-');
      const path = join(directory, name + '.pdf');
      await writeFile(path, result.bytes);
      const { stdout } = await execute(process.env.PDFTOTEXT_BIN || 'pdftotext', ['-bbox', path, '-']);
      const pages = [...stdout.matchAll(/<page\b[^>]*>([\s\S]*?)<\/page>/g)].map(page =>
        [...page[1]!.matchAll(/<word\b([^>]*)>([^<]*)<\/word>/g)].map(word => {
          const number = (attribute: string) => {
            const value = Number(word[1]!.match(new RegExp(attribute + '="([^"]+)"'))?.[1]);
            assert.ok(Number.isFinite(value), 'Missing word bounding box ' + attribute);
            return value;
          };
          return { text: word[2]!, xMin: number('xMin'), yMin: number('yMin'), xMax: number('xMax'), yMax: number('yMax') };
        }));
      assert.ok(pages.length > 0);
      return pages;
    }
    const locate = (pages: Word[][], token: string) => pages.flatMap((words, page) => words.filter(word => word.text === token).map(word => ({ ...word, page })));
    const rich = (text: string) => JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
    try {
      await t.test('F04 long note retains all unique words, continues to another sheet and never covers body text', {
        todo: strict ? false : 'Long-note page splitting and overlap are open rendered-PDF acceptance criteria',
      }, async () => {
        const manuscript = fresh();
        const tokens = Array.from({ length: 260 }, (_, index) => 'NOTE' + String(index + 1).padStart(4, '0'));
        const bodyTokens = Array.from({ length: 60 }, (_, index) => 'BODY' + String(index + 1).padStart(4, '0'));
        manuscript.sections = [{ id: 'note-section', title: 'Long footnote', blocks: [
          { id: 'anchor', type: 'paragraph', content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'NOTEANCHOR' }, { type: 'omiNote', attrs: { noteId: 'long-note' } }] }] }) },
          ...bodyTokens.map((token, index) => ({ id: 'body-' + index, type: 'paragraph' as const, content: rich(token + ' Ordinary body paragraph.') })),
        ] }];
        const paragraphs = Array.from({ length: 26 }, (_, index) => tokens.slice(index * 10, index * 10 + 10).map(token => token + ' footnote material with a sufficiently long source citation.').join(' '));
        manuscript.annotations = [{ id: 'long-note', type: 'note', noteKind: 'footnote', targetBlockId: 'anchor', body: paragraphs.join('\n'), renderingHint: 'footnote',
          bodyContent: JSON.stringify({ type: 'doc', content: paragraphs.map(text => ({ type: 'paragraph', content: [{ type: 'text', text }] })) }) }];
        const pages = await extractPages(buildPdfPrintDocument(manuscript), 'long-note');
        const first = locate(pages, tokens[0]!);
        const last = locate(pages, tokens.at(-1)!);
        const anchor = locate(pages, 'NOTEANCHOR');
        assert.equal(anchor.length, 1);
        assert.equal(first.length, 1);
        assert.equal(last.length, 1);
        assert.equal(first[0]!.page, anchor[0]!.page, 'The beginning of the note belongs on its anchor page');
        assert.ok(last[0]!.page > first[0]!.page, 'The note must continue across pages');
        assert.ok(first[0]!.yMin > anchor[0]!.yMax);
        let previousPage = -1;
        for (const token of tokens) {
          const matches = locate(pages, token);
          assert.equal(matches.length, 1, token + ' was lost or duplicated');
          assert.ok(matches[0]!.page >= previousPage, token + ' appears out of order');
          previousPage = matches[0]!.page;
        }
        for (const token of bodyTokens) assert.equal(locate(pages, token).length, 1, token + ' was lost or duplicated');
        for (const words of pages) {
          const body = words.filter(word => /^BODY\d{4}$/.test(word.text) || word.text === 'NOTEANCHOR');
          const note = words.filter(word => /^NOTE\d{4}$/.test(word.text));
          if (body.length && note.length) assert.ok(Math.max(...body.map(w => w.yMax)) <= Math.min(...note.map(w => w.yMin)) + .5, 'Body and note vertical bounds overlap');
        }
      });
      await t.test('T04 repeated header and 85 table rows survive PDF pagination without loss, duplicates or reordered cells', {
        todo: strict ? false : 'Multi-page table header repetition and row pagination must be verified in the real renderer',
      }, async () => {
        const manuscript = fresh();
        const rows = Array.from({ length: 85 }, (_, index) => ['ROW' + String(index + 1).padStart(3, '0'), 'VALUE' + String(index + 1).padStart(3, '0')]);
        manuscript.sections = [{ id: 'table-section', title: 'Long table', blocks: [
          createTableBlock([['TABLEHEADER', 'VALUEHEADER'], ...rows], { headerRows: 1 }, 'multipage-table'),
        ] }];
        const pages = await extractPages(buildPdfPrintDocument(manuscript), 'long-table');
        const dataPages = pages.map((words, page) => ({ words, page })).filter(({ words }) => words.some(word => /^ROW\d{3}$/.test(word.text)));
        assert.ok(dataPages.length >= 2, 'The fixture must span at least two pages');
        let previousPage = -1;
        for (const [label, value] of rows) {
          const left = locate(pages, label!);
          const right = locate(pages, value!);
          assert.equal(left.length, 1, label + ' was lost or duplicated');
          assert.equal(right.length, 1, value + ' was lost or duplicated');
          assert.equal(left[0]!.page, right[0]!.page, 'Table row was split');
          assert.ok(left[0]!.page >= previousPage, 'Row order changed');
          assert.ok(Math.abs(left[0]!.yMin - right[0]!.yMin) < 2, 'Cell baselines do not align');
          assert.ok(left[0]!.xMax <= right[0]!.xMin, 'Cell bounding boxes overlap');
          previousPage = left[0]!.page;
        }
        for (const { words } of dataPages) {
          const header = words.filter(word => word.text === 'TABLEHEADER');
          const valueHeader = words.filter(word => word.text === 'VALUEHEADER');
          assert.equal(header.length, 1, 'Header must repeat once per table page');
          assert.equal(valueHeader.length, 1);
          const firstRow = Math.min(...words.filter(word => /^ROW\d{3}$/.test(word.text)).map(word => word.yMin));
          assert.ok(header[0]!.yMax <= firstRow + .5, 'Repeated header overlaps the first row');
        }
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test('pinned Vivliostyle CLI renders a real PDF artifact', async () => {
    const artifact = await renderVivliostylePdf(
      '<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A5;margin:15mm}h1{break-after:avoid}</style></head><body><h1>OMI PDF smoke test</h1><p>Vivliostyle paged-media artifact.</p></body></html>',
    );

    assert.equal(artifact.renderer, 'vivliostyle-cli');
    assert.equal(artifact.rendererVersion, '11.0.4');
    assert.equal(new TextDecoder().decode(artifact.bytes.subarray(0, 5)), '%PDF-');
    assert.ok(artifact.bytes.byteLength > 500);
  });
}
