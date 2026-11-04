import React from 'react';

// The plain line faces of the satisfaction scale, as printed on ARTA's Client
// Satisfaction Measurement form: 1 Strongly Disagree (open frown) to 5 Strongly
// Agree (open smile). Drawn in the text color, so they follow the page in light
// and dark mode. They only decorate: the words of the answer always go with them.
const MOUTHS = {
  1: { d: 'M7.6 17.4c1.3-3.6 7.5-3.6 8.8 0z', filled: true },
  2: { d: 'M8.4 16.4c2-2.6 5.2-2.6 7.2 0' },
  3: { d: 'M8.5 15.2h7' },
  4: { d: 'M8.4 14c2 2.6 5.2 2.6 7.2 0' },
  5: { d: 'M7.4 13.4h9.2c-.4 4.4-8.8 4.4-9.2 0z', filled: true },
};

export default function CsmFace({ value, className = 'w-6 h-6', strokeWidth = 1.6, style }) {
  const mouth = MOUTHS[value];
  if (!mouth) return null;
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" data-csm-face={value}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="8.6" cy="9.6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15.4" cy="9.6" r="1.2" fill="currentColor" stroke="none" />
      <path d={mouth.d} fill={mouth.filled ? 'currentColor' : 'none'} />
    </svg>
  );
}
