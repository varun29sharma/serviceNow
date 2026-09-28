/**
 * Icons.
 *
 * Hand-drawn inline SVG rather than an icon package. The client has exactly
 * three dependencies on purpose (react, react-dom, react-router-dom) and pulls
 * the rest of what it needs from the shared engine; a 40 kB icon font to draw
 * eleven glyphs would be the wrong trade. These are the eleven.
 *
 * All of them inherit `currentColor` and take a stroke weight, so a nav item
 * that turns violet on hover takes its icon with it, and the rail and the
 * sidebar stay visually identical when they collapse into one another.
 */

const base = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
  focusable: 'false',
};

export function IconHome(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.6V20h13V9.6" />
      <path d="M10 20v-5.4h4V20" />
    </svg>
  );
}

export function IconLayers(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3 3 7.5l9 4.5 9-4.5L12 3Z" />
      <path d="m3 12.2 9 4.5 9-4.5" />
      <path d="m3 16.7 9 4.5 9-4.5" />
    </svg>
  );
}

export function IconSliders(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2.1" />
      <circle cx="10" cy="17" r="2.1" />
    </svg>
  );
}

export function IconChart(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <path d="M8 17v-6M12.5 17V8M17 17v-9" />
    </svg>
  );
}

export function IconFolder(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2.4h7A1.5 1.5 0 0 1 19 9.9v8.6A1.5 1.5 0 0 1 17.5 20h-13A1.5 1.5 0 0 1 3 18.5v-11Z" />
    </svg>
  );
}

export function IconPlus(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8.5v7M8.5 12h7" />
    </svg>
  );
}

export function IconLogout(props) {
  return (
    <svg {...base} {...props}>
      <path d="M14 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5H14" />
      <path d="M17 8.5 20.5 12 17 15.5" />
      <path d="M9.5 12h10.5" />
    </svg>
  );
}

export function IconMenu(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function IconClose(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function IconSparkle(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.4l-1.9-5.6L4.5 11 10.1 9 12 3.5Z" />
      <path d="M18.5 16.5 19.3 19l2.5.8-2.5.8-.8 2.5" />
    </svg>
  );
}

export function IconShield(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.5 19 6v6c0 4-2.9 7.3-7 8.5-4.1-1.2-7-4.5-7-8.5V6l7-2.5Z" />
      <path d="m9.2 12 2 2 3.6-3.8" />
    </svg>
  );
}

export function IconSearch(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="11" cy="11" r="6.2" />
      <path d="m15.6 15.6 3.9 3.9" />
    </svg>
  );
}

export function IconActivity(props) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 12.5h4l2.4-6 3.3 12 2.5-7 1.6 3.2h3.2" />
    </svg>
  );
}

/**
 * The icon a nav link draws. Keyed by route so the shell and the mobile drawer
 * can never show different glyphs for the same destination.
 */
export const ICONS_BY_ROUTE = {
  '/': IconHome,
  '/student': IconFolder,
  '/submit': IconPlus,
  '/queue': IconLayers,
  '/rules': IconSliders,
  '/dashboard': IconChart,
  '/login': IconShield,
};

export function routeIcon(to) {
  if (ICONS_BY_ROUTE[to]) return ICONS_BY_ROUTE[to];
  // /queue/:group — the provider's single-group queue.
  if (to.startsWith('/queue')) return IconLayers;
  return IconLayers;
}
