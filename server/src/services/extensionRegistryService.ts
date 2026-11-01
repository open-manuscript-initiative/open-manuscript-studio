import { extensionRegistryRepository, type ExtensionManifest } from '../repositories/extensionRegistryRepository.js';

/** Declaration storage only: no execution, secret retrieval or manuscript grant. */
export function createExtensionRegistryService(repository: typeof extensionRegistryRepository) {
  const owner = (userId: string) => {
    if (!userId) throw new Error('AUTHENTICATED_OWNER_REQUIRED');
    return userId;
  };
  return {
    list: (userId: string) => repository.list(owner(userId)),
    register: (userId: string, manifest: ExtensionManifest) => repository.register(owner(userId), manifest),
    remove: (userId: string, id: string) => repository.remove(owner(userId), id),
  };
}
export const extensionRegistryService = createExtensionRegistryService(extensionRegistryRepository);
