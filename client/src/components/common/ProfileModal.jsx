import React, { useState, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { mediaUrl } from '../../utils/mediaUrl';

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

// ════════════════════════════════════════════════════════════════════════════
export default function ProfileModal({ open, onClose }) {
  const { user, updateUser } = useAuth();

  const [step,       setStep]       = useState('info');   // 'info' | 'crop'
  const [rawImgSrc,  setRawImgSrc]  = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [cropBlob,   setCropBlob]   = useState(null);

  const [fullName,   setFullName]   = useState(user?.fullName || '');
  const [saving, setSaving] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [changingPassword, setChangingPassword] = useState(false);

  const fileRef = useRef(null);

  // Reset when opened
  React.useEffect(() => {
    if (open) {
      setStep('info');
      setRawImgSrc(null);
      setPreviewUrl(null);
      setCropBlob(null);
      setFullName(user?.fullName || '');
      setShowPassword(false);
      setPasswords({ current: '', next: '', confirm: '' });
    }
  }, [open, user]);

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

  // ── Change password (separate action from profile save) ──
  async function handleChangePassword(e) {
    e.preventDefault();
    if (!passwords.current || !passwords.next) return toast.error('Please fill in both password fields');
    if (passwords.next.length < 6) return toast.error('New password must be at least 6 characters');
    if (passwords.next !== passwords.confirm) return toast.error('New passwords do not match');
    setChangingPassword(true);
    try {
      await api.patch('/auth/password', {
        currentPassword: passwords.current,
        newPassword: passwords.next,
      });
      toast.success('Password changed successfully');
      setPasswords({ current: '', next: '', confirm: '' });
      setShowPassword(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  }

  const currentAvatar = previewUrl || (user?.avatar ? mediaUrl(user.avatar) : null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full overflow-hidden"
        style={{ maxWidth: step === 'crop' ? 360 : 420 }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
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

        <div className="px-6 py-6">

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
                  {currentAvatar ? (
                    <img src={currentAvatar} alt="avatar"
                      className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg" />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-primary text-white flex items-center justify-center text-3xl font-bold border-4 border-white shadow-lg">
                      {user?.fullName?.[0]?.toUpperCase()}
                    </div>
                  )}
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

              {/* Change password (collapsible) */}
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                    </svg>
                    Change Password
                  </span>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${showPassword ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                  </svg>
                </button>
                {showPassword && (
                  <form onSubmit={handleChangePassword} className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Current Password</label>
                      <input type="password" value={passwords.current}
                        onChange={e => setPasswords(p => ({ ...p, current: e.target.value }))}
                        className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-gray-50 focus:bg-white transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">New Password</label>
                      <input type="password" value={passwords.next} minLength={6}
                        onChange={e => setPasswords(p => ({ ...p, next: e.target.value }))}
                        className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-gray-50 focus:bg-white transition-all" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Confirm New Password</label>
                      <input type="password" value={passwords.confirm}
                        onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))}
                        className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-gray-50 focus:bg-white transition-all" />
                    </div>
                    <button type="submit" disabled={changingPassword}
                      className="w-full py-2.5 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-900 transition-colors disabled:opacity-50">
                      {changingPassword ? 'Updating...' : 'Update Password'}
                    </button>
                  </form>
                )}
              </div>

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
  );
}
