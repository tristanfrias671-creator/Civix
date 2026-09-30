import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Skel, useSkeletonGate } from '../../components/common/Skeleton';
import Icon from '../../components/common/Icons';
import { useAuth } from '../../context/AuthContext';
import { useBranding } from '../../context/BrandingContext';
import api from '../../utils/api';
import formatMinutes from '../../utils/formatMinutes';

const TABS = [
  { id: 'system', label: 'System Profile', icon: 'settings' },
  { id: 'account', label: 'Administrator Account', icon: 'citizens' },
  { id: 'security', label: 'Security', icon: 'shield' },
  { id: 'branding', label: 'Branding', icon: 'camera' },
  { id: 'departments', label: 'Departments', icon: 'submissions' },
  { id: 'about', label: 'About', icon: 'feedback' },
];

const ATTEMPT_OPTIONS = [3, 4, 5, 6, 7, 8, 9, 10];
const LOCK_OPTIONS = [5, 10, 15, 30, 60, 120, 1440];
const IDLE_OPTIONS = [5, 10, 15, 30, 60, 120, 240];

// Keeps a saved value selectable even if it isn't one of the presets.
function withCurrent(options, value) {
  return options.includes(value) ? options : [...options, value].sort((a, b) => a - b);
}

function Toggle({ checked, onChange, labelledBy }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-labelledby={labelledBy}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
        checked ? 'bg-primary' : 'bg-gray-300 dark:bg-slate-600'
      }`}>
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </button>
  );
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const BRANDING = {
  seal: {
    title: 'Official Seal',
    description: 'Shown in page headers, on the login pages and on exported PDF and Excel reports',
    hint: 'JPG or PNG. A PNG with a transparent background looks best; it is placed on a square automatically.',
    noun: 'seal',
  },
  hero: {
    title: 'Homepage Photo',
    description: 'The background photo on the homepage, the admin and staff login pages and the citizen portal header',
    hint: 'JPG or PNG. Use a wide landscape photo at least 1600 px wide; larger photos are resized automatically.',
    noun: 'photo',
  },
};

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This file could not be opened as an image')); };
    img.src = url;
  });
}

function canvasBlob(canvas, type, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}

// Centers the seal on a transparent square (max 800 px) so it is never stretched
// in the square spots it appears in, including the PDF and Excel reports.
function prepareSeal(img) {
  const longest = Math.max(img.naturalWidth, img.naturalHeight);
  const side = Math.min(800, longest);
  const w = Math.round(img.naturalWidth * side / longest);
  const h = Math.round(img.naturalHeight * side / longest);
  const canvas = document.createElement('canvas');
  canvas.width = side;
  canvas.height = side;
  canvas.getContext('2d').drawImage(img, (side - w) / 2, (side - h) / 2, w, h);
  return canvasBlob(canvas, 'image/png');
}

// Large photos are scaled to 2400 px wide and saved as JPEG; others upload as-is.
function prepareHero(img, file) {
  if (img.naturalWidth <= 2400 && file.size <= 4 * 1024 * 1024) return Promise.resolve(file);
  const scale = Math.min(1, 2400 / img.naturalWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvasBlob(canvas, 'image/jpeg', 0.86);
}

function sizeWarning(kind, img) {
  const { naturalWidth: w, naturalHeight: h } = img;
  if (kind === 'seal' && Math.max(w, h) < 200) return `This image is only ${w} × ${h} px, so the seal may look blurry.`;
  if (kind === 'hero' && w < 1200) return `This photo is only ${w} px wide, so it may look blurry on large screens.`;
  if (kind === 'hero' && h > w) return 'This photo is taller than it is wide, so its top and bottom will be cut off on most screens.';
  return null;
}

function SealPreview({ src }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <div className="h-36 rounded-xl flex items-center justify-center gap-3 px-4" style={{ background: 'linear-gradient(180deg, #0b2f66 0%, #081d40 100%)' }}>
          <img src={src} alt="Seal preview on a dark background" className="w-16 h-16 object-contain flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-white font-extrabold text-sm leading-tight">CIVIX</p>
            <p className="text-white/50 text-[11px] font-medium leading-tight">Administrator Portal</p>
          </div>
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1.5">On dark backgrounds</p>
      </div>
      <div>
        <div className="h-36 rounded-xl flex flex-col items-center justify-center border border-gray-100 dark:border-slate-700" style={{ background: '#ffffff' }}>
          <img src={src} alt="Seal preview on a light background" className="w-16 h-16 object-contain mb-2" />
          <p className="text-sm font-extrabold" style={{ color: '#0b2f66' }}>Administrator Login</p>
        </div>
        <p className="text-xs text-gray-400 dark:text-slate-500 mt-1.5">On light backgrounds</p>
      </div>
    </div>
  );
}

function HeroPreview({ src, seal }) {
  return (
    <div>
      <div className="relative aspect-video max-h-80 w-full rounded-xl overflow-hidden bg-slate-200">
        <img src={src} alt="Homepage photo preview" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(6,16,42,0.1) 0%, rgba(70,100,150,0.25) 45%, rgba(160,185,220,0.45) 100%)' }} />
        <div className="absolute inset-x-0 top-0 flex items-center gap-2.5 px-4 h-12" style={{ background: 'linear-gradient(90deg, rgba(11,47,102,0.88), rgba(18,58,122,0.8))' }}>
          <img src={seal} alt="" className="w-7 h-7 object-contain" />
          <div className="min-w-0">
            <p className="text-white/60 text-[9px] font-semibold leading-none">Municipality of Cantilan</p>
            <p className="text-white text-xs font-extrabold leading-tight truncate">Surigao Del Sur - Philippines</p>
          </div>
        </div>
        <p className="absolute left-4 bottom-4 text-white font-extrabold text-xl sm:text-2xl" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.55)' }}>
          Municipality of Cantilan
        </p>
      </div>
      <p className="text-xs text-gray-400 dark:text-slate-500 mt-1.5">Homepage preview</p>
    </div>
  );
}

function BrandingCard({ kind, customUrl, onChange }) {
  const spec = BRANDING[kind];
  const branding = useBranding();
  const inputRef = useRef(null);
  const [pending, setPending] = useState(null); // { blob, preview, warning } — chosen but not saved
  const [busy, setBusy] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => () => { if (pending) URL.revokeObjectURL(pending.preview); }, [pending]);

  async function pickFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      toast.error('Please choose a JPG or PNG image');
      return;
    }
    try {
      const img = await loadImage(file);
      const blob = await (kind === 'seal' ? prepareSeal(img) : prepareHero(img, file));
      if (!blob) throw new Error('This image could not be processed');
      if (blob.size > MAX_UPLOAD_BYTES) throw new Error('This image is larger than 5 MB. Please choose a smaller one.');
      setConfirmReset(false);
      setPending({ blob, preview: URL.createObjectURL(blob), warning: sizeWarning(kind, img) });
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function save() {
    setBusy('save');
    try {
      const fd = new FormData();
      fd.append('image', pending.blob, pending.blob.type === 'image/png' ? `${kind}.png` : `${kind}.jpg`);
      const res = await api.post(`/settings/branding/${kind}`, fd);
      onChange(res.data);
      setPending(null);
      toast.success(kind === 'seal' ? 'Seal updated' : 'Homepage photo updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to upload the image');
    } finally {
      setBusy('');
    }
  }

  async function reset() {
    setBusy('reset');
    try {
      const res = await api.delete(`/settings/branding/${kind}`);
      onChange(res.data);
      setConfirmReset(false);
      toast.success(kind === 'seal' ? 'Default seal restored' : 'Default photo restored');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reset the image');
    } finally {
      setBusy('');
    }
  }

  const src = pending?.preview || branding[kind];
  const secondaryBtn = 'px-5 py-2.5 rounded-lg font-semibold text-sm border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50';
  const primaryBtn = 'inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50';

  let footer;
  if (pending) {
    footer = (
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={save} disabled={!!busy} className={primaryBtn}>
          {busy === 'save' ? 'Uploading...' : `Save ${spec.noun}`}
        </button>
        <button type="button" onClick={() => setPending(null)} disabled={!!busy} className={secondaryBtn}>Cancel</button>
      </div>
    );
  } else if (confirmReset) {
    footer = (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-gray-600 dark:text-slate-300 w-full sm:w-auto sm:mr-auto">
          Remove the uploaded {spec.noun} and go back to the default?
        </p>
        <button type="button" onClick={() => setConfirmReset(false)} disabled={!!busy} className={secondaryBtn}>Keep it</button>
        <button type="button" onClick={reset} disabled={!!busy}
          className="px-5 py-2.5 rounded-lg font-semibold text-sm text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50">
          {busy === 'reset' ? 'Resetting...' : 'Reset to default'}
        </button>
      </div>
    );
  } else {
    footer = (
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => inputRef.current?.click()} className={primaryBtn}>
          <Icon name="camera" className="w-4 h-4" />
          {customUrl ? `Replace ${spec.noun}` : `Upload new ${spec.noun}`}
        </button>
        {customUrl && (
          <button type="button" onClick={() => setConfirmReset(true)} className={secondaryBtn}>Reset to default</button>
        )}
      </div>
    );
  }

  return (
    <SectionCard title={spec.title} description={spec.description} footer={footer}>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={pickFile} />
      {kind === 'seal' ? <SealPreview src={src} /> : <HeroPreview src={src} seal={branding.seal} />}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {pending ? (
          <span className="text-xs font-semibold px-2 py-1 rounded-md bg-amber-50 text-amber-700 dark:text-amber-300">Preview — not saved yet</span>
        ) : (
          <span className={`text-xs font-semibold px-2 py-1 rounded-md ${customUrl ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}`}>
            {customUrl ? `Uploaded ${spec.noun}` : `Default ${spec.noun}`}
          </span>
        )}
      </div>
      {pending?.warning && (
        <p className="mt-3 flex items-start gap-2 rounded-lg px-3.5 py-2.5 text-sm bg-amber-50 text-amber-800 dark:text-amber-200">
          <Icon name="complaint" className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {pending.warning}
        </p>
      )}
      <p className="text-xs text-gray-400 dark:text-slate-500 mt-3">{spec.hint} Up to 5 MB.</p>
    </SectionCard>
  );
}

function SecurityOption({ id, icon, title, description, enabled, onToggle, summary, offSummary, children }) {
  return (
    <div className="py-6 first:pt-0 last:pb-0">
      <div className="flex items-start gap-4">
        <div className={`hidden sm:flex w-10 h-10 rounded-xl items-center justify-center flex-shrink-0 ${
          enabled ? 'bg-blue-50 text-primary dark:text-blue-300' : 'bg-gray-100 text-gray-400'
        }`}>
          <Icon name={icon} className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 id={id} className="font-semibold text-gray-800 dark:text-slate-100">{title}</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{description}</p>
            </div>
            <Toggle checked={enabled} onChange={onToggle} labelledBy={id} />
          </div>
          {enabled && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">{children}</div>}
          <p className={`mt-4 flex items-start gap-2 rounded-lg px-3.5 py-2.5 text-sm ${
            enabled ? 'bg-blue-50 text-blue-800 dark:text-blue-200' : 'bg-gray-50 text-gray-500 dark:bg-slate-900/40'
          }`}>
            <Icon name={enabled ? 'check' : 'unlock'} className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {enabled ? summary : offSummary}
          </p>
        </div>
      </div>
    </div>
  );
}

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
  const [deadlines, setDeadlines] = useState({ COMPLAINT: 7, SUGGESTION: 15, FEEDBACK: 3 });
  const [newDept, setNewDept] = useState('');

  const [profile, setProfile] = useState({ fullName: '', email: '', citizenId: '' });
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [security, setSecurity] = useState({
    lockoutEnabled: true, maxLoginAttempts: 5, lockoutMinutes: 15,
    idleTimeoutEnabled: true, idleTimeoutMinutes: 30,
  });
  const [locked, setLocked] = useState(null);
  const [unlocking, setUnlocking] = useState('');
  const [adminPath, setAdminPath] = useState(null);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [brandingUrls, setBrandingUrls] = useState({ sealUrl: null, heroImageUrl: null });
  const { setBranding } = useBranding();
  const gate = useSkeletonGate();

  useEffect(() => {
    gate(Promise.all([api.get('/settings'), api.get('/auth/me')]))
      .then(([s, me]) => {
        setSystem({
          organizationName: s.data.organizationName,
          tagline: s.data.tagline,
          contactEmail: s.data.contactEmail,
          contactPhone: s.data.contactPhone,
          officeAddress: s.data.officeAddress,
        });
        setDepartments(s.data.departments);
        if (s.data.deadlines) setDeadlines(s.data.deadlines);
        if (s.data.security) setSecurity(s.data.security);
        setBrandingUrls({ sealUrl: s.data.sealUrl, heroImageUrl: s.data.heroImageUrl });
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
  }, [gate]);

  async function saveDeadlines(e) {
    e.preventDefault();
    setSaving('deadlines');
    try {
      const res = await api.patch('/settings/deadlines', deadlines);
      setDeadlines(res.data.deadlines);
      toast.success('Deadlines saved. They apply to new reports.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save deadlines');
    } finally {
      setSaving('');
    }
  }

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

  useEffect(() => {
    if (tab !== 'security') return;
    api.get('/settings/security/locked')
      .then(res => setLocked(res.data.accounts))
      .catch(() => setLocked([]));
    api.get('/settings/admin-link')
      .then(res => setAdminPath(res.data.path))
      .catch(() => setAdminPath(''));
  }, [tab]);

  const adminLinkUrl = adminPath ? `${window.location.origin}/${adminPath}` : '';

  async function copyAdminLink() {
    try {
      await navigator.clipboard.writeText(adminLinkUrl);
      toast.success('Admin sign-in link copied');
    } catch {
      toast.error('Copy failed. Select the link and copy it manually.');
    }
  }

  async function rotateAdminLink() {
    setSaving('admin-link');
    try {
      const res = await api.post('/settings/admin-link/rotate');
      setAdminPath(res.data.path);
      setConfirmRotate(false);
      toast.success('New admin link created. Bookmark it now.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change the admin link');
    } finally {
      setSaving('');
    }
  }

  async function saveSecurity(e) {
    e.preventDefault();
    setSaving('security');
    try {
      const res = await api.patch('/settings/security', security);
      setSecurity(res.data.security);
      const { idleTimeoutEnabled, idleTimeoutMinutes } = res.data.security;
      window.dispatchEvent(new CustomEvent('civix:session-policy', { detail: idleTimeoutEnabled ? idleTimeoutMinutes : 0 }));
      toast.success('Security settings saved');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save security settings');
    } finally {
      setSaving('');
    }
  }

  async function unlock(account) {
    setUnlocking(account.id);
    try {
      await api.post(`/settings/security/unlock/${account.id}`);
      setLocked(p => p.filter(a => a.id !== account.id));
      toast.success(`${account.fullName} can sign in again`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to unlock account');
    } finally {
      setUnlocking('');
    }
  }

  // Keeps this page and every seal/photo in the app in sync after an upload or reset.
  function updateBranding(data) {
    setBrandingUrls(data);
    setBranding(data);
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
        <div className="space-y-6">
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

          <form onSubmit={saveDeadlines}>
            <SectionCard
              title="Resolution Deadlines"
              description="How many working days (Monday–Friday) the assigned office has to resolve each type of report"
              footer={
                <button type="submit" disabled={saving === 'deadlines'}
                  className="px-6 py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50">
                  {saving === 'deadlines' ? 'Saving...' : 'Save Deadlines'}
                </button>
              }
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {[['COMPLAINT', 'Complaints'], ['SUGGESTION', 'Suggestions'], ['FEEDBACK', 'Feedback']].map(([key, label]) => (
                  <Field key={key} label={label} hint="Working days, 1–60">
                    <div className="relative">
                      <input type="number" min={1} max={60} step={1} required className={`${inputClass} pr-24`}
                        value={deadlines[key]}
                        onChange={e => setDeadlines(p => ({ ...p, [key]: e.target.value === '' ? '' : Number(e.target.value) }))} />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">working days</span>
                    </div>
                  </Field>
                ))}
              </div>
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-4">
                The deadline is set when a citizen submits a report and shown to them, to staff and on the dashboards.
                Changes apply to new reports; existing reports keep the deadline they were given.
              </p>
            </SectionCard>
          </form>
        </div>
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

      {tab === 'security' && (
        <div className="space-y-6">
          <SectionCard
            title="Private Admin Sign-in Link"
            description="The admin sign-in page only opens at this address. It isn't linked anywhere on the public site, so bookmark it and share it only with administrators."
            footer={confirmRotate ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-gray-600 dark:text-slate-300 w-full sm:w-auto sm:mr-auto">
                  The current link stops working right away, for every administrator. Continue?
                </p>
                <button type="button" onClick={() => setConfirmRotate(false)} disabled={saving === 'admin-link'}
                  className="px-5 py-2.5 rounded-lg font-semibold text-sm border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                  Cancel
                </button>
                <button type="button" onClick={rotateAdminLink} disabled={saving === 'admin-link'}
                  className="px-5 py-2.5 rounded-lg font-semibold text-sm text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50">
                  {saving === 'admin-link' ? 'Changing...' : 'Generate new link'}
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={copyAdminLink} disabled={!adminLinkUrl}
                  className="px-6 py-2.5 bg-primary text-white rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50">
                  Copy link
                </button>
                <button type="button" onClick={() => setConfirmRotate(true)} disabled={!adminLinkUrl}
                  className="px-5 py-2.5 rounded-lg font-semibold text-sm border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50">
                  Generate new link
                </button>
              </div>
            )}
          >
            {adminPath === null ? (
              <Skel className="h-11 w-full" />
            ) : (
              <input readOnly value={adminLinkUrl} onFocus={e => e.target.select()} aria-label="Private admin sign-in link"
                className={`${inputClass} font-mono bg-gray-50 dark:bg-slate-900/60`} />
            )}
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">
              Typing any other address, like /admin-login, just opens the homepage. If the link is ever shared by mistake, generate a new one.
            </p>
          </SectionCard>

          <form onSubmit={saveSecurity}>
            <SectionCard
              title="Sign-in Protection"
              description="Protects administrator and staff accounts from password guessing and unattended sessions"
              footer={
                <button type="submit" disabled={saving === 'security'}
                  className="px-6 py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50">
                  {saving === 'security' ? 'Saving...' : 'Save Security Settings'}
                </button>
              }
            >
              <div className="divide-y divide-gray-100 dark:divide-slate-700">
                <SecurityOption
                  id="sec-lockout"
                  icon="lock"
                  title="Account lockout"
                  description="Temporarily lock an account after too many wrong passwords in a row."
                  enabled={security.lockoutEnabled}
                  onToggle={v => setSecurity(p => ({ ...p, lockoutEnabled: v }))}
                  summary={`After ${security.maxLoginAttempts} wrong passwords in a row, the account can't sign in for ${formatMinutes(security.lockoutMinutes)}. You can unlock it sooner below.`}
                  offSummary="Off. Wrong passwords never lock an account."
                >
                  <Field label="Wrong passwords allowed" hint="In a row, before the account is locked">
                    <select className={inputClass} value={security.maxLoginAttempts}
                      onChange={e => setSecurity(p => ({ ...p, maxLoginAttempts: Number(e.target.value) }))}>
                      {withCurrent(ATTEMPT_OPTIONS, security.maxLoginAttempts).map(n => <option key={n} value={n}>{n} attempts</option>)}
                    </select>
                  </Field>
                  <Field label="Lock duration" hint="How long the account stays locked">
                    <select className={inputClass} value={security.lockoutMinutes}
                      onChange={e => setSecurity(p => ({ ...p, lockoutMinutes: Number(e.target.value) }))}>
                      {withCurrent(LOCK_OPTIONS, security.lockoutMinutes).map(n => <option key={n} value={n}>{formatMinutes(n)}</option>)}
                    </select>
                  </Field>
                </SecurityOption>

                <SecurityOption
                  id="sec-idle"
                  icon="clock"
                  title="Automatic sign-out"
                  description="Sign out administrators and staff who leave the system open without using it."
                  enabled={security.idleTimeoutEnabled}
                  onToggle={v => setSecurity(p => ({ ...p, idleTimeoutEnabled: v }))}
                  summary={`After ${formatMinutes(security.idleTimeoutMinutes)} with no activity, the user is signed out. A warning with a countdown appears 1 minute before.`}
                  offSummary="Off. Users stay signed in until they sign out themselves."
                >
                  <Field label="Sign out after" hint="Of no mouse, keyboard or touch activity">
                    <select className={inputClass} value={security.idleTimeoutMinutes}
                      onChange={e => setSecurity(p => ({ ...p, idleTimeoutMinutes: Number(e.target.value) }))}>
                      {withCurrent(IDLE_OPTIONS, security.idleTimeoutMinutes).map(n => <option key={n} value={n}>{formatMinutes(n)}</option>)}
                    </select>
                  </Field>
                </SecurityOption>
              </div>
            </SectionCard>
          </form>

          <SectionCard title="Locked Accounts" description="Accounts that can't sign in right now because of too many wrong passwords">
            {locked === null ? (
              <div className="space-y-2">
                <Skel className="h-14 w-full" />
                <Skel className="h-14 w-full" />
              </div>
            ) : locked.length === 0 ? (
              <div className="flex flex-col items-center text-center py-6">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-green-50 text-green-600 mb-3">
                  <Icon name="shield" className="w-6 h-6" />
                </div>
                <p className="text-sm font-medium text-gray-700 dark:text-slate-300">No locked accounts</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Every account can sign in right now.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {locked.map(a => (
                  <li key={a.id} className="flex flex-wrap sm:flex-nowrap items-center gap-3 px-4 py-3 rounded-lg border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-red-50 text-red-600">
                      <Icon name="lock" className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-800 dark:text-slate-100 truncate">
                        {a.fullName}
                        <span className={`ml-2 align-middle text-[11px] font-semibold px-1.5 py-0.5 rounded ${a.role === 'ADMIN' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>
                          {a.role === 'ADMIN' ? 'Admin' : a.role === 'STAFF' ? 'Staff' : 'Citizen'}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                        {a.email}{a.department ? ` · ${a.department}` : ''} · Locked until {new Date(a.lockedUntil).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                    <button type="button" onClick={() => unlock(a)} disabled={unlocking === a.id}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-200 hover:border-primary hover:text-primary transition-colors disabled:opacity-50">
                      <Icon name="unlock" className="w-4 h-4" />
                      {unlocking === a.id ? 'Unlocking...' : 'Unlock'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      )}

      {tab === 'branding' && (
        <div className="space-y-6">
          <BrandingCard kind="seal" customUrl={brandingUrls.sealUrl} onChange={updateBranding} />
          <BrandingCard kind="hero" customUrl={brandingUrls.heroImageUrl} onChange={updateBranding} />
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
              ['Animated emoji', 'Google Noto Emoji (CC BY 4.0)'],
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

