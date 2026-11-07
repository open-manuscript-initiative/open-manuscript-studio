import 'dotenv/config';
import { loadPrivacyNotice } from '../config/privacyNotice.js';
try {
  const result = loadPrivacyNotice(process.env.OMI_PRIVACY_CONFIG_PATH);
  console.log(JSON.stringify({ configured: result.configured, legalCertification: false }));
  if (!result.configured) process.exitCode = 1;
} catch {
  console.error('Privacy notice configuration is invalid. Review the public JSON schema and operator runbook.');
  process.exitCode = 1;
}
