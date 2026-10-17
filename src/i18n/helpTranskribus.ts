import type { HelpCopy } from './help';
import { getTranskribusCopy } from '../modules/transkribus/copy';

export function appendTranskribusHelp(locale: string, copy: HelpCopy): HelpCopy {
  const language = locale.toLowerCase().split(/[-_]/)[0];
  if (!['en', 'hu', 'de'].includes(language)) return copy;
  const text = getTranskribusCopy(locale);
  if (copy.topics.some(topic => topic.title === text.helpTitle)) return copy;
  return { ...copy, topics: [...copy.topics, { title: text.helpTitle, body: text.helpBody, tips: [text.sourceHint, text.submitHint] }] };
}
