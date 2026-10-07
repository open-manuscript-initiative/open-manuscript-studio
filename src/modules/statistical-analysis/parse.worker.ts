import { parseDelimited } from './model';

self.onmessage = (event: MessageEvent<{ text: string }>) => {
  const result = parseDelimited(event.data.text);
  self.postMessage(result);
};
