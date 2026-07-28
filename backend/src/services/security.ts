import { Request } from 'express';
import * as net from 'net';
import { query } from '../config/db';

export type IpRestrictionSettings = {
  enabled: boolean;
  mode: 'whitelist';
  allowed_ranges: string[];
  apply_to_attachments: boolean;
};

type SecurityLogInput = {
  req: Request;
  actorUserId?: number | null;
  targetUserId?: number | null;
  articleId?: number | null;
  action: string;
  status: 'allowed' | 'denied' | 'success' | 'failed';
  metadata?: Record<string, unknown>;
};

const stripIpv6Prefix = (value: string) => value.replace(/^::ffff:/i, '');

export const getClientIp = (req: Request) => {
  const raw = req.ip || req.socket.remoteAddress || '';
  const clean = stripIpv6Prefix(raw).replace(/^\[|\]$/g, '').trim();
  return clean || 'unknown';
};

export const normalizeIpRestrictionSettings = (input: any): IpRestrictionSettings => {
  const rawRanges = Array.isArray(input?.allowed_ranges)
    ? input.allowed_ranges
    : typeof input?.allowed_ranges === 'string'
      ? input.allowed_ranges.split(/[\n,]/)
      : [];

  return {
    enabled: !!input?.enabled,
    mode: 'whitelist',
    allowed_ranges: Array.from(new Set(
      rawRanges
        .map((item: unknown) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 200)
    )),
    apply_to_attachments: input?.apply_to_attachments !== false,
  };
};

export const logSecurityEvent = async ({
  req,
  actorUserId,
  targetUserId,
  articleId,
  action,
  status,
  metadata = {},
}: SecurityLogInput) => {
  try {
    await query(
      `INSERT INTO security_audit_logs (
         actor_user_id,
         target_user_id,
         article_id,
         action,
         status,
         ip_address,
         user_agent,
         metadata
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        actorUserId || null,
        targetUserId || null,
        articleId || null,
        action,
        status,
        getClientIp(req),
        req.headers['user-agent'] || '',
        JSON.stringify(metadata || {}),
      ]
    );
  } catch (error) {
    console.error('Failed to write security audit log:', error);
  }
};

const ipv4ToBigInt = (ip: string) => {
  const parts = ip.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }

  return parts.reduce((acc, part) => (acc << 8n) + BigInt(part), 0n);
};

const ipv4ToIpv6Tail = (ip: string) => {
  const value = ipv4ToBigInt(ip);
  if (value === null) return null;
  return [
    Number((value >> 16n) & 0xffffn).toString(16),
    Number(value & 0xffffn).toString(16),
  ];
};

const ipv6ToBigInt = (ip: string) => {
  const normalized = ip.toLowerCase();
  const ipv4Match = normalized.match(/^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  let source = normalized;

  if (ipv4Match) {
    const tail = ipv4ToIpv6Tail(ipv4Match[2]);
    if (!tail) return null;
    source = `${ipv4Match[1]}${tail[0]}:${tail[1]}`;
  }

  if ((source.match(/::/g) || []).length > 1) return null;

  const [headRaw, tailRaw] = source.split('::');
  const head = headRaw ? headRaw.split(':').filter(Boolean) : [];
  const tail = tailRaw ? tailRaw.split(':').filter(Boolean) : [];
  const missing = 8 - head.length - tail.length;
  if (missing < 0) return null;

  const segments = [
    ...head,
    ...Array.from({ length: missing }, () => '0'),
    ...tail,
  ];

  if (segments.length !== 8) return null;

  let value = 0n;
  for (const segment of segments) {
    if (!/^[0-9a-f]{1,4}$/i.test(segment)) return null;
    value = (value << 16n) + BigInt(parseInt(segment, 16));
  }
  return value;
};

const ipToComparable = (ip: string) => {
  const normalized = stripIpv6Prefix(ip).trim();
  const family = net.isIP(normalized);

  if (family === 4) {
    const value = ipv4ToBigInt(normalized);
    return value === null ? null : { value, bits: 32, family: 4 as const };
  }

  if (family === 6) {
    const value = ipv6ToBigInt(normalized);
    return value === null ? null : { value, bits: 128, family: 6 as const };
  }

  return null;
};

const ipMatchesRule = (clientIp: string, rule: string) => {
  const [rawNetwork, rawPrefix] = rule.trim().split('/');
  const client = ipToComparable(clientIp);
  const network = ipToComparable(rawNetwork);

  if (!client || !network || client.family !== network.family) return false;

  if (rawPrefix === undefined) {
    return client.value === network.value;
  }

  const prefix = Number(rawPrefix);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > client.bits) return false;
  if (prefix === 0) return true;

  const shift = BigInt(client.bits - prefix);
  return (client.value >> shift) === (network.value >> shift);
};

export const isIpAllowedBySettings = (clientIp: string, settings: IpRestrictionSettings) => {
  if (!settings.enabled) return true;
  if (!settings.allowed_ranges.length) return false;
  return settings.allowed_ranges.some((rule) => ipMatchesRule(clientIp, rule));
};

export type OperatorIpRestrictionSettings = {
  enabled: boolean;
  allowed_ranges: string[];
  apply_to_roles: string[];
  apply_to_all_operators: boolean;
  updated_at?: string;
  updated_by_name?: string;
};

export const defaultOperatorIpRestrictionSettings = (): OperatorIpRestrictionSettings => ({
  enabled: false,
  allowed_ranges: [],
  apply_to_roles: ['reader', 'editor', 'process_owner', 'approver'],
  apply_to_all_operators: true,
});

export const getOperatorIpRestrictionSettings = async (): Promise<OperatorIpRestrictionSettings> => {
  try {
    const res = await query(`SELECT value FROM system_security_settings WHERE key = 'operator_ip_restriction' LIMIT 1`);
    if (res.rows.length === 0) {
      return defaultOperatorIpRestrictionSettings();
    }
    const val = res.rows[0].value;
    return {
      enabled: !!val?.enabled,
      allowed_ranges: Array.isArray(val?.allowed_ranges) ? val.allowed_ranges : [],
      apply_to_roles: Array.isArray(val?.apply_to_roles) ? val.apply_to_roles : ['reader', 'editor', 'process_owner', 'approver'],
      apply_to_all_operators: val?.apply_to_all_operators !== false,
      updated_at: val?.updated_at || undefined,
      updated_by_name: val?.updated_by_name || undefined,
    };
  } catch (error) {
    console.error('Failed to load operator IP restriction settings:', error);
    return defaultOperatorIpRestrictionSettings();
  }
};

export const updateOperatorIpRestrictionSettings = async (
  settings: Partial<OperatorIpRestrictionSettings>,
  userId?: number | null,
  userName?: string | null
): Promise<OperatorIpRestrictionSettings> => {
  const current = await getOperatorIpRestrictionSettings();
  const rawRanges = Array.isArray(settings.allowed_ranges)
    ? settings.allowed_ranges
    : typeof settings.allowed_ranges === 'string'
    ? (settings.allowed_ranges as string).split(/[\n,]/)
    : current.allowed_ranges;

  const cleanRanges = Array.from(
    new Set(rawRanges.map((item) => String(item || '').trim()).filter(Boolean))
  );

  const updated: OperatorIpRestrictionSettings = {
    enabled: settings.enabled !== undefined ? !!settings.enabled : current.enabled,
    allowed_ranges: cleanRanges,
    apply_to_roles: Array.isArray(settings.apply_to_roles) ? settings.apply_to_roles : current.apply_to_roles,
    apply_to_all_operators: settings.apply_to_all_operators !== undefined ? !!settings.apply_to_all_operators : current.apply_to_all_operators,
    updated_at: new Date().toISOString(),
    updated_by_name: userName || 'Администратор Wiki',
  };

  await query(
    `INSERT INTO system_security_settings (key, value, updated_at, updated_by)
     VALUES ('operator_ip_restriction', $1, NOW(), $2)
     ON CONFLICT (key) DO UPDATE
     SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
    [JSON.stringify(updated), userId || null]
  );

  return updated;
};

export const isOperatorPosition = (positionName?: string | null, legacyRole?: string | null): boolean => {
  const pos = (positionName || '').toLowerCase();
  const role = (legacyRole || '').toLowerCase();
  return pos.includes('оператор') || pos.includes('operator') || role.includes('operator') || role.includes('оператор');
};

export const isOperatorIpAllowed = (clientIp: string, settings: OperatorIpRestrictionSettings, userRole?: string | null): boolean => {
  if (!settings.enabled) return true;

  if (!settings.allowed_ranges || settings.allowed_ranges.length === 0) {
    return false;
  }

  // Wiki Admin bypass
  if (userRole && (userRole === 'Admin' || userRole === 'Администратор Wiki' || userRole === 'wiki_admin')) {
    return true;
  }

  return settings.allowed_ranges.some((rule) => ipMatchesRule(clientIp, rule));
};


