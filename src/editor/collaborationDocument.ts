import { getSchema } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import * as Y from 'yjs';
import { prosemirrorJSONToYXmlFragment } from '@tiptap/y-tiptap';

import { buildContinuousManuscriptDocument } from './continuousManuscriptDocument';
import { OmiCitationExtension } from './extensions/OmiCitationExtension';
import { OmiCrossReferenceExtension } from './extensions/OmiCrossReferenceExtension';
import { OmiNoteExtension } from './extensions/OmiNoteExtension';
import { OmiProofreadingExtension } from './extensions/OmiProofreadingExtension';
import { OmiProofingMarksExtension } from './extensions/OmiProofingMarksExtension';
import { OmiContinuousStructureExtension } from './extensions/OmiContinuousStructureExtension';
import {
  OMI_CONTINUOUS_RICH_TEXT_EXTENSIONS,
} from './extensions/OmiRichTextExtensions';
import { OmiVisualBlockExtension } from './extensions/OmiVisualBlockExtension';
import type { ManuscriptStudy } from '../model/sectionStructure';

const COLLABORATION_SCHEMA = getSchema([
  StarterKit.configure({ undoRedo: false, horizontalRule: false }),
  OmiVisualBlockExtension,
  OmiContinuousStructureExtension,
  ...OMI_CONTINUOUS_RICH_TEXT_EXTENSIONS,
  OmiProofreadingExtension,
  OmiProofingMarksExtension,
  OmiNoteExtension,
  OmiCitationExtension,
  OmiCrossReferenceExtension,
]);

export function createInitialCollaborationDocument(
  studies: readonly ManuscriptStudy[],
  sectionNumbers: ReadonlyMap<string, string>,
): Y.Doc {
  const document = new Y.Doc();
  try {
    for (const study of studies) {
      const json = buildContinuousManuscriptDocument(study.sections, sectionNumbers);
      prosemirrorJSONToYXmlFragment(
        COLLABORATION_SCHEMA,
        json,
        document.getXmlFragment(study.rootSectionId),
      );
    }
    return document;
  } catch (error) {
    document.destroy();
    throw error;
  }
}
