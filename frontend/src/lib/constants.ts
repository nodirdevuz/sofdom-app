/**
 * Universal Constants for SofDom
 */

// Modern, self-contained SVG placeholder for apartments without photos or during loading failures.
// Zero network dependencies, zero 404s, renders immediately on Retina displays.
export const FALLBACK_PHOTO_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" fill="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="800" y2="600" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="%231a1d24"/>
      <stop offset="100%" stop-color="%23121418"/>
    </linearGradient>
    <linearGradient id="brand" x1="340" y1="210" x2="460" y2="290" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="%2310b981"/>
      <stop offset="100%" stop-color="%23059669"/>
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(%23bg)"/>
  <circle cx="400" cy="240" r="64" fill="%23222630"/>
  <path d="M370 262V232C370 228.686 372.686 226 376 226H424C427.314 226 430 228.686 430 232V262" stroke="url(%23brand)" stroke-width="4" stroke-linecap="round"/>
  <path d="M360 262H440" stroke="url(%23brand)" stroke-width="4" stroke-linecap="round"/>
  <path d="M386 242H414" stroke="%2334d399" stroke-width="3" stroke-linecap="round"/>
  <path d="M352 272H448" stroke="%23374151" stroke-width="3" stroke-linecap="round"/>
  <text x="400" y="340" fill="%23f3f4f6" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="22" font-weight="600" text-anchor="middle" letter-spacing="1">SofDom</text>
  <text x="400" y="372" fill="%239ca3af" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="14" font-weight="400" text-anchor="middle">Фотография обновляется</text>
</svg>`;

export const DEFAULT_PHOTO = FALLBACK_PHOTO_SVG;
