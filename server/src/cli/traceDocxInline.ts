import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { applyDirectFormattingHeadingInference } from '../integrations/ojs/docxDirectHeading.js';
import { applyInlineSemantics } from '../integrations/ojs/docxInlineSemantics.js';
import { parseDocxSource } from '../integrations/ojs/docxSource.js';

interface InlineTraceItem {
  kind?: string;
  text?: string;
  semantics?: unknown;
  language?: unknown;
}

async function main(): Promise<void> {
  const input = process.argv[2];
  if (!input) {
    console.error('Usage: npx tsx src/cli/traceDocxInline.ts /path/to/file.docx');
    process.exitCode = 2;
    return;
  }

  const absolutePath = path.resolve(input);
  const buffer = await readFile(absolutePath);
  const fileName = path.basename(absolutePath);
  const mediaType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  const parsed = parseDocxSource(buffer, 'diagnostic', fileName, mediaType);
  const withHeadings = applyDirectFormattingHeadingInference(buffer, parsed);
  const enriched = applyInlineSemantics(buffer, withHeadings);

  let emphasisCount = 0;
  let styledParagraphCount = 0;

  console.log(`DOCX inline trace: ${fileName}`);
  console.log(`Paragraphs: ${enriched.paragraphs.length}`);

  enriched.paragraphs.forEach((paragraph, index) => {
    const inline = Array.isArray(paragraph.inline)
      ? paragraph.inline as InlineTraceItem[]
      : [];
    const styled = inline.filter((item) =>
      Array.isArray(item.semantics) && item.semantics.length > 0,
    );
    if (!styled.length) return;

    styledParagraphCount += 1;
    const emphasis = styled.filter((item) =>
      Array.isArray(item.semantics) && item.semantics.includes('emphasis'),
    );
    emphasisCount += emphasis.length;

    console.log('\n---');
    console.log(`Paragraph #${index + 1}`);
    console.log(`Text: ${paragraph.text}`);
    console.log('Inline:');
    for (const item of inline) {
      console.log(JSON.stringify({
        kind: item.kind,
        text: item.text,
        semantics: item.semantics,
        language: item.language,
      }));
    }
  });

  console.log('\n=== SUMMARY ===');
  console.log(`Styled paragraphs: ${styledParagraphCount}`);
  console.log(`Emphasis segments: ${emphasisCount}`);

  if (emphasisCount === 0) {
    console.log('RESULT: No emphasis semantics reached the OJS sourceDocument stage.');
    process.exitCode = 1;
    return;
  }

  console.log('RESULT: Emphasis semantics are present before the Studio frontend import.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
