// SVG Asset Illustrations for Store Products

const SVGAssets = {
  'smart-hub': `
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="12" y="20" width="40" height="28" rx="6" fill="#3B82F6" fill-opacity="0.15" stroke="#2563EB" stroke-width="2.5"/>
      <circle cx="32" cy="34" r="8" fill="#2563EB" fill-opacity="0.2" stroke="#2563EB" stroke-width="2"/>
      <circle cx="32" cy="34" r="3" fill="#2563EB"/>
      <path d="M22 14L32 20L42 14" stroke="#60A5FA" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `,
  'wireless-mic': `
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="26" y="12" width="12" height="24" rx="6" fill="#10B981" fill-opacity="0.15" stroke="#059669" stroke-width="2.5"/>
      <path d="M20 28C20 34.6274 25.3726 40 32 40C38.6274 40 44 34.6274 44 28" stroke="#059669" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M32 40V50M24 50H40" stroke="#059669" stroke-width="2.5" stroke-linecap="round"/>
    </svg>
  `,
  'ai-dev-cam': `
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="10" y="18" width="44" height="30" rx="6" fill="#8B5CF6" fill-opacity="0.15" stroke="#7C3AED" stroke-width="2.5"/>
      <circle cx="32" cy="33" r="9" fill="#7C3AED" fill-opacity="0.2" stroke="#7C3AED" stroke-width="2.5"/>
      <circle cx="32" cy="33" r="4" fill="#7C3AED"/>
      <circle cx="46" cy="24" r="2" fill="#EC4899"/>
    </svg>
  `,
  'charging-dock': `
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="14" y="38" width="36" height="12" rx="4" fill="#F59E0B" fill-opacity="0.15" stroke="#D97706" stroke-width="2.5"/>
      <path d="M32 14L26 28H34L28 42" stroke="#D97706" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `,
  'carry-case': `
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="12" y="24" width="40" height="26" rx="5" fill="#6B7280" fill-opacity="0.15" stroke="#4B5563" stroke-width="2.5"/>
      <path d="M24 24V18C24 15.7909 25.7909 14 28 14H36C38.2091 14 40 15.7909 40 18V24" stroke="#4B5563" stroke-width="2.5"/>
      <line x1="12" y1="34" x2="52" y2="34" stroke="#4B5563" stroke-width="2"/>
    </svg>
  `,
  'usbc-cable-set': `
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 20C16 32 48 32 48 44" stroke="#3B82F6" stroke-width="3" stroke-linecap="round"/>
      <rect x="11" y="14" width="10" height="8" rx="2" fill="#2563EB"/>
      <rect x="43" y="42" width="10" height="8" rx="2" fill="#2563EB"/>
    </svg>
  `,
  'desk-mount': `
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 48H44M32 48V20M32 20L20 12M32 20L44 12" stroke="#475569" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="26" y="44" width="12" height="8" rx="2" fill="#334155"/>
    </svg>
  `,
  'pro-monthly': `
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 38C16 30 22 24 32 24C40 24 46 28 48 34" stroke="#2563EB" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M12 40C12 45.5228 16.4772 50 22 50H44C48.4183 50 52 46.4183 52 42C52 37.5817 48.4183 34 44 34" stroke="#2563EB" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M32 14L37 20H27L32 14Z" fill="#F59E0B"/>
    </svg>
  `,
  'pro-annual': `
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="22" fill="#FEF3C7" stroke="#D97706" stroke-width="2.5"/>
      <path d="M32 18V32L40 36" stroke="#D97706" stroke-width="2.5" stroke-linecap="round"/>
    </svg>
  `,
  'starter-plan': `
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="16" width="32" height="32" rx="8" fill="#F3F4F6" stroke="#9CA3AF" stroke-width="2.5"/>
      <path d="M24 32L30 38L40 26" stroke="#10B981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `,
  'default': `
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="16" width="32" height="32" rx="6" fill="#F3F4F6" stroke="#9CA3AF" stroke-width="2"/>
      <circle cx="32" cy="32" r="6" fill="#9CA3AF"/>
    </svg>
  `
};

function getProductSVG(productId) {
  return SVGAssets[productId] || SVGAssets['default'];
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getProductSVG };
}
