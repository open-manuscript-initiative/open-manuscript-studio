import assert from 'node:assert/strict';
import test from 'node:test';

import { createBlankManuscript } from '../src/document/createBlankManuscript.ts';
import { createContribution, createPersonAgent } from '../src/model/identity.ts';
import { mergeOmiDocumentAsStudy } from '../src/model/studyImport.ts';
import { getParentSectionId } from '../src/model/sectionStructure.ts';
import { extractManuscriptState } from '../src/model/versioning.ts';

test('imports one complete OMI document as one independently editable study', () => {
  const timestamp = '2026-09-02T08:00:00.000Z';
  const volume = extractManuscriptState(createBlankManuscript({
    kind: 'volume',
    volumeKind: 'edited-volume',
    title: 'Destination volume',
  }));
  volume.titleMatter = { publisherName: 'Destination Press' };
  volume.sections = [{
    id: 'collision-id',
    title: 'Existing study',
    blocks: [{ id: 'existing-block', type: 'paragraph', content: 'Existing' }],
  }];

  const source = extractManuscriptState(createBlankManuscript({
    kind: 'study',
    title: 'Imported study',
    locale: 'hu',
  }));
  source.id = 'source-manuscript';
  source.titleMatter = { publisherName: 'Source Press' };
  source.sections = [{
    id: 'collision-id',
    title: 'Opening section',
    blocks: [{
      id: 'source-block',
      type: 'paragraph',
      content: JSON.stringify({
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{
            type: 'omiCitation',
            attrs: {
              citationId: 'source-citation',
              anchorId: 'source-anchor',
              label: 'Example',
            },
          }],
        }],
      }),
    }],
  }];
  const agent = createPersonAgent(
    { givenName: 'Ada', familyName: 'Author' },
    'source-agent',
    timestamp,
  );
  source.agents = [agent];
  source.contributions = [createContribution(
    agent.id,
    source.id,
    ['author'],
    1,
    'source-contribution',
    timestamp,
  )];
  source.bibliographicRecords = [{
    id: 'source-record',
    type: 'book',
    title: 'Imported reference',
    contributors: [],
    identifiers: [],
    status: 'resolved',
  }];
  source.citations = [{
    id: 'source-citation',
    target: 'source-record',
    anchorId: 'source-anchor',
    targetBlockId: 'source-block',
  }];

  let sequence = 0;
  const result = mergeOmiDocumentAsStudy(volume, source, {
    sourceFileName: 'imported.omi',
    importedAt: timestamp,
    createId: () => sequence++ === 0 ? 'collision-id' : `imported-${sequence}`,
  });

  assert.equal(result.state.title, 'Destination volume');
  assert.deepEqual(result.state.titleMatter, { publisherName: 'Destination Press' });
  assert.equal(result.importedSections[0]?.title, 'Imported study');
  assert.notEqual(result.rootSectionId, 'collision-id');
  assert.equal(
    getParentSectionId(result.importedSections[1]!),
    result.rootSectionId,
  );

  const mappedAgentId = result.idMap.get('source-agent');
  const mappedContributionId = result.idMap.get('source-contribution');
  const mappedRecordId = result.idMap.get('source-record');
  const mappedCitationId = result.idMap.get('source-citation');
  const mappedAnchorId = result.idMap.get('source-anchor');
  const mappedBlockId = result.idMap.get('source-block');
  assert.ok(mappedAgentId);
  assert.ok(mappedContributionId);
  assert.ok(mappedRecordId);
  assert.ok(mappedCitationId);
  assert.ok(mappedAnchorId);
  assert.ok(mappedBlockId);

  const contribution = result.state.contributions.find(
    (item) => item.id === mappedContributionId,
  );
  assert.equal(contribution?.agentId, mappedAgentId);
  assert.equal(contribution?.targetId, result.rootSectionId);

  const citation = result.state.citations.find((item) => item.id === mappedCitationId);
  assert.equal(citation?.target, mappedRecordId);
  assert.equal(citation?.anchorId, mappedAnchorId);
  assert.equal(citation?.targetBlockId, mappedBlockId);

  const importedContent = result.importedSections[1]?.blocks[0]?.content ?? '';
  assert.match(importedContent, new RegExp(mappedCitationId));
  assert.match(importedContent, new RegExp(mappedAnchorId));
  assert.doesNotMatch(importedContent, /source-citation|source-anchor/);
});
