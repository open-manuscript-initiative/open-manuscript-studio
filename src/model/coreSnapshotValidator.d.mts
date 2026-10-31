export const CORE_PROFILE: string;
export const CORE_SPECIFICATIONS: Readonly<Record<string, string>>;
export interface CoreSnapshotOptions { mode?: 'authoring' | 'exchange'; maxNodes?: number; maxDepth?: number; maxDiagnostics?: number }
export interface CoreSnapshotResult {
  profile: string; profileVersion: string; specifications: Record<string, string>; mode: 'authoring' | 'exchange';
  outcome: 'valid' | 'invalid' | 'indeterminate'; complete: boolean;
  diagnostics: { code: string; path: string; severity: 'error' | 'warning' }[];
  exclusions: string[];
}
export function validateCoreSnapshot(value: unknown, options?: CoreSnapshotOptions): CoreSnapshotResult;
