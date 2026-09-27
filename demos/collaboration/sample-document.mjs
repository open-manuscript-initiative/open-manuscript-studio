import * as Y from 'yjs';

const SAMPLE_HEADING = 'A shared manuscript, written together';
const SAMPLE_PARAGRAPH = 'This synthetic sample is shared in real time. Edit this text from two browser windows to see Yjs collaboration in action.';

export function seedSampleDocument(document) {
  const fragment = document.getXmlFragment('default');
  const heading = new Y.XmlElement('heading');
  heading.setAttribute('level', 1);
  const headingText = new Y.XmlText();
  headingText.insert(0, SAMPLE_HEADING);
  heading.insert(0, [headingText]);

  const paragraph = new Y.XmlElement('paragraph');
  const paragraphText = new Y.XmlText();
  paragraphText.insert(0, SAMPLE_PARAGRAPH);
  paragraph.insert(0, [paragraphText]);

  fragment.insert(0, [heading, paragraph]);
}

export function createSampleDocumentUpdate() {
  const document = new Y.Doc();
  seedSampleDocument(document);
  const update = Y.encodeStateAsUpdate(document);
  document.destroy();
  return update;
}

function textContent(node) {
  if (node instanceof Y.XmlText) return node.toString();
  if (node instanceof Y.XmlElement || node instanceof Y.XmlFragment) {
    return node.toArray().map(textContent).join('');
  }
  return '';
}

export function removeDuplicateSampleContent(document) {
  const fragment = document.getXmlFragment('default');
  const seen = new Set();
  const duplicateIndexes = [];

  fragment.toArray().forEach((node, index) => {
    if (!(node instanceof Y.XmlElement)) return;
    let key = null;
    if (node.nodeName === 'heading' && node.getAttribute('level') === 1 && textContent(node) === SAMPLE_HEADING) {
      key = 'sample-heading';
    } else if (node.nodeName === 'paragraph' && textContent(node) === SAMPLE_PARAGRAPH) {
      key = 'sample-paragraph';
    }
    if (!key) return;
    if (seen.has(key)) duplicateIndexes.push(index);
    else seen.add(key);
  });

  for (const index of duplicateIndexes.reverse()) fragment.delete(index, 1);
}

const sampleDocumentUpdate = createSampleDocumentUpdate();

export function applySampleDocument(document, savedUpdate) {
  Y.applyUpdate(document, savedUpdate || sampleDocumentUpdate);
  removeDuplicateSampleContent(document);
}
