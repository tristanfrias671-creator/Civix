import api from './api';

// The report form's bot checks (the server side is server/src/utils/formGuard.js):
// a one-time ticket from the server, sent back with the report, and Cloudflare
// Turnstile ("I'm not a robot", usually invisible) when the site has it set up.

// A fresh ticket, plus the Turnstile site key (null when Turnstile isn't set up).
export async function fetchFormTicket() {
  const res = await api.get('/submissions/form-ticket');
  return { ticket: res.data.ticket, siteKey: res.data.turnstileSiteKey || null };
}

// Loads Cloudflare's Turnstile script once. On a slow connection it gives up after
// `timeoutMs` (the check then counts as unavailable, so the form isn't held up);
// the script keeps loading, and the next form that opens uses it if it arrived.
let loading = null;
export function loadTurnstile(timeoutMs = 8000) {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile did not start')));
      script.onerror = () => { loading = null; script.remove(); reject(new Error('Turnstile could not load')); };
      document.head.appendChild(script);
    });
  }
  const tooSlow = new Promise((_, reject) => setTimeout(() => reject(new Error('Turnstile is taking too long')), timeoutMs));
  return Promise.race([loading, tooSlow]);
}
