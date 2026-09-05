export function normalizeStudioVersion(value: string): string {
  return value.trim().replace(/^v/i, '').split('+', 1)[0] ?? '';
}

type VersionIdentifier = number | string;

interface ParsedVersion {
  core: number[];
  prerelease: VersionIdentifier[] | null;
}

function parseVersion(value: string): ParsedVersion | null {
  const normalized = normalizeStudioVersion(value);
  const match = normalized.match(
    /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/,
  );
  if (!match) return null;

  const prerelease = match[4]
    ? match[4].split('.').map((identifier) =>
        /^\d+$/.test(identifier) ? Number(identifier) : identifier.toLowerCase(),
      )
    : null;

  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease,
  };
}

function compareIdentifier(
  left: VersionIdentifier,
  right: VersionIdentifier,
): number {
  if (left === right) return 0;
  if (typeof left === 'number' && typeof right === 'number') {
    return left < right ? -1 : 1;
  }
  if (typeof left === 'number') return -1;
  if (typeof right === 'number') return 1;
  return left.localeCompare(right);
}

export function compareStudioVersions(left: string, right: string): number {
  const parsedLeft = parseVersion(left);
  const parsedRight = parseVersion(right);
  if (!parsedLeft || !parsedRight) return 0;

  for (let index = 0; index < parsedLeft.core.length; index += 1) {
    const leftPart = parsedLeft.core[index] ?? 0;
    const rightPart = parsedRight.core[index] ?? 0;
    if (leftPart !== rightPart) return leftPart < rightPart ? -1 : 1;
  }

  if (!parsedLeft.prerelease && !parsedRight.prerelease) return 0;
  if (!parsedLeft.prerelease) return 1;
  if (!parsedRight.prerelease) return -1;

  const length = Math.max(
    parsedLeft.prerelease.length,
    parsedRight.prerelease.length,
  );
  for (let index = 0; index < length; index += 1) {
    const leftPart = parsedLeft.prerelease[index];
    const rightPart = parsedRight.prerelease[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    const comparison = compareIdentifier(leftPart, rightPart);
    if (comparison !== 0) return comparison;
  }

  return 0;
}

export function isNewerStudioVersion(
  candidate: string,
  current: string,
): boolean {
  return compareStudioVersions(candidate, current) > 0;
}
