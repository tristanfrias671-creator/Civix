import React from 'react';

// What the staff portal's two slips share: the satisfaction form's slip ("New
// client") and the walk-in report's slip. A QR code, printing, and small helpers.

// The QR code library is only downloaded when the first slip is shown.
let qrPromise = null;
function loadQr() {
  if (!qrPromise) qrPromise = import('qrcode-generator').then(m => m.default || m);
  return qrPromise;
}

// The QR code of `text` as one SVG path (a square per dark module) and its size.
export async function drawQr(text) {
  const qrcode = await loadQr();
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const size = qr.getModuleCount();
  let path = '';
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (qr.isDark(row, col)) path += `M${col} ${row}h1v1h-1z`;
    }
  }
  return { size, path };
}

const QUIET = 3; // white modules around the code, so phones can find it
export const qrSvg = ({ size, path }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-QUIET} ${-QUIET} ${size + QUIET * 2} ${size + QUIET * 2}" shape-rendering="crispEdges"><rect x="${-QUIET}" y="${-QUIET}" width="${size + QUIET * 2}" height="${size + QUIET * 2}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;

// The QR code on screen: `qr` is { size, path }, 'failed', or null while drawing.
export function QrImage({ qr, label, failedText }) {
  if (qr && qr !== 'failed') {
    return (
      <svg viewBox={`${-QUIET} ${-QUIET} ${qr.size + QUIET * 2} ${qr.size + QUIET * 2}`} shapeRendering="crispEdges"
        className="w-40 h-40" role="img" aria-label={label}>
        <rect x={-QUIET} y={-QUIET} width={qr.size + QUIET * 2} height={qr.size + QUIET * 2} fill="#fff" />
        <path d={qr.path} fill="#000" />
      </svg>
    );
  }
  return (
    <p className="text-xs" style={{ color: '#4b5563' }}>
      {qr === 'failed' ? failedText : 'Drawing the QR code...'}
    </p>
  );
}

export const fmtDate = d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
export const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Prints a slip from a hidden frame, so only the slip is printed.
export function printSlip(html) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed; right:0; bottom:0; width:0; height:0; border:0;';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  doc.open();
  doc.write(html);
  doc.close();
  const remove = () => frame.remove();
  frame.contentWindow.onafterprint = () => setTimeout(remove, 500);
  setTimeout(() => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
  }, 100);
  setTimeout(remove, 120000);
}
