import { createContext } from 'react';
import type { OmiPublicationFlowBreak } from '../editor/extensions/OmiProofingMarksExtension';

/** Screen-only row spacers. Never stored in the manuscript or exported. */
export const TablePaginationContext = createContext<readonly OmiPublicationFlowBreak[]>([]);
