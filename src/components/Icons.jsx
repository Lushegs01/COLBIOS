/* Small inline icons. Decorative by default; callers that need a name pass
   `title`, which turns the icon into an image with an accessible name. */
const base = (title) =>
  title
    ? { role: 'img', 'aria-label': title }
    : { 'aria-hidden': 'true', focusable: 'false' };

export const Mark = ({ size = 28, title }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} {...base(title)}>
    <path d="M12 2.3 20.1 5.4v5.9c0 4.6-3.2 8.4-8.1 10.4-4.9-2-8.1-5.8-8.1-10.4V5.4Z"
      fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M8.3 12.1 10.9 14.8 15.8 9.6" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity=".95" />
  </svg>
);

export const Arrow = ({ size = 17 }) => (
  <svg className="btn__arrow" viewBox="0 0 20 20" width={size} height={size} {...base()}>
    <path d="M3 10h13M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.9"
      strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Shield = ({ size = 18 }) => (
  <svg viewBox="0 0 20 20" width={size} height={size} {...base()}>
    <path d="M10 2.4 16.6 5v4.7c0 3.7-2.6 6.8-6.6 8.4-4-1.6-6.6-4.7-6.6-8.4V5Z"
      fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

export const Check = ({ size = 18 }) => (
  <svg viewBox="0 0 20 20" width={size} height={size} {...base()}>
    <circle cx="10" cy="10" r="7.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M6.9 10.2 9 12.3l4.1-4.4" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Cross = ({ size = 16 }) => (
  <svg viewBox="0 0 20 20" width={size} height={size} {...base()}>
    <circle cx="10" cy="10" r="7.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <path d="M6.6 13.4 13.4 6.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const Cap = ({ size = 18 }) => (
  <svg viewBox="0 0 20 20" width={size} height={size} {...base()}>
    <path d="M10 3 17.5 6.6 10 10.2 2.5 6.6Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M5.6 8.4v3.9c0 1.6 2 2.9 4.4 2.9s4.4-1.3 4.4-2.9V8.4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const Phone = ({ size = 22 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} {...base()}>
    <rect x="7" y="2.6" width="10" height="18.8" rx="2.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <path d="M10.6 18.4h2.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const Receipt = ({ size = 22 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} {...base()}>
    <path d="M6 2.8h9.2L19 6.6v14.6H6Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M9 13.6 11 15.6 15 11.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Fast = ({ size = 22 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} {...base()}>
    <path d="M4 12h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M14 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const LongArrow = () => (
  <svg viewBox="0 0 40 24" width="40" height="24" {...base()}>
    <path d="M2 12h32M27 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
