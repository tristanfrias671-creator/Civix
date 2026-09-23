import React, { useEffect, useState } from 'react';
import { SkeletonList } from '../../components/common/Skeleton';
import Icon from '../../components/common/Icons';
import { StatusBadge, TypeBadge } from '../../components/common/StatusBadge';
import api from '../../utils/api';

export default function Citizens() {
  const [citizens, setCitizens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/analytics/citizens').then(r => {
      setCitizens(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function viewHistory(citizen) {
    setSelected(citizen);
    setHistoryLoading(true);
    try {
      const res = await api.get(`/submissions/user/${citizen.id}`);
      setHistory(res.data);
    } catch { setHistory([]); }
    setHistoryLoading(false);
  }

  const filtered = citizens.filter(c =>
    c.fullName.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.citizenId.toLowerCase().includes(search.toLowerCase()) ||
    (c.gmail && c.gmail.toLowerCase().includes(search.toLowerCase())) ||
    (c.mobileNumber && c.mobileNumber.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Citizens</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email, or ID..."
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          {loading ? <div className="p-3"><SkeletonList rows={6} /></div> : (
            <div className="divide-y divide-gray-50">
              {filtered.map(c => (
                <div key={c.id}
                  className={`px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors ${selected?.id === c.id ? 'bg-blue-50 border-l-4 border-primary' : ''}`}
                  onClick={() => viewHistory(c)}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-gray-800">{c.fullName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{c.email}</p>
                      {c.gmail && <p className="text-xs text-gray-400">{c.gmail}</p>}
                      {c.mobileNumber && <p className="text-xs text-gray-400">{c.mobileNumber}</p>}
                      <p className="text-xs font-mono text-gray-400">{c.citizenId}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary">{c._count.submissions}</p>
                      <p className="text-xs text-gray-400">submissions</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Joined {new Date(c.createdAt).toLocaleDateString()}</p>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="py-12 text-center text-gray-400">No citizens found</div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col">
          {!selected ? (
            <div className="flex items-center justify-center h-64 text-gray-400 flex-col gap-2">
              <Icon name="citizens" className="w-10 h-10 text-gray-300" />
              <p>Select a citizen to view their profile</p>
            </div>
          ) : (
            <>
              {/* Profile Header */}
              <div className="px-5 py-5 border-b border-gray-100">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center text-xl font-bold flex-shrink-0">
                    {selected.fullName?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-800 text-base">{selected.fullName}</h2>
                    <p className="text-xs font-mono text-gray-400 mt-0.5">{selected.citizenId}</p>
                    <p className="text-xs text-gray-400">Joined {new Date(selected.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Contact Information</p>
                  <div className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                    </svg>
                    <span className="text-xs text-gray-700">{selected.email}</span>
                  </div>
                  {selected.gmail && (
                    <div className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 010 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L12 9.64l8.073-6.147C21.69 2.28 24 3.434 24 5.457z"/>
                      </svg>
                      <span className="text-xs text-gray-700">{selected.gmail}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                    </svg>
                    <span className="text-xs text-gray-700">{selected.mobileNumber || <span className="text-gray-400 italic">No phone number</span>}</span>
                  </div>
                </div>

                {/* Submission stats */}
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {[
                    { label: 'Total', value: history.length, color: 'text-gray-800' },
                    { label: 'Resolved', value: history.filter(s => s.status === 'RESOLVED').length, color: 'text-green-600' },
                    { label: 'Pending', value: history.filter(s => s.status === 'PENDING').length, color: 'text-amber-500' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-gray-50 rounded-lg p-2.5 text-center">
                      <p className={`text-lg font-bold ${color}`}>{value}</p>
                      <p className="text-xs text-gray-400">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submissions List */}
              <div className="px-5 py-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Submitted Complaints</p>
              </div>

              {historyLoading ? <div className="p-3"><SkeletonList rows={4} avatar={false} /></div> : (
                <div className="divide-y divide-gray-50 overflow-y-auto" style={{ maxHeight: '340px' }}>
                  {history.length === 0 ? (
                    <div className="py-12 text-center text-gray-400">No submissions yet</div>
                  ) : history.map(s => (
                    <div key={s.id} className="px-5 py-4">
                      <div className="flex justify-between items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-xs text-gray-400">{s.trackingId}</p>
                          <p className="text-sm font-semibold text-gray-800 mt-0.5 truncate">{s.department}</p>
                          {s.description && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{s.description}</p>
                          )}
                          {s.address && (
                            <div className="flex items-center gap-1 mt-1">
                              <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                              </svg>
                              <span className="text-xs text-gray-400 truncate">{s.address}</span>
                            </div>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1 items-end flex-shrink-0">
                          <TypeBadge type={s.type} />
                          <StatusBadge status={s.status} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
