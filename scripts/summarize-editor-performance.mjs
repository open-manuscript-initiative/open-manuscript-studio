import { readFileSync } from 'node:fs';

const path = process.argv[2] ?? 'test-results/editor-performance/metrics.json';
const metrics = JSON.parse(readFileSync(path, 'utf8'));

function value(number, suffix = ' ms') {
  return typeof number === 'number' && Number.isFinite(number)
    ? `${number.toFixed(1)}${suffix}`
    : 'n/a';
}

const lines = [
  '# OMI large-manuscript editor benchmark',
  '',
  `- Scale: **${metrics.workload.scale}**`,
  `- Text blocks: **${metrics.workload.textBlockCount}**`,
  `- Notes: **${metrics.workload.noteCount}**`,
  `- Visual blocks: **${metrics.workload.visualBlockCount}**`,
  `- Open → editable: **${value(metrics.metrics.openToEditableMs)}**`,
  `- First caret: **${value(metrics.metrics.firstCaretMs)}**`,
  `- Input → paint median: **${value(metrics.metrics.inputToPaintMs?.median)}**`,
  `- Input → paint p95: **${value(metrics.metrics.inputToPaintMs?.p95)}**`,
  `- Long tasks: **${metrics.metrics.longTasks?.count ?? 0}** (${value(metrics.metrics.longTasks?.totalMs)})`,
  `- DOM elements: **${metrics.metrics.dom?.elements ?? 'n/a'}**`,
  `- Tiptap top-level nodes: **${metrics.metrics.dom?.topLevelNodes ?? 'n/a'}**`,
  `- JS heap after open: **${value((metrics.metrics.heap?.afterOpenUsedBytes ?? 0) / 1024 / 1024, ' MiB')}**`,
  `- JS heap after edits: **${value((metrics.metrics.heap?.afterEditsUsedBytes ?? 0) / 1024 / 1024, ' MiB')}**`,
  '',
  '## Instrumented editor phases',
  '',
  '| Phase | Count | Median | p95 | Max |',
  '| --- | ---: | ---: | ---: | ---: |',
];

for (const [name, stats] of Object.entries(metrics.metrics.internalPhases ?? {})) {
  lines.push(
    `| ${name} | ${stats.count} | ${value(stats.median)} | ${value(stats.p95)} | ${value(stats.max)} |`,
  );
}

console.log(lines.join('\n'));
