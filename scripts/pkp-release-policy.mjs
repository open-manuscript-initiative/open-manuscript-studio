// Release evidence policy, not a runtime permission grant or production-upgrade approval.
// Preview does not waive these explicitly declared cross-version regression checks.
export const PKP_RELEASE_TARGETS = Object.freeze(['ojs', 'omp'].flatMap(platform =>
  ['4', '5', '6'].map(patch => Object.freeze({
    platform,
    version: `3_5_0-${patch}`,
    releaseTier: platform === 'ojs' ? 'stable' : 'preview',
    job: `${platform} 3_5_0-${patch} (${platform === 'ojs' ? 'stable' : 'preview'}) workflow E2E`,
    artifact: `pkp-${platform}-3_5_0-${patch}-${platform === 'ojs' ? 'stable' : 'preview'}-diagnostics-{attempt}`,
    manualGate: platform === 'ojs' ? `ojs-3.5.0-${patch}` : null,
  })),
));

export const PKP_MANUAL_GATES = Object.freeze(PKP_RELEASE_TARGETS
  .filter(target => target.manualGate !== null).map(target => target.manualGate));
