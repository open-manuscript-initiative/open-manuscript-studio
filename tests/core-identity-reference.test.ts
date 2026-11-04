import test from 'node:test';
import { coreIdentityReferenceCases } from './coreIdentityReferenceCases.ts';

for (const item of coreIdentityReferenceCases) {
  test(`${item.id} [${item.requirements.join(', ')}]`, item.run);
}
