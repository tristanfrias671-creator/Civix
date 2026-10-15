import React, { useState, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { OutcomeBadge, NewDeviceTag, FAILED, METHOD, whenText } from './SignInHistory';
import { mediaUrl } from '../../utils/mediaUrl';
import Avatar from './Avatar';

// ── Canvas circular crop ──────────────────────────────────────────────────────
function CropStep({ imgSrc, onDone, onBack }) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom,   setZoom]   = useState(1);
  const dragging  = useRef(false);
  const lastPos   = useRef({ x: 0, y: 0 });
  const imgRef    = useRef(null);
  const SIZE      = 300;   // preview box px
  const RADIUS    = 130;   // crop circle radius

  // ── Drag handlers ──
  function startDrag(cx, cy) { dragging.current = true; lastPos.current = { x: cx, y: cy }; }
  function moveDrag(cx, cy) {
    if (!dragging.current) return;
    setOffset(p => ({ x: p.x + cx - lastPos.current.x, y: p.y + cy - lastPos.current.y }));
    lastPos.current = { x: cx, y: cy };
  }
  function endDrag() { dragging.current = false; }

  // ── Extract crop to blob using canvas ──
  function applyCrop() {
    const img = imgRef.current;
    if (!img) return;
    const OUT  = 256;
    const cvs  = document.createElement('canvas');
    cvs.width  = OUT; cvs.height = OUT;
    const ctx  = cvs.getContext('2d');

    // Circular clip
    ctx.beginPath();
    ctx.arc(OUT / 2, OUT / 2, OUT / 2, 0, Math.PI * 2);
    ctx.clip();

    // Natural image dimensions → fit inside SIZE square
    const fit   = SIZE / Math.max(img.naturalWidth, img.naturalHeight);
    const imgW  = img.naturalWidth  * fit * zoom;
    const imgH  = img.naturalHeight * fit * zoom;
    const imgX  = SIZE / 2 + offset.x - imgW / 2;
    const imgY  = SIZE / 2 + offset.y - imgH / 2;

    // Crop circle top-left
    const cropX = SIZE / 2 - RADIUS;
    const cropY = SIZE / 2 - RADIUS;
    const cropD = RADIUS * 2;
    const ratio = OUT / cropD;

    ctx.drawImage(img, (imgX - cropX) * ratio, (imgY - cropY) * ratio, imgW * ratio, imgH * ratio);

    cvs.toBlob(blob => onDone(blob, cvs.toDataURL('image/jpeg', 0.92)), 'image/jpeg', 0.92);
  }

  return (
    <div className="flex flex-col items-center">
      <p className="text-xs text-gray-500 mb-3 text-center">
        Drag the image to reposition · Use the slider to zoom
      </p>

      {/* Preview box */}
      <div className="relative rounded-full overflow-hidden select-none cursor-grab active:cursor-grabbing"
        style={{ width: SIZE, height: SIZE, background: '#1e293b', touchAction: 'none' }}
        onMouseDown={e  => startDrag(e.clientX, e.clientY)}
        onMouseMove={e  => moveDrag(e.clientX, e.clientY)}
        onMouseUp={endDrag} onMouseLeave={endDrag}
        onTouchStart={e => startDrag(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={e  => moveDrag(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={endDrag}>

        {/* Image */}
        <img ref={imgRef} src={imgSrc} alt="crop preview" draggable={false}
          style={{
            position: 'absolute', left: '50%', top: '50%', pointerEvents: 'none',
            transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${zoom})`,
            width: SIZE, maxWidth: 'none', userSelect: 'none',
          }} />

        {/* Dark overlay with circle cutout */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `radial-gradient(circle ${RADIUS}px at 50% 50%, transparent ${RADIUS}px, rgba(0,0,0,0.6) ${RADIUS}px)`,
        }} />

        {/* Crop circle border */}
        <div style={{
          position: 'absolute', pointerEvents: 'none', borderRadius: '50%',
          left: SIZE / 2 - RADIUS, top: SIZE / 2 - RADIUS,
          width: RADIUS * 2, height: RADIUS * 2,
          border: '2px solid rgba(255,255,255,0.75)',
          boxShadow: '0 0 0 9999px transparent',
        }} />
      </div>

      {/* Zoom slider */}
      <div className="flex items-center gap-3 w-full mt-4">
        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
        <input type="range" min="0.5" max="3" step="0.02" value={zoom}
          onChange={e => setZoom(parseFloat(e.target.value))}
          className="flex-1 accent-blue-600 h-1.5 rounded-full" />
        <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
      </div>

      <div className="flex gap-3 mt-5 w-full">
        <button type="button" onClick={onBack}
          className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
          Back
        </button>
        <button type="button" onClick={applyCrop}
          className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
          Apply Crop
        </button>
      </div>
    </div>
  );
}

const PASSWORD_INPUT = 'w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-gray-50 focus:bg-white transition-all';

function PasswordField({ label, value, onChange, show, autoComplete, autoFocus }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
      <input type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)}
        autoComplete={autoComplete} autoFocus={autoFocus} className={PASSWORD_INPUT} />
    </div>
  );
}

// ── Change password: its own window, opened from Edit Profile ──
function ChangePasswordModal({ open, onClose }) {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  // Start empty each time it opens.
  React.useEffect(() => {
    if (open) {
      setForm({ current: '', next: '', confirm: '' });
      setShow(false);
    }
  }, [open]);

  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const set = key => value => setForm(p => ({ ...p, [key]: value }));
  const tooShort = form.next.length > 0 && form.next.length < 6;
  const mismatch = form.confirm.length > 0 && form.confirm !== form.next;
  const matches = form.confirm.length > 0 && form.confirm === form.next && !tooShort;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.current || !form.next) return toast.error('Please enter your current and new password');
    if (form.next.length < 6) return toast.error('New password must be at least 6 characters');
    if (form.next !== form.confirm) return toast.error('New passwords do not match');
    if (form.next === form.current) return toast.error('Choose a new password that is different from your current one');
    setSaving(true);
    try {
      await api.patch('/auth/password', { currentPassword: form.current, newPassword: form.next });
      toast.success('Password changed successfully');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(15,23,42,0.55)' }}
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full my-auto" style={{ maxWidth: 400 }}
        role="dialog" aria-modal="true" aria-labelledby="change-password-title"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-blue-50 text-primary flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
              </svg>
            </span>
            <div>
              <h2 id="change-password-title" className="text-base font-bold text-gray-900">Change Password</h2>
              <p className="text-xs text-gray-500">Use at least 6 characters.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <PasswordField label="Current Password" value={form.current} onChange={set('current')}
            show={show} autoComplete="current-password" autoFocus />
          <div>
            <PasswordField label="New Password" value={form.next} onChange={set('next')}
              show={show} autoComplete="new-password" />
            {tooShort && <p className="text-xs text-red-600 mt-1.5">Use at least 6 characters.</p>}
          </div>
          <div>
            <PasswordField label="Confirm New Password" value={form.confirm} onChange={set('confirm')}
              show={show} autoComplete="new-password" />
            {mismatch && <p className="text-xs text-red-600 mt-1.5">The passwords don't match.</p>}
            {matches && <p className="text-xs text-green-600 mt-1.5">✓ The passwords match.</p>}
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} className="w-4 h-4 rounded accent-blue-600" />
            Show passwords
          </label>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50">
              {saving ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Sign-in activity: the person's own latest sign-ins and password changes, so
//    they can spot one that wasn't them ──
function SignInActivityModal({ open, onClose, rows }) {
  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(15,23,42,0.55)' }}
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full my-auto" style={{ maxWidth: 440 }}
        role="dialog" aria-modal="true" aria-labelledby="sign-in-activity-title"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-blue-50 text-primary flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="9" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
              </svg>
            </span>
            <div>
              <h2 id="sign-in-activity-title" className="text-base font-bold text-gray-900">Sign-in activity</h2>
              <p className="text-xs text-gray-600">Your latest sign-ins and password changes.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="px-6 py-4">
          {rows === null ? (
            <p className="py-4 text-sm text-gray-600">Loading...</p>
          ) : rows.length === 0 ? (
            <p className="py-4 text-sm text-gray-600">No sign-ins recorded yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {rows.map(r => (
                <li key={r.id} className="py-3">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <OutcomeBadge outcome={r.outcome} />
                    {r.newDevice && <NewDeviceTag />}
                  </span>
                  <p className="text-sm font-medium text-gray-800 mt-1">{whenText(r.createdAt)}</p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {[r.device, r.network && `IP ${r.network}`, METHOD[r.method]].filter(Boolean).join(' · ')}
                  </p>
                  {r.detail && <p className="text-xs text-gray-600 mt-0.5">{r.detail}</p>}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 mb-1 text-xs text-gray-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            See something that wasn't you? Change your password now, then tell the administrator.
          </p>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// `links`: extra rows under Change Password, each { label, description, icon, onClick }.
export default function ProfileModal({ open, onClose, links = [] }) {
  const { user, updateUser } = useAuth();

  const [step,       setStep]       = useState('info');   // 'info' | 'crop'
  const [rawImgSrc,  setRawImgSrc]  = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [cropBlob,   setCropBlob]   = useState(null);

  const [fullName,   setFullName]   = useState(user?.fullName || '');
  const [saving, setSaving] = useState(false);

  const [passwordOpen, setPasswordOpen] = useState(false);
  const closePassword = useCallback(() => setPasswordOpen(false), []);
  const [activity, setActivity] = useState(null); // latest sign-in history rows
  const [activityOpen, setActivityOpen] = useState(false);
  const closeActivity = useCallback(() => setActivityOpen(false), []);

  const fileRef = useRef(null);

  // Reset when opened
  React.useEffect(() => {
    if (open) {
      setStep('info');
      setRawImgSrc(null);
      setPreviewUrl(null);
      setCropBlob(null);
      setFullName(user?.fullName || '');
      setPasswordOpen(false);
      setActivityOpen(false);
    }
  }, [open, user]);

  // The sign-in history is read each time the window opens.
  React.useEffect(() => {
    if (!open) return undefined;
    let outdated = false;
    setActivity(null);
    api.get('/auth/my-sign-ins')
      .then(r => { if (!outdated) setActivity(r.data); })
      .catch(() => { if (!outdated) setActivity([]); });
    return () => { outdated = true; };
  }, [open]);

  if (!open) return null;

  // ── File picked → go to crop ──
  function handleFilePick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be under 5 MB'); return; }
    const reader = new FileReader();
    reader.onload = ev => { setRawImgSrc(ev.target.result); setStep('crop'); };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  // ── Crop done → back to info with preview ──
  function handleCropDone(blob, dataUrl) {
    setCropBlob(blob);
    setPreviewUrl(dataUrl);
    setStep('info');
  }

  // ── Save everything: photo + name in one click ──
  async function handleSave(e) {
    e.preventDefault();
    if (!fullName.trim()) return toast.error('Name cannot be empty');
    setSaving(true);
    try {
      // 1. Upload avatar first if a new photo was cropped
      if (cropBlob) {
        const fd = new FormData();
        fd.append('avatar', cropBlob, 'avatar.jpg');
        const avatarRes = await api.post('/auth/avatar', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        // Update user with new avatar immediately so sidebar reflects it
        updateUser({ ...user, avatar: avatarRes.data.avatar }, null);
      }

      // 2. Save name (always)
      const profileRes = await api.patch('/auth/profile', {
        fullName: fullName.trim(),
        email: user.email,
      });
      updateUser(profileRes.data.user, profileRes.data.token);

      toast.success('Profile updated successfully!');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save profile');
    } finally { setSaving(false); }
  }

  const currentAvatar = previewUrl || (user?.avatar ? mediaUrl(user.avatar) : null);

  return (
    <>
    {/* Never taller than the screen: the header stays put and the rest scrolls. */}
    <div className="fixed inset-0 z-50 flex justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full my-auto flex flex-col overflow-hidden"
        style={{ maxWidth: step === 'crop' ? 360 : 420, maxHeight: 'calc(100vh - 2rem)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-bold text-gray-900">
            {step === 'crop' ? 'Crop Profile Photo' : 'Edit Profile'}
          </h2>
          <button onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="px-6 py-6 overflow-y-auto">

          {/* ── CROP STEP ── */}
          {step === 'crop' && rawImgSrc && (
            <CropStep
              imgSrc={rawImgSrc}
              onDone={handleCropDone}
              onBack={() => setStep('info')}
            />
          )}

          {/* ── INFO STEP ── */}
          {step === 'info' && (
            <div className="space-y-5">

              {/* Avatar */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <Avatar user={user} src={currentAvatar} className="w-24 h-24 border-4 border-white shadow-lg" letterClassName="text-3xl font-bold" />
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center shadow-md hover:bg-blue-700 transition-colors border-2 border-white">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                      <circle cx="12" cy="13" r="3"/>
                    </svg>
                  </button>
                </div>

                {/* New photo ready badge */}
                {cropBlob && (
                  <span className="flex items-center gap-1.5 px-3 py-1 bg-green-50 border border-green-200 text-green-700 text-xs font-semibold rounded-full">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                    New photo ready — click Save Changes
                  </span>
                )}

                <button type="button" onClick={() => fileRef.current?.click()}
                  className="text-xs text-primary font-medium hover:underline">
                  Change profile photo
                </button>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/jpg"
                  className="hidden" onChange={handleFilePick} />
              </div>

              {/* User info (read-only) */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Email</span>
                  <span className="font-medium text-gray-700">{user?.email}</span>
                </div>
                {user?.department && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Department</span>
                    <span className="font-medium text-gray-700 text-right max-w-48 truncate">{user.department}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Role</span>
                  <span className="font-medium text-gray-700 capitalize">{user?.role?.toLowerCase()}</span>
                </div>
              </div>

              {/* Change password: opens its own window */}
              <button type="button" onClick={() => setPasswordOpen(true)}
                className="w-full flex items-center justify-between px-4 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                  Change Password
                </span>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                </svg>
              </button>

              {(() => {
                const failed = (activity || []).filter(r => FAILED.includes(r.outcome)).length;
                const last = (activity || []).find(r => r.outcome === 'SIGNED_IN');
                const summary = activity === null ? 'Loading...'
                  : failed ? `${failed} failed sign-in attempt${failed === 1 ? '' : 's'} recently. Please check.`
                  : last ? `Last sign-in: ${whenText(last.createdAt)}${last.device ? ` · ${last.device}` : ''}`
                  : 'See when and where your account was used.';
                return (
                  <button type="button" onClick={() => setActivityOpen(true)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors text-left">
                    <span className="flex items-center gap-2 min-w-0">
                      <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden="true">
                        <circle cx="12" cy="12" r="9" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
                      </svg>
                      <span className="min-w-0">
                        <span className="block">Sign-in activity</span>
                        <span className={`block text-xs font-normal mt-0.5 ${failed ? 'text-amber-800 dark:text-amber-200 font-semibold' : 'text-gray-600'}`}>{summary}</span>
                      </span>
                    </span>
                    <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                    </svg>
                  </button>
                );
              })()}

              {links.map(link => (
                <button key={link.label} type="button" onClick={link.onClick}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors text-left">
                  <span className="flex items-center gap-2 min-w-0">
                    {link.icon}
                    <span className="min-w-0">
                      <span className="block">{link.label}</span>
                      {link.description && <span className="block text-xs font-normal text-gray-500 mt-0.5">{link.description}</span>}
                    </span>
                  </span>
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                  </svg>
                </button>
              ))}

              {/* Name field */}
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Full Name</label>
                  <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-gray-50 focus:bg-white transition-all" />
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={onClose}
                    className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving}
                    className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    {saving
                      ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>Saving...</>
                      : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
    <ChangePasswordModal open={passwordOpen} onClose={closePassword} />
    <SignInActivityModal open={activityOpen} onClose={closeActivity} rows={activity} />
    </>
  );
}
