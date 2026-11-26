import { useTranslation } from '../i18n';
import type { PendingExternalLaunchPlatform } from '../services/pendingExternalLaunch';

interface PendingExternalLaunchNoticeProps {
  platform: PendingExternalLaunchPlatform;
}

export function PendingExternalLaunchNotice({
  platform,
}: PendingExternalLaunchNoticeProps) {
  const { locale } = useTranslation();
  const copy = getCopy(locale, platform);

  return (
    <aside
      className="auth-pending-external-launch"
      role="status"
      aria-live="polite"
    >
      <strong>{copy.title}</strong>
      <span>{copy.description}</span>
    </aside>
  );
}

function getCopy(locale: string, platform: PendingExternalLaunchPlatform) {
  if (platform === 'ojs-issue') {
    if (locale === 'hu') return { title: 'OJS-lapszám megnyitása folyamatban', description: 'Jelentkezzen be a teljes tervezett folyóiratszám importálásához.' };
    if (locale === 'de') return { title: 'OJS-Ausgabe wartet auf den Import', description: 'Melden Sie sich an, um die gesamte geplante Zeitschriftenausgabe zu importieren.' };
    return { title: 'OJS issue waiting to import', description: 'Sign in to import the complete planned journal issue.' };
  }
  const source = platform === 'ojs' ? 'OJS' : 'OMP';

  if (locale === 'hu') {
    return {
      title: `${source}-kézirat megnyitása folyamatban`,
      description: `Az ${source} rendszerből kiválasztott kézirat megnyitásához jelentkezzen be. Sikeres bejelentkezés után a Stúdió automatikusan megnyitja a kéziratot.`,
    };
  }

  if (locale === 'de') {
    return {
      title: `${source}-Manuskript wartet auf das Öffnen`,
      description: `Melden Sie sich an, um das in ${source} ausgewählte Manuskript zu öffnen. Nach erfolgreicher Anmeldung öffnet Studio das Manuskript automatisch.`,
    };
  }

  return {
    title: `${source} manuscript waiting to open`,
    description: `Sign in to open the manuscript selected in ${source}. After successful sign-in, Studio will open the manuscript automatically.`,
  };
}
