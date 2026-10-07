import { analyzeStatisticalDataset } from './model';

type AnalysisInput = Parameters<typeof analyzeStatisticalDataset>;
const scope = self as unknown as { onmessage: ((event: MessageEvent<AnalysisInput>) => void) | null; postMessage: (value: unknown) => void };
scope.onmessage = (event) => {
  scope.postMessage(analyzeStatisticalDataset(event.data[0], event.data[1]));
};
