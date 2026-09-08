/* ============================================================================
   COLBIOS — deployment configuration
   ----------------------------------------------------------------------------
   THE ONLY FILE YOU NEED TO EDIT TO DEPLOY THIS SITE.

   This landing page does not process payments. It explains COLBIOS and hands
   students off to the separate COLBIOS payment platform. Every "Pay Now"
   button on the site reads its destination from PAYMENT_PLATFORM_URL below —
   there is no payment URL written anywhere else in the codebase.

   Nothing here is invented. Values left empty degrade gracefully: the page
   stays honest rather than showing a placeholder that looks real.
   ========================================================================== */
window.__COLBIOS_CONFIG__ = {

  /* ---- The payment platform -------------------------------------------- */

  /* REQUIRED. The full URL students are sent to when they press Pay Now,
     e.g. "https://pay.colbios.example/". Until this is set, Pay Now explains
     that the platform link has not been configured instead of going nowhere. */
  PAYMENT_PLATFORM_URL: '',

  /* Open the payment platform in a new tab instead of the same tab.
     Same tab is the default: students expect a checkout to replace the page,
     and new tabs are easy to lose on mobile. */
  OPEN_IN_NEW_TAB: false,

  /* Milliseconds to show "Opening COLBIOS payment platform…" before
     redirecting. Set to 0 to redirect immediately. Ignored when the visitor
     has asked for reduced motion. */
  REDIRECT_DELAY_MS: 650,

  /* ---- Institution wording ---------------------------------------------- */

  INSTITUTION_NAME: 'Federal University of Agriculture, Abeokuta',
  INSTITUTION_SHORT: 'FUNAAB',

  /* OPTIONAL. A sentence describing the relationship between COLBIOS and the
     institution — shown in the footer. Leave empty unless the relationship is
     established and you are authorised to state it. Do not claim ownership,
     endorsement or accreditation that does not exist. */
  INSTITUTION_RELATIONSHIP: '',

  /* ---- Support ----------------------------------------------------------- */

  /* OPTIONAL. Leave empty and the site tells students to use the support
     channel on the payment platform, rather than showing a contact that
     does not exist. */
  SUPPORT_EMAIL: '',
  SUPPORT_PHONE: '',
  SUPPORT_HOURS: '',

  /* ---- Optional pages ---------------------------------------------------- */

  /* OPTIONAL. Leave empty and the footer shows the label as plain text rather
     than a link to a page that does not exist. */
  PRIVACY_URL: '',
  TERMS_URL: '',

  /* ---- Site --------------------------------------------------------------- */

  /* OPTIONAL. The public URL of this landing page. When set, it updates the
     canonical and og:url tags at runtime. Also set them directly in
     index.html so crawlers that do not run JavaScript see the real value. */
  SITE_URL: ''
};
