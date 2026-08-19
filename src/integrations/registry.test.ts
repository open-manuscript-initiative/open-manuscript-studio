import { describe, expect, it } from 'vitest';

import { integrationCatalog } from './registry';

describe('integration catalog publishing providers', () => {
  it('exposes OJS and OMP as separate providers', () => {
    const publishing = integrationCatalog.filter((entry) => entry.kind === 'publishing');

    expect(publishing.map((entry) => entry.id)).toEqual(['ojs', 'omp']);
    expect(publishing.some((entry) => entry.id === 'ojs-omp')).toBe(false);
  });

  it('advertises only currently supported OMP read capabilities', () => {
    const omp = integrationCatalog.find((entry) => entry.id === 'omp');

    expect(omp).toBeDefined();
    expect(omp?.permissions).toEqual(['metadata.read', 'files.read']);
    expect(omp?.status).toBe('available');
  });

  it('keeps the OJS editorial and review capabilities separate from OMP', () => {
    const ojs = integrationCatalog.find((entry) => entry.id === 'ojs');

    expect(ojs).toBeDefined();
    expect(ojs?.permissions).toContain('review.read');
    expect(ojs?.permissions).toContain('document.write');
    expect(ojs?.status).toBe('available');
  });
});
