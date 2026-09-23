import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { SkeletonStatCards, SkeletonTable } from '../../components/common/Skeleton';
import api from '../../utils/api';

const DEPARTMENTS = ['HR'];

const EMPTY_FORM = { fullName: '', email: '', password: '', department: '' };

// ── Modal ─────────────────────────────────────────────────────────────────────
function StaffModal({ open, onClose, onSaved, editing }) {
  const [form, setForm]       = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(editing
        ? { fullName: editing.fullName, email: editing.email, password: '', department: editing.department || '' }
        : EMPTY_FORM
      );
      setShowPass(false);
    }
  }, [open, editing]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.fullName.trim() || !form.email.trim() || !form.department) {
      return toast.error('Full name, email, and department are required');
    }
    if (!editing && !form.password) return toast.error('Password is required');
    if (form.password && form.password.length < 6)
      return toast.error('Password must be at least 6 characters');

    setLoading(true);
    try {
      const payload = {
        fullName:   form.fullName.trim(),
        email:      form.email.trim(),
        department: form.department,
        ...(form.password ? { password: form.password } : {}),
      };
      const res = editing
        ? await api.patch(`/staff/${editing.id}`, payload)
        : await api.post('/staff', payload);
      toast.success(editing ? 'Staff account updated!' : 'Staff account created!');
      onSaved(res.data, !!editing);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save staff account');
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(3px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {editing ? 'Edit Staff Account' : 'Add New Staff Account'}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Role will be set to <strong>Staff</strong> automatically</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Full Name *</label>
            <input type="text" value={form.fullName} onChange={e => set('fullName', e.target.value)}
              placeholder="e.g. Juan dela Cruz" required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all" />
          </div>

          {/* Email / Username */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email / Username *</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
              placeholder="e.g. juan@cantilan.gov.ph" required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all" />
          </div>

          {/* Department */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Department *</label>
            <select value={form.department} onChange={e => set('department', e.target.value)} required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all">
              <option value="">Select department...</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Password {editing ? <span className="font-normal text-gray-400">(leave blank to keep current)</span> : '*'}
            </label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} value={form.password}
                onChange={e => set('password', e.target.value)}
                placeholder={editing ? 'Enter new password to change' : 'Min. 6 characters'}
                required={!editing}
                className="w-full px-4 py-2.5 pr-11 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all [&::-ms-reveal]:hidden [&::-ms-clear]:hidden" />
              <button type="button" onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                {showPass
                  ? <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="2" y1="2" x2="22" y2="22"/><path d="M6.71 6.71A10 10 0 0 0 2.46 12c1.27 4.06 5.06 7 9.54 7a9.97 9.97 0 0 0 5.29-1.52"/><path d="M17.37 17.37A10 10 0 0 0 21.54 12c-1.27-4.06-5.06-7-9.54-7a9.97 9.97 0 0 0-3.71.72"/></svg>
                  : <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
          </div>

          {/* Role badge (read-only display) */}
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-xl">
            <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            </svg>
            <span className="text-xs text-blue-700 font-medium">This account will be assigned <strong>Staff</strong> role — can receive and manage routed citizen concerns.</span>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {loading
                ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>Saving...</>
                : editing ? 'Save Changes' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete Confirm Dialog ─────────────────────────────────────────────────────
function DeleteDialog({ staff, onConfirm, onCancel }) {
  const [loading, setLoading] = useState(false);
  async function handleDelete() {
    setLoading(true);
    await onConfirm();
    setLoading(false);
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(3px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          </div>
        </div>
        <h3 className="text-base font-bold text-gray-900 text-center mb-1">Delete Staff Account</h3>
        <p className="text-sm text-gray-500 text-center mb-5">
          Are you sure you want to delete <strong>{staff?.fullName}</strong>? This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleDelete} disabled={loading}
            className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {loading ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>Deleting...</> : 'Yes, Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Staff() {
  const [staff, setStaff]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [modalOpen, setModalOpen]     = useState(false);
  const [editing, setEditing]         = useState(null);
  const [deleting, setDeleting]       = useState(null);

  useEffect(() => {
    api.get('/staff')
      .then(r => setStaff(r.data))
      .catch(() => toast.error('Failed to load staff accounts'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = search
    ? staff.filter(s =>
        s.fullName.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase()) ||
        (s.department || '').toLowerCase().includes(search.toLowerCase())
      )
    : staff;

  function handleSaved(record, isEdit) {
    if (isEdit) {
      setStaff(prev => prev.map(s => s.id === record.id ? record : s));
    } else {
      setStaff(prev => [record, ...prev]);
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/staff/${deleting.id}`);
      setStaff(prev => prev.filter(s => s.id !== deleting.id));
      toast.success('Staff account deleted');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete account');
    } finally {
      setDeleting(null);
    }
  }

  function openAdd()      { setEditing(null); setModalOpen(true); }
  function openEdit(s)    { setEditing(s);    setModalOpen(true); }
  function closeModal()   { setModalOpen(false); setEditing(null); }

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Personnel Directory</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            Manage staff accounts that can receive and handle routed citizen concerns.
          </p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          Add New Staff Account
        </button>
      </div>

      {/* Stats row */}
      {loading ? <SkeletonStatCards count={4} className="mb-6" /> : (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Staff',   value: staff.length,                                  color: 'text-blue-600 dark:text-blue-400',  bg: 'bg-blue-50 dark:bg-blue-950/30'  },
          { label: 'Departments',   value: new Set(staff.map(s => s.department)).size,     color: 'text-purple-600 dark:text-purple-400',bg: 'bg-purple-50 dark:bg-purple-950/30'},
          { label: 'Active',        value: staff.length,                                  color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/30' },
          { label: 'Role',          value: 'Staff',                                       color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl px-4 py-3`}>
            <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">{label}</p>
            <p className={`text-xl font-bold mt-0.5 ${color}`}>{value}</p>
          </div>
        ))}
      </div>
      )}

      {/* Table card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">

        {/* Search bar */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email, department..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <span className="text-sm text-gray-400 dark:text-slate-500 ml-auto">
            {filtered.length} of {staff.length} accounts
          </span>
        </div>

        {/* Table */}
        {loading ? (
          <div className="overflow-x-auto"><SkeletonTable cols={7} rows={8} /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400 dark:text-slate-500">
            <svg className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            <p className="font-medium text-gray-500 dark:text-slate-400">No staff accounts found</p>
            <p className="text-sm mt-1">
              {search ? 'Try a different search term.' : 'Click "Add New Staff Account" to create one.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-slate-900/40 text-xs text-gray-500 dark:text-slate-400 uppercase">
                <tr>
                  {['#', 'Full Name', 'Email / Username', 'Department', 'Role', 'Date Created', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700">
                {filtered.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors">

                    <td className="px-4 py-3 text-gray-400 dark:text-slate-500 text-xs">{idx + 1}</td>

                    {/* Name + avatar */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {s.fullName.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-gray-800 dark:text-slate-100">{s.fullName}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{s.email}</td>

                    {/* Department badge */}
                    <td className="px-4 py-3">
                      {s.department
                        ? <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">{s.department}</span>
                        : <span className="text-gray-300 dark:text-slate-600 text-xs">—</span>}
                    </td>

                    {/* Role badge */}
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-full text-xs font-semibold">
                        Staff
                      </span>
                    </td>

                    <td className="px-4 py-3 text-gray-400 dark:text-slate-500 text-xs whitespace-nowrap">
                      {new Date(s.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(s)}
                          className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-primary hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition-colors"
                          title="Edit">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                          </svg>
                        </button>
                        <button onClick={() => setDeleting(s)}
                          className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                          title="Delete">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <StaffModal
        open={modalOpen}
        onClose={closeModal}
        onSaved={handleSaved}
        editing={editing}
      />
      {deleting && (
        <DeleteDialog
          staff={deleting}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
