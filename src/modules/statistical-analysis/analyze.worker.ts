import { analyzeStatisticalDataset } from './model';

self.onmessage = (event: MessageEvent<Parameters<typeof analyzeStatisticalDataset>>) => {
  self.postMessage(analyzeStatisticalDataset(event.data[0], event.data[1]));
};
