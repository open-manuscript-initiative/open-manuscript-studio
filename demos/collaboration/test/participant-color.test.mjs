import assert from 'node:assert/strict';
import test from 'node:test';
import { participantColor } from '../src/participant-color.js';

test('participant colors are stable hex values and vary across session identities', () => {
  const adaColor = participantColor('participant-ada');
  const graceColor = participantColor('participant-grace');

  assert.match(adaColor, /^#[0-9a-f]{6}$/);
  assert.equal(participantColor('participant-ada'), adaColor);
  assert.notEqual(adaColor, graceColor);
});
