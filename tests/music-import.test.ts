import assert from 'node:assert/strict';
import test from 'node:test';
import { importMusicBytes, importMusicFile } from '../src/services/musicImport.ts';
import { renderHtmlArticle } from '../src/services/exportHtml.ts';
import { createTestManuscript } from './testManuscriptFixture.ts';

const provenance = { sourceFormat: 'musicxml', importedAt: '2026-09-13T00:00:00Z' };
const score = (title = 'Study', namespace = '') => `<score-partwise ${namespace}><work><work-title>${title}</work-title></work><part id="P1"><measure number="1"><attributes><divisions>2</divisions></attributes><note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration></note></measure></part></score-partwise>`;
const read = (xml: string) => importMusicFile(new File([xml], 'study.musicxml'), provenance);

test('imports MusicXML without a browser DOM, including namespaces and an external DTD', async () => {
  for (const xml of [score(), score('Study', 'xmlns="http://www.musicxml.org/ns/musicxml"'), '<!DOCTYPE score-partwise SYSTEM "https://invalid.example/never-fetch.dtd">' + score()]) {
    const block = await read(xml);
    assert.equal(block.visual?.kind, 'music-score');
    if (block.visual?.kind !== 'music-score') throw new Error('Missing score');
    assert.equal(block.visual.notes[0].step, 'C');
    assert.equal(block.visual.divisions, 2);
  }
});

test('recognizes MusicXML from bytes when Android does not provide a useful file extension', () => {
  const bytes = new TextEncoder().encode(score('Android score'));
  const block = importMusicBytes(bytes, 'selected-document', provenance);
  assert.equal(block.visual?.kind, 'music-score');
  if (block.visual?.kind !== 'music-score') throw new Error('Missing score');
  assert.equal(block.visual.title, 'Android score');
  assert.equal(block.visual.notes[0].step, 'C');
});

test('keeps encoded and CDATA markup as text and escapes HTML export', async () => {
  const payload = '<img src=x onerror=alert(1)>';
  for (const title of ['&lt;img src=x onerror=alert(1)&gt;', `<![CDATA[${payload}]]>`]) {
    const block = await read(score(title));
    if (block.visual?.kind !== 'music-score') throw new Error('Missing score');
    assert.equal(block.visual.title, payload);
    const manuscript = createTestManuscript();
    manuscript.sections[0].blocks = [block];
    const output = renderHtmlArticle(manuscript).html;
    assert.ok(!output.includes(payload));
    assert.ok(output.includes('&lt;img src=x onerror=alert(1)&gt;'));
  }
});

test('rejects malformed XML, unknown entities, entity declarations and non-score roots', async () => {
  for (const xml of [score().replace('</note>', ''), score('&unknown;'), '<!DOCTYPE score-partwise [<!ENTITY x "expanded">]>' + score('&x;'), '<html><body>not a score</body></html>']) {
    await assert.rejects(read(xml));
  }
});
