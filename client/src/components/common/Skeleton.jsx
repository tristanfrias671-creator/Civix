import { useCallback, useRef } from 'react';

// Shared skeleton-loading primitives. The shimmer sweep and its dark-mode
// colors live in index.css (.skel-shimmer / .skel-shimmer-dark).

// Minimum time a page's skeleton stays visible after the page opens, so it
// doesn't just flash when data loads instantly.
export const MIN_SKELETON_MS = 1500;

// Wrap a page's fetch promise with gate(): it resolves no earlier than
// MIN_SKELETON_MS after the page mounted. Measured from mount time, so later
// refetches (filters, pagination) aren't slowed down.
export function useSkeletonGate() {
  const mountedAt = useRef(Date.now());
  return useCallback(promise => {
    const remaining = MIN_SKELETON_MS - (Date.now() - mountedAt.current);
    if (remaining <= 0) return promise;
    const wait = new Promise(resolve => setTimeout(resolve, remaining));
    return Promise.all([promise, wait]).then(([result]) => result);
  }, []);
}

export function Skel({ className = '', style }) {
  return <div className={`skel-shimmer rounded ${className}`} style={style} />;
}

function SkelOnDark({ className = '' }) {
  return <div className={`skel-shimmer-dark rounded ${className}`} />;
}

export function SkeletonStatCards({ count = 4, className = '' }) {
  return (
    <div className={`grid gap-3 ${className}`} style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-gray-100 bg-white p-4">
          <Skel className="h-3 w-2/3 mb-3" />
          <Skel className="h-6 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonQuickLinks({ count = 4, className = '' }) {
  return (
    <div className={`grid gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4">
          <Skel className="w-10 h-10 rounded-xl flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <Skel className="h-3.5 w-24 mb-2" />
            <Skel className="h-3 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonTableRows({ cols = 5, rows = 8 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-gray-100">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-4 py-3">
              <Skel className="h-4" style={{ width: `${55 + ((r + c) % 4) * 10}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function SkeletonTable({ cols = 5, rows = 8 }) {
  return (
    <table className="mobile-cards w-full">
      <tbody>
        <SkeletonTableRows cols={cols} rows={rows} />
      </tbody>
    </table>
  );
}

export function SkeletonList({ rows = 5, avatar = true, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-100 p-3">
          {avatar && <Skel className="h-9 w-9 rounded-full flex-shrink-0" />}
          <div className="flex-1 min-w-0">
            <Skel className="h-3.5 w-1/3 mb-2" />
            <Skel className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '', height = 'h-40' }) {
  return <div className={`rounded-xl border border-gray-100 bg-white p-4 ${className}`}><Skel className={`w-full ${height}`} /></div>;
}

export function SkeletonDetail({ className = '' }) {
  return (
    <div className={`grid grid-cols-1 lg:grid-cols-3 gap-4 ${className}`}>
      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-xl border border-gray-100 bg-white p-5">
          <Skel className="h-5 w-1/3 mb-4" />
          <Skel className="h-3 w-full mb-2" />
          <Skel className="h-3 w-full mb-2" />
          <Skel className="h-3 w-2/3" />
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-5">
          <Skel className="h-5 w-1/4 mb-4" />
          <div className="grid grid-cols-3 gap-3">
            <Skel className="h-24" />
            <Skel className="h-24" />
            <Skel className="h-24" />
          </div>
        </div>
      </div>
      <div className="space-y-4">
        <div className="rounded-xl border border-gray-100 bg-white p-5">
          <Skel className="h-5 w-1/2 mb-4" />
          <Skel className="h-3 w-full mb-2" />
          <Skel className="h-3 w-3/4 mb-2" />
          <Skel className="h-3 w-2/3" />
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-5 space-y-3">
          <Skel className="h-9 w-full" />
          <Skel className="h-9 w-full" />
          <Skel className="h-9 w-full" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonAppShell() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      <aside className="hidden md:flex w-64 flex-col flex-shrink-0" style={{ background: 'linear-gradient(180deg, #0b2f66 0%, #081d40 100%)' }}>
        <div className="flex items-center gap-3 px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <SkelOnDark className="w-10 h-10 rounded-full" />
          <div className="flex-1">
            <SkelOnDark className="h-3 w-24 mb-2" />
            <SkelOnDark className="h-2.5 w-16" />
          </div>
        </div>
        <div className="px-4 py-5 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkelOnDark key={i} className="h-9 rounded-lg" />
          ))}
        </div>
      </aside>
      <main className="flex-1 overflow-hidden">
        <div className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6">
          <Skel className="h-4 w-40" />
          <Skel className="h-9 w-9 rounded-full" />
        </div>
        <div className="p-6 max-w-7xl mx-auto">
          <Skel className="h-6 w-64 mb-6" />
          <SkeletonDashboard statCards={4} statCards2={3} tableCols={6} tableRows={6} />
        </div>
      </main>
    </div>
  );
}

export function SkeletonDashboard({ statCards = 4, statCards2 = 0, tableCols = 5, tableRows = 6, className = '' }) {
  return (
    <div className={className}>
      <SkeletonStatCards count={statCards} className="mb-3" />
      {statCards2 > 0 && <SkeletonStatCards count={statCards2} className="mb-5" />}
      <div className="rounded-xl border border-gray-100 bg-white overflow-hidden mt-5">
        <div className="p-4 border-b border-gray-100"><Skel className="h-4 w-40" /></div>
        <SkeletonTable cols={tableCols} rows={tableRows} />
      </div>
    </div>
  );
}
