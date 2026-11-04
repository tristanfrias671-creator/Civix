import React from 'react';

// The red star after the name of a field that must be filled in. Screen readers
// skip it: the field itself is marked required, or its message says so.
export function Req() {
  return <span data-req className="font-bold text-red-700" aria-hidden="true"> *</span>;
}

// A field name from the language files ends in " *" when the field is required:
// the name, then the red star.
export function Starred({ children }) {
  const m = /^(.*?)\s*\*$/.exec(typeof children === 'string' ? children : '');
  return m ? <>{m[1]}<Req /></> : children;
}

// The note at the top of a form that says what the star means: "* Required field"
// (the panel asked for it on every form with starred fields).
export function RequiredNote({ children = 'Required field', className = '' }) {
  return (
    <p data-required-note className={`text-sm text-gray-700 ${className}`}>
      <span className="font-bold text-red-700">*</span> {children}
    </p>
  );
}
