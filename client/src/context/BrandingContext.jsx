import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../utils/api';
import { mediaUrl } from '../utils/mediaUrl';

export const DEFAULT_BRANDING = { seal: '/cantilan-seal.png', hero: '/town-hall.jpg' };
const CACHE_KEY = 'civix_branding';

const BrandingContext = createContext({ ...DEFAULT_BRANDING, setBranding: () => {} });

function readCache() {
  try {
    return { ...DEFAULT_BRANDING, ...JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') };
  } catch {
    return DEFAULT_BRANDING;
  }
}

// Seal and homepage photo chosen in Settings > Branding. The last known values
// are cached so pages don't flash the default images before the request returns.
export function BrandingProvider({ children }) {
  const [branding, setState] = useState(readCache);

  const setBranding = useCallback(({ sealUrl, heroImageUrl }) => {
    const next = {
      seal: sealUrl ? mediaUrl(sealUrl) : DEFAULT_BRANDING.seal,
      hero: heroImageUrl ? mediaUrl(heroImageUrl) : DEFAULT_BRANDING.hero,
    };
    setState(next);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  }, []);

  useEffect(() => {
    api.get('/settings/public').then(res => setBranding(res.data)).catch(() => {});
  }, [setBranding]);

  return (
    <BrandingContext.Provider value={{ ...branding, setBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}

// <img> for the seal or homepage photo; falls back to the bundled default if
// the uploaded file can't be loaded.
export function BrandImg({ kind, alt = '', ...props }) {
  const branding = useBranding();
  const fallback = DEFAULT_BRANDING[kind];
  return (
    <img {...props} alt={alt} src={branding[kind]}
      onError={e => { if (!e.currentTarget.src.endsWith(fallback)) e.currentTarget.src = fallback; }} />
  );
}
