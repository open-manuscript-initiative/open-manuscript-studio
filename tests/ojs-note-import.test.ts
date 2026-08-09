import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createManuscriptFromOjsLaunch,
  type OjsLaunchPayload,
} from '../src/integrations/ojs/importOjsLaunch.ts';

function launchWithSource(
  sourceDocument: NonNullable<OjsLaunchPayload['sourceDocument']>,
): OjsLaunchPayload {
  return {
    protocol: 'omi-integration/1',
    profile: 'omi-integration/1/ojs',
    submission: {
      externalId: '780',
      primaryLocale: 'hu',
      title: { hu: 'Teszt kézirat' },
      subtitle: {},
      abstract: { hu: '' },
      keywords: { hu: [] },
    },
    contributors: [],
    files: [],
    sourceDocument,
  };
}

test('OJS DOCX footnote becomes an OMI note marker and annotation', () => {
  const manuscript = createManuscriptFromOjsLaunch(
    launchWithSource({
      kind: 'docx',
      paragraphs: [
        {
          text: 'Szöveg folytatása.',
          inline: [
            { kind: 'text', text: 'Szöveg' },
            { kind: 'footnoteReference', footnoteId: '1' },
            { kind: 'text', text: ' folytatása.' },
          ],
        },
      ],
      footnotes: [{ id: '1', text: 'A lábjegyzet teljes szövege.' }],
      endnotes: [],
    }),
  );

  assert.ok(manuscript);
  assert.equal(manuscript.annotations.length, 1);
  assert.equal(manuscript.annotations[0]?.type, 'note');
  assert.equal(manuscript.annotations[0]?.noteKind, 'footnote');
  assert.equal(manuscript.annotations[0]?.body, 'A lábjegyzet teljes szövege.');

  const block = manuscript.sections[0]?.blocks[0];
  assert.ok(block);
  const doc = JSON.parse(block.content) as {
    content?: Array<{ content?: Array<{ type?: string; attrs?: Record<string, unknown> }> }>;
  };
  const marker = doc.content?.[0]?.content?.find((node) => node.type === 'omiNote');
  assert.ok(marker);
  assert.equal(marker.attrs?.noteType, 'footnote');
  assert.equal(marker.attrs?.label, '1');
  assert.equal(marker.attrs?.noteId, manuscript.annotations[0]?.id);
  assert.equal(marker.attrs?.anchorId, manuscript.annotations[0]?.anchorId);
});

test('OJS DOCX endnote is imported as an OMI endnote', () => {
  const manuscript = createManuscriptFromOjsLaunch(
    launchWithSource({
      kind: 'docx',
      paragraphs: [
        {
          text: 'Végjegyzetes mondat.',
          inline: [
            { kind: 'text', text: 'Végjegyzetes mondat' },
            { kind: 'endnoteReference', endnoteId: '2' },
            { kind: 'text', text: '.' },
          ],
        },
      ],
      footnotes: [],
      endnotes: [{ id: '2', text: 'A végjegyzet szövege.' }],
    }),
  );

  assert.ok(manuscript);
  assert.equal(manuscript.annotations.length, 1);
  assert.equal(manuscript.annotations[0]?.noteKind, 'endnote');
  assert.equal(manuscript.annotations[0]?.renderingHint, 'endnote');
  assert.equal(manuscript.annotations[0]?.body, 'A végjegyzet szövege.');
});

test('OJS note reference is preserved even when its source body is missing', () => {
  const manuscript = createManuscriptFromOjsLaunch(
    launchWithSource({
      kind: 'docx',
      paragraphs: [
        {
          text: 'Hiányos jegyzet.',
          inline: [
            { kind: 'text', text: 'Hiányos jegyzet' },
            { kind: 'footnoteReference', footnoteId: '99' },
            { kind: 'text', text: '.' },
          ],
        },
      ],
      footnotes: [],
      endnotes: [],
    }),
  );

  assert.ok(manuscript);
  assert.equal(manuscript.annotations.length, 1);
  assert.equal(manuscript.annotations[0]?.noteKind, 'footnote');
  assert.equal(manuscript.annotations[0]?.body, '');

  const block = manuscript.sections[0]?.blocks[0];
  assert.ok(block);
  assert.match(block.content, /"type":"omiNote"/);
});
