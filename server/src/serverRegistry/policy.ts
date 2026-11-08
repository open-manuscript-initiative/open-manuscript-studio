export const HEARTBEAT_INTERVAL_SECONDS = 24 * 60 * 60;
export const HEARTBEAT_FRESH_FOR_SECONDS = 48 * 60 * 60;
export const DIRECTORY_REFRESH_SECONDS = 24 * 60 * 60;
export const DIRECTORY_PROTOCOL = 'omi-studio-directory-v1';

export function hasRecentHeartbeat(lastSeen: Date | null, now: number): boolean {
  if (!lastSeen) return false;
  const age = now - lastSeen.getTime();
  return age >= 0 && age <= HEARTBEAT_FRESH_FOR_SECONDS * 1000;
}
