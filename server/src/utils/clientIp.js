const net = require('net');

// The visitor's IP address, used only for soft limits. Behind Hostinger's CDN the
// address arrives in X-Forwarded-For; the first entry is the visitor. A determined
// attacker can fake that header, so IP limits are one layer among several: the
// per-phone/email limits, the form ticket and the site-wide caps don't depend on it.
// Using the first entry never lumps every real visitor together under the CDN's
// own address (which would block everyone at once).
function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return (forwarded || req.socket?.remoteAddress || 'unknown').slice(0, 64);
}

// False for private, loopback and link-local addresses (and for anything that isn't
// an address at all).
function isPublicAddress(ip) {
  const value = String(ip).replace(/^::ffff:/i, '');
  if (net.isIPv4(value)) {
    const [a, b] = value.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127));
  }
  if (net.isIPv6(value)) {
    const v = value.toLowerCase();
    return !(v === '::' || v === '::1' || /^f[cd]/.test(v) || /^fe[89ab]/.test(v));
  }
  return false;
}

// The address to count per-network limits under, or null when there is none to go
// by. A private or loopback address is what a proxy in front of the app shows when
// it doesn't pass the visitor's address on; counting all of those together would
// put the whole town under one limit, so such requests are held only to the
// per-phone/email and site-wide limits.
function networkKey(req) {
  const ip = clientIp(req);
  return isPublicAddress(ip) ? ip : null;
}

module.exports = { clientIp, networkKey, isPublicAddress };
