import assert from 'node:assert/strict';
import test from 'node:test';
import { hyphenatePrintText, preparePrintHyphenation, printHyphenationBreaks, resolvePrintHyphenationModule } from '../src/services/printHyphenation.ts';

export function registerPrintHyphenationContracts(): void {
  test('P19: language-specific dictionaries yield reversible discretionary break offsets', async t => {
    for (const [lang, module, word] of [
      ['hu-HU', 'hu', 'tudományos'],
      ['de-DE', 'de', 'Wissenschaftlichkeit'],
      ['en-GB', 'en-gb', 'internationalization'],
      ['en-US', 'en', 'internationalization'],
    ]) {
      await t.test(lang!, async () => {
        assert.equal(resolvePrintHyphenationModule(lang), module);
        await preparePrintHyphenation(lang!);
        const original = word!;
        const rendered = await hyphenatePrintText(original, lang!);
        assert.ok(rendered.includes('\u00ad'), 'Dictionary must actually supply a break');
        assert.equal(rendered.replaceAll('\u00ad', ''), original);
        const expected: number[] = [];
        let offset = 0;
        for (const character of rendered) {
          if (character === '\u00ad') expected.push(offset);
          else offset += character.length;
        }
        const offsets = printHyphenationBreaks(original, lang!);
        assert.deepEqual(offsets, expected);
        assert.ok(offsets.every(value => value > 0 && value < original.length));
        assert.deepEqual([...new Set(offsets)].sort((a, b) => a - b), offsets);
        assert.equal(await hyphenatePrintText(rendered, lang!), rendered, 'Repeated processing must not duplicate hyphens');
      });
    }
    for (const lang of ['und', 'zh-Hans', 'not_a_valid_language_tag_!']) {
      assert.equal(resolvePrintHyphenationModule(lang), null);
      assert.equal(await hyphenatePrintText('internationalization', lang), 'internationalization');
      assert.deepEqual(printHyphenationBreaks('internationalization', lang), []);
    }
  });
}
