import { parseDelimited } from './model';

const scope = self as unknown as { onmessage: ((event: MessageEvent<{ text: string }>) => void) | null; postMessage: (value: unknown) => void };
scope.onmessage = (event) => {
  const result = parseDelimited(event.data.text);
  scope.postMessage(result);
};

