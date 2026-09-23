// Shared skeleton-loading primitives. Built on plain Tailwind `bg-gray-200
// animate-pulse` blocks so dark mode is handled for free by the existing
// `.dark .bg-gray-200` overrides in index.css — no extra dark-mode logic needed.

export function Skel({ className = '' }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className}`} />;
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
    <table className="w-full">
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
