import React, { useEffect, useRef } from 'react';
import { loadTurnstile } from '../../utils/reportGuard';

// Cloudflare Turnstile, the "I'm not a robot" check. Usually invisible: a box only
// appears when Cloudflare needs the person to click it. Reports `onToken(token)`
// when the check passes, null when it expires, or 'unavailable' when it can't load
// on this network (the server then allows only a few reports). Changing
// `resetSignal` starts a fresh check (each token works once).
export default function TurnstileBox({ siteKey, theme = 'auto', onToken, resetSignal }) {
  const boxRef = useRef(null);
  const widgetRef = useRef(null);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;

  useEffect(() => {
    let cancelled = false;
    loadTurnstile()
      .then(turnstile => {
        if (cancelled || !boxRef.current) return;
        widgetRef.current = turnstile.render(boxRef.current, {
          sitekey: siteKey,
          appearance: 'interaction-only',
          theme,
          'refresh-expired': 'auto',
          callback: token => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => onTokenRef.current('unavailable'),
        });
      })
      .catch(() => { if (!cancelled) onTokenRef.current('unavailable'); });
    return () => {
      cancelled = true;
      if (widgetRef.current != null && window.turnstile) window.turnstile.remove(widgetRef.current);
      widgetRef.current = null;
      onTokenRef.current(null);
    };
  }, [siteKey, theme]);

  useEffect(() => {
    if (resetSignal && widgetRef.current != null && window.turnstile) {
      onTokenRef.current(null);
      window.turnstile.reset(widgetRef.current);
    }
  }, [resetSignal]);

  return <div ref={boxRef} className="flex justify-center empty:hidden" />;
}
