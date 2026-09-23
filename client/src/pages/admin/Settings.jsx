import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Skel } from '../../components/common/Skeleton';
import Icon from '../../components/common/Icons';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

const TABS = [
  { id: 'system', label: 'System Profile', icon: 'settings' },
  { id: 'account', label: 'Administrator Account', icon: 'citizens' },
  { id: 'departments', label: 'Departments', icon: 'submissions' },
  { id: 'about', label: 'About', icon: 'feedback' },
];

function SectionCard({ title, description, children, footer }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
        <h2 className="font-semibold text-gray-800 dark:text-slate-100">{title}</h2>
        {description && <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{description}</p>}
      </div>
      <div className="p-6">{children}</div>
      {footer && <div className="px-6 py-4 bg-gray-50 dark:bg-slate-900/40 border-t border-gray-100 dark:border-slate-700">{footer}</div>}
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

const inputClass = 'w-full px-4 py-2.5 border border-gray-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary';

export default function Settings() {
  const { user, updateUser } = useAuth();
  const [tab, setTab] = useState('system');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');

  const [system, setSystem] = useState({
    organizationName: '',
    tagline: '',
    contactEmail: '',
    contactPhone: '',
    officeAddress: '',
  });
  const [departments, setDepartments] = useState([]);
  const [newDept, setNewDept] = useState('');

  const [profile, setProfile] = useState({ fullName: '', email: '', citizenId: '' });
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });

  useEffect(() => {
    Promise.all([api.get('/settings'), api.get('/auth/me')])
      .then(([s, me]) => {
        setSystem({
          organizationName: s.data.organizationName,
          tagline: s.data.tagline,
          contactEmail: s.data.contactEmail,
          contactPhone: s.data.contactPhone,
          officeAddress: s.data.officeAddress,
        });
        setDepartments(s.data.departments);
        setProfile({
          fullName: me.data.fullName,
          email: me.data.email,
          citizenId: me.data.citizenId,
        });
        setLoading(false);
      })
      .catch(() => {
        toast.error('Failed to load settings');
        setLoading(false);
      });
  }, []);

  async function saveSystem(e) {
    e.preventDefault();
    setSaving('system');
    try {
      const res = await api.patch('/settings/system', system);
      setSystem({
        organizationName: res.data.organizationName,
        tagline: res.data.tagline,
        contactEmail: res.data.contactEmail,
        contactPhone: res.data.contactPhone,
        officeAddress: res.data.officeAddress,
      });
      toast.success('System profile updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save system profile');
    } finally {
      setSaving('');
    }
  }

  async function saveProfile(e) {
    e.preventDefault();
    setSaving('profile');
    try {
      const res = await api.patch('/auth/profile', {
        fullName: profile.fullName,
        email: profile.email,
      });
      updateUser(res.data.user, res.data.token);
      toast.success('Administrator profile updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving('');
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    if (passwords.next !== passwords.confirm) {
      return toast.error('New passwords do not match');
    }
    setSaving('password');
    try {
      await api.patch('/auth/password', {
        currentPassword: passwords.current,
        newPassword: passwords.next,
      });
      setPasswords({ current: '', next: '', confirm: '' });
      toast.success('Password changed successfully');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally {
      setSaving('');
    }
  }

  async function saveLists(type) {
    setSaving(type);
    try {
      const payload = { departments };
      const res = await api.patch('/settings/lists', payload);
      setDepartments(res.data.departments);
      toast.success('Departments saved');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving('');
    }
  }

  function addDept() {
    const name = newDept.trim();
    if (!name) return;
    if (departments.includes(name)) return toast.error('Department already exists');
    setDepartments(p => [...p, name]);
    setNewDept('');
  }

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-6"><Skel className="h-6 w-32 mb-2" /><Skel className="h-3 w-96" /></div>
        <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 pb-1">
          {TABS.map(t => <Skel key={t.id} className="h-9 w-28" />)}
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-6">
          <Skel className="h-5 w-64 mb-1" />
          <Skel className="h-3 w-80 mb-6" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i}>
                <Skel className="h-3 w-24 mb-2" />
                <Skel className="h-10 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Manage system profile, your administrator account, and portal configuration</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 dark:border-slate-700 pb-1">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'border-primary text-primary bg-blue-50/50 dark:bg-blue-950/30'
                : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-100 hover:bg-gray-50 dark:hover:bg-slate-800'
            }`}
          >
            <Icon name={t.icon} className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'system' && (
        <form onSubmit={saveSystem}>
          <SectionCard
            title="Change System Profile"
            description="Public-facing organization details shown across the CIVIX portal"
            footer={
              <button type="submit" disabled={saving === 'system'}
                className="px-6 py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50">
                {saving === 'system' ? 'Saving...' : 'Save System Profile'}
              </button>
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Organization Name *" hint="Displayed on login and portal headers">
                <input className={inputClass} value={system.organizationName}
                  onChange={e => setSystem(p => ({ ...p, organizationName: e.target.value }))} required />
              </Field>
              <Field label="Tagline" hint="Short description under the organization name">
                <input className={inputClass} value={system.tagline}
                  onChange={e => setSystem(p => ({ ...p, tagline: e.target.value }))} />
              </Field>
              <Field label="Contact Email">
                <input type="email" className={inputClass} value={system.contactEmail}
                  onChange={e => setSystem(p => ({ ...p, contactEmail: e.target.value }))} />
              </Field>
              <Field label="Contact Phone">
                <input className={inputClass} value={system.contactPhone}
                  onChange={e => setSystem(p => ({ ...p, contactPhone: e.target.value }))} placeholder="+63 ..." />
              </Field>
              <div className="md:col-span-2">
                <Field label="Office Address">
                  <textarea className={`${inputClass} resize-none`} rows={3} value={system.officeAddress}
                    onChange={e => setSystem(p => ({ ...p, officeAddress: e.target.value }))}
                    placeholder="City hall or main office address" />
                </Field>
              </div>
            </div>
          </SectionCard>
        </form>
      )}

      {tab === 'account' && (
        <div className="space-y-6">
          <form onSubmit={saveProfile}>
            <SectionCard
              title="Administrator Profile"
              description={`Signed in as ${user?.role === 'ADMIN' ? 'System Administrator' : user?.role}`}
              footer={
                <button type="submit" disabled={saving === 'profile'}
                  className="px-6 py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50">
                  {saving === 'profile' ? 'Saving...' : 'Save Profile'}
                </button>
              }
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field label="Full Name">
                  <input className={inputClass} value={profile.fullName}
                    onChange={e => setProfile(p => ({ ...p, fullName: e.target.value }))} required />
                </Field>
                <Field label="Email Address">
                  <input type="email" className={inputClass} value={profile.email}
                    onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} required />
                </Field>
                <Field label="Administrator ID" hint="Cannot be changed">
                  <input className={`${inputClass} bg-gray-50 dark:bg-slate-900/60 text-gray-500 dark:text-slate-400`} value={profile.citizenId} readOnly />
                </Field>
              </div>
            </SectionCard>
          </form>

          <form onSubmit={savePassword}>
            <SectionCard
              title="Change Password"
              description="Use a strong password with at least 6 characters"
              footer={
                <button type="submit" disabled={saving === 'password'}
                  className="px-6 py-2.5 bg-slate-800 text-white rounded-lg font-semibold hover:bg-slate-900 transition-colors disabled:opacity-50">
                  {saving === 'password' ? 'Updating...' : 'Update Password'}
                </button>
              }
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-3xl">
                <Field label="Current Password">
                  <input type="password" className={inputClass} value={passwords.current}
                    onChange={e => setPasswords(p => ({ ...p, current: e.target.value }))} required />
                </Field>
                <Field label="New Password">
                  <input type="password" className={inputClass} value={passwords.next}
                    onChange={e => setPasswords(p => ({ ...p, next: e.target.value }))} required minLength={6} />
                </Field>
                <Field label="Confirm New Password">
                  <input type="password" className={inputClass} value={passwords.confirm}
                    onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))} required />
                </Field>
              </div>
            </SectionCard>
          </form>
        </div>
      )}

      {tab === 'departments' && (
        <SectionCard
          title="Departments"
          description="Departments used when routing and assigning submissions"
          footer={
            <button type="button" onClick={() => saveLists('departments')} disabled={saving === 'departments'}
              className="px-6 py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50">
              {saving === 'departments' ? 'Saving...' : 'Save Departments'}
            </button>
          }
        >
          <ListEditor items={departments} setItems={setDepartments} newVal={newDept} setNew={setNewDept} onAdd={addDept} placeholder="New department name..." />
        </SectionCard>
      )}

      {tab === 'about' && (
        <SectionCard title="System Information" description="Technical details about this CIVIX installation">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              ['Application', 'CIVIX v1.0.0'],
              ['Organization', system.organizationName || 'CIVIX'],
              ['Framework', 'React 18 + Express'],
              ['Database', 'MySQL + Prisma'],
              ['Authentication', 'JWT Bearer Token'],
              ['Maps', 'Leaflet + OpenStreetMap'],
              ['Charts', 'Recharts'],
              ['Signed in as', profile.email],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between items-center px-4 py-3 bg-gray-50 dark:bg-slate-900/40 rounded-lg text-sm">
                <span className="text-gray-500 dark:text-slate-400">{k}</span>
                <span className="font-medium text-gray-800 dark:text-slate-100 text-right ml-4 truncate">{v}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function ListEditor({ items, setItems, newVal, setNew, onAdd, placeholder }) {
  return (
    <>
      <div className="flex gap-2 mb-4">
        <input value={newVal} onChange={e => setNew(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), onAdd())}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 border border-gray-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        <button type="button" onClick={onAdd}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          Add
        </button>
      </div>
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {items.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-slate-500 text-center py-8">No items configured</p>
        ) : items.map(item => (
          <div key={item} className="flex justify-between items-center px-4 py-2.5 bg-gray-50 dark:bg-slate-900/40 rounded-lg border border-gray-100 dark:border-slate-700">
            <span className="text-sm text-gray-700 dark:text-slate-300 font-medium">{item}</span>
            <button type="button" onClick={() => setItems(p => p.filter(x => x !== item))}
              className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30">
              Remove
            </button>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 dark:text-slate-500 mt-3">{items.length} item{items.length !== 1 ? 's' : ''} — click Save to persist changes</p>
    </>
  );
}

