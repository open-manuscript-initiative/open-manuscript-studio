import { z } from 'zod';

/**
 * Explicit API listen addresses. Keep the historical all-interfaces default
 * for portable/container deployments; Plesk/systemd installations should opt
 * into the IPv4 loopback address after verifying reverse-proxy upstreams.
 *
 * Deliberately reject hostnames, arbitrary addresses and empty values so a
 * typo cannot accidentally change the API's exposure or DNS binding.
 */
export const apiBindHostSchema = z
  .enum(['0.0.0.0', '127.0.0.1', '::', '::1'])
  .default('0.0.0.0');
