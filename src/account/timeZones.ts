export interface TimeZoneOption {
  id: string;
  label: string;
}

type IntlWithSupportedValues = typeof Intl & {
  supportedValuesOf?: (key: 'timeZone') => string[];
};

const FALLBACK_TIME_ZONES = [
  'UTC',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'America/Anchorage',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Mexico_City',
  'America/New_York',
  'America/Sao_Paulo',
  'America/Toronto',
  'America/Vancouver',
  'Asia/Dubai',
  'Asia/Hong_Kong',
  'Asia/Jerusalem',
  'Asia/Kolkata',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Melbourne',
  'Australia/Sydney',
  'Europe/Amsterdam',
  'Europe/Berlin',
  'Europe/Brussels',
  'Europe/Budapest',
  'Europe/London',
  'Europe/Madrid',
  'Europe/Paris',
  'Europe/Prague',
  'Europe/Rome',
  'Europe/Vienna',
  'Europe/Warsaw',
  'Pacific/Auckland',
] as const;

export function getTimeZoneOptions(selectedTimeZone?: string): TimeZoneOption[] {
  const intl = Intl as IntlWithSupportedValues;
  const supported = intl.supportedValuesOf?.('timeZone') ?? [...FALLBACK_TIME_ZONES];
  const ids = new Set<string>(['UTC', ...supported]);

  if (selectedTimeZone?.trim() && isValidTimeZone(selectedTimeZone)) {
    ids.add(selectedTimeZone.trim());
  }

  return [...ids]
    .sort((left, right) => left.localeCompare(right, 'en'))
    .map((id) => ({
      id,
      label: `${id} (${formatUtcOffset(id)})`,
    }));
}

export function getSystemTimeZone(): string {
  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone?.trim();
  return detected && isValidTimeZone(detected) ? detected : 'UTC';
}

export function isValidTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function formatUtcOffset(timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'longOffset',
    }).formatToParts(new Date());
    const offset = parts.find((part) => part.type === 'timeZoneName')?.value;
    if (!offset || offset === 'GMT') return 'UTC+00:00';
    return offset.replace(/^GMT/, 'UTC');
  } catch {
    return 'UTC';
  }
}
