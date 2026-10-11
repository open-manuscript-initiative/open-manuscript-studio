import type { HelpCopy } from './help';
import { healthCopy } from '../modules/health-research/copy';
export function appendHealthResearchHelp(locale: string, copy: HelpCopy): HelpCopy {
  if (locale !== 'hu' && locale !== 'en' && locale !== 'de') return copy;
  const t = healthCopy[locale];
  return { ...copy, topics: [...copy.topics, { title: t.psychology + ' / ' + t['medical-sciences'], body: t.shared, tips: [t.notice, t.projection] }] };
}
