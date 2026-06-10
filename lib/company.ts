// ── lib/company.ts ────────────────────────────────────────────────────────────
// Single source of truth for product branding and legal-entity constants.
// Change values here — never hardcode company info in components or templates.

// Product
export const PRODUCT_NAME    = 'Ridgeline';
export const PRODUCT_TAGLINE =
  'From Takeoff to Tax Time. No Penny Left Behind.';

// Legal entity — do not use for product branding
export const COMPANY_NAME    = 'Oak Ridge Electrical LLC';
export const COMPANY_DBA     = 'Oak Ridge Electrical';

// Contact
export const COMPANY_ADDRESS = '209 W. River Rd, Hooksett, NH 03106';
export const COMPANY_PHONE   = '603-660-4651';
export const COMPANY_EMAIL   = 'Justin@oakridgeelectrical.com';
export const COMPANY_LICENSE = 'NH Electrical License # 15117';

// Brand colors — values unchanged for now; the rebrand edits this file only
export const BRAND_BLUE   = '#002D72';  // will update in rebrand
export const BRAND_ORANGE = '#FF5910';  // stays

// Logo URL — absolute for PDF/email embeds
export const LOGO_URL = 'https://oak-ridge-pm.vercel.app/logo.png';
