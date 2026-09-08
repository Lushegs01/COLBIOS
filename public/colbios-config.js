/* ============================================================================
   COLBIOS — runtime configuration
   ----------------------------------------------------------------------------
   Edit this file to deploy. It is served unbundled from dist/, so you can
   change it on a built site without rebuilding.

   Build-time environment variables take precedence where both are set:
     VITE_PAYMENT_PLATFORM_URL, VITE_SITE_URL, VITE_SUPPORT_EMAIL,
     VITE_SUPPORT_PHONE, VITE_INSTITUTION_RELATIONSHIP
   Set those in Vercel → Settings → Environment Variables if you prefer.

   Everything is empty by default on purpose: nothing invented ships. Sections
   that depend on real data (statistics, partner logos) do not render at all
   until you supply the values.
   ========================================================================== */
window.__COLBIOS_CONFIG__ = {

  /* ---- The payment platform (REQUIRED) ---------------------------------- */
  /* Where every Pay Now button sends students, e.g. "https://pay.colbios.example/".
     Until this is set, Pay Now explains it is unconfigured rather than 404ing. */
  PAYMENT_PLATFORM_URL: '',
  OPEN_IN_NEW_TAB: false,
  REDIRECT_DELAY_MS: 650,

  /* ---- Institution wording ----------------------------------------------- */
  INSTITUTION_NAME: 'Federal University of Agriculture, Abeokuta',
  INSTITUTION_SHORT: 'FUNAAB',
  /* Leave empty unless the relationship is established AND you are authorised
     to state it. Never claim ownership, endorsement or accreditation. */
  INSTITUTION_RELATIONSHIP: '',

  /* ---- Support ------------------------------------------------------------ */
  /* Empty = the site points students at the payment platform's own support,
     rather than showing a contact that does not exist. */
  SUPPORT_EMAIL: '',
  SUPPORT_PHONE: '',
  SUPPORT_HOURS: '',

  /* ---- Optional pages ----------------------------------------------------- */
  PRIVACY_URL: '',
  TERMS_URL: '',
  SITE_URL: '',

  /* ---- Statistics band (hidden until you fill it) -------------------------- */
  /* Supply REAL, verifiable figures only. The band does not render while this
     array is empty, so nothing invented can ship by accident.

     Example once you have real numbers:
       STATS: [
         { value: '12,480', label: 'Payments completed' },
         { value: '4',      label: 'Colleges served' }
       ]
     `note` is optional and prints under the label. */
  STATS: [],

  /* ---- Partner / accepted-payment logos (hidden until you fill it) --------- */
  /* Only add logos you have permission to display. Each entry needs `name`
     and `src` (put image files in public/logos/). `href` is optional.

     Example:
       PARTNER_LOGOS: [
         { name: 'Example Bank', src: '/logos/example-bank.svg' }
       ] */
  PARTNER_LOGOS: [],
  PARTNER_LOGOS_TITLE: 'Payments processed with'
};
