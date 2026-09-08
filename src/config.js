/* Single source of truth for everything deployment-specific.
   Build-time env vars win; the runtime file in public/ is the fallback, so a
   built site can be re-pointed without rebuilding. */

const runtime = (typeof window !== 'undefined' && window.__COLBIOS_CONFIG__) || {};
const env = import.meta.env || {};

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const pick = (envKey, key, fallback = '') =>
  str(env[envKey]) || str(runtime[key]) || fallback;

/* Only http(s) is accepted, so a malformed or hostile config value can never
   turn a Pay Now button into a javascript: URL. */
export function safeUrl(value) {
  const raw = str(value);
  if (!raw) return '';
  try {
    const u = new URL(raw, typeof window !== 'undefined' ? window.location.href : 'https://example.com');
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '';
  } catch {
    return '';
  }
}

const list = (v) => (Array.isArray(v) ? v : []);

export const config = {
  paymentPlatformUrl: safeUrl(pick('VITE_PAYMENT_PLATFORM_URL', 'PAYMENT_PLATFORM_URL')),
  openInNewTab: runtime.OPEN_IN_NEW_TAB === true,
  redirectDelayMs: Math.max(0, parseInt(runtime.REDIRECT_DELAY_MS, 10) || 0),

  institutionName: pick('VITE_INSTITUTION_NAME', 'INSTITUTION_NAME', 'Federal University of Agriculture, Abeokuta'),
  institutionShort: pick('VITE_INSTITUTION_SHORT', 'INSTITUTION_SHORT', 'FUNAAB'),
  institutionRelationship: pick('VITE_INSTITUTION_RELATIONSHIP', 'INSTITUTION_RELATIONSHIP'),

  supportEmail: pick('VITE_SUPPORT_EMAIL', 'SUPPORT_EMAIL'),
  supportPhone: pick('VITE_SUPPORT_PHONE', 'SUPPORT_PHONE'),
  supportHours: pick('VITE_SUPPORT_HOURS', 'SUPPORT_HOURS'),

  privacyUrl: safeUrl(pick('VITE_PRIVACY_URL', 'PRIVACY_URL')),
  termsUrl: safeUrl(pick('VITE_TERMS_URL', 'TERMS_URL')),
  siteUrl: safeUrl(pick('VITE_SITE_URL', 'SITE_URL')),

  /* Data-dependent sections stay unrendered until real values arrive. */
  stats: list(runtime.STATS).filter((s) => s && str(s.value) && str(s.label)),
  partnerLogos: list(runtime.PARTNER_LOGOS).filter((l) => l && str(l.name) && str(l.src)),
  partnerLogosTitle: str(runtime.PARTNER_LOGOS_TITLE) || 'Payments processed with'
};

export const hasSupportContact = Boolean(config.supportEmail || config.supportPhone || config.supportHours);
