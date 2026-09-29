import { useLayoutEffect, useRef } from 'react';

// Attach the returned ref to a <table className="mobile-cards">. After each
// render it copies every column's header text onto that column's cells as
// data-label, which the phone-width CSS in index.css shows as the row label.
export default function useMobileTable() {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const table = ref.current;
    if (!table) return;
    const labels = [...table.querySelectorAll('thead th')].map(th => th.textContent.replace(/[↓↑]/g, '').trim());
    table.querySelectorAll('tbody tr').forEach(tr => {
      [...tr.children].forEach((td, i) => {
        if (labels[i] !== undefined && td.getAttribute('data-label') !== labels[i]) {
          td.setAttribute('data-label', labels[i]);
        }
      });
    });
  });
  return ref;
}
