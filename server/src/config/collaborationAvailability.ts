export function resolveManuscriptCollaborationEnabled(
  configuredValue: string | undefined,
  nodeEnvironment: string | undefined,
): boolean {
  if (configuredValue === 'true') {
    return true;
  }

  if (configuredValue === 'false') {
    return false;
  }

  return nodeEnvironment === 'production';
}
