import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../../context/AuthContext';
import SystemLoader from '../../components/common/SystemLoader';
import api from '../../utils/api';

const ShieldCheckIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />
  </svg>
);
const GearIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
);
const UsersIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
  </svg>
);
const ChartIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M18 20V10M12 20V4M6 20v-6" />
  </svg>
);
const ClipboardIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    <path d="M9 13l2 2 4-4" />
  </svg>
);
const BoltIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);
const BellIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
  </svg>
);
const LeafIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M11 20A7 7 0 019.8 6.1C15.5 5 17 4.48 19 2c1 2 2 5.5 2 10a8 8 0 01-8 8H8" />
    <path d="M6 18h.01M2 22c0-4 3-9 9-11" />
  </svg>
);
const MailIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" /><path d="M22 6l-10 7L2 6" />
  </svg>
);
const LockIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);
const EyeIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const EyeOffIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <line x1="2" y1="2" x2="22" y2="22" />
    <path d="M6.71 6.71A10 10 0 0 0 2.46 12c1.27 4.06 5.06 7 9.54 7a9.97 9.97 0 0 0 5.29-1.52" />
    <path d="M17.37 17.37A10 10 0 0 0 21.54 12c-1.27-4.06-5.06-7-9.54-7a9.97 9.97 0 0 0-3.71.72" />
  </svg>
);

const ROLE_CONTENT = {
  ADMIN: {
    eyebrow: 'Administrator Portal',
    heading: 'Admin Login',
    tagline: 'Manage the system. Serve the people.',
    description: 'Access the administrator dashboard to manage users, monitor requests, and ensure efficient delivery of public services in Cantilan.',
    features: [
      { label: 'Secure Access', icon: ShieldCheckIcon },
      { label: 'System Management', icon: GearIcon },
      { label: 'User Administration', icon: UsersIcon },
      { label: 'Reports & Monitoring', icon: ChartIcon },
    ],
    cardIcon: ShieldCheckIcon,
    cardHeading: 'Administrator Login',
    cardSubtitle: 'Sign in to access the admin dashboard',
    accent: '#2563eb',
  },
  STAFF: {
    eyebrow: 'Staff Portal',
    heading: 'Staff Login',
    tagline: 'Respond promptly. Serve efficiently.',
    description: 'Access your staff dashboard to manage assigned reports, update case statuses, and coordinate with residents of Cantilan.',
    features: [
      { label: 'Case Handling', icon: ClipboardIcon },
      { label: 'Quick Response', icon: BoltIcon },
      { label: 'Status Updates', icon: BellIcon },
    ],
    cardIcon: ClipboardIcon,
    cardHeading: 'Staff Login',
    cardSubtitle: 'Sign in to access your staff dashboard',
    accent: '#2563eb',
  },
  DEFAULT: {
    eyebrow: 'Welcome Back',
    heading: 'Citizen Portal',
    tagline: 'Your concerns, our commitment.',
    description: 'Report your concerns, track your submissions, and help make Cantilan a cleaner, safer, and more progressive community.',
    features: [
      { label: 'Fast Service', icon: ShieldCheckIcon },
      { label: 'Transparent Process', icon: UsersIcon },
      { label: 'Better Community', icon: LeafIcon },
    ],
    cardIcon: null,
    cardHeading: 'Welcome Back',
    cardSubtitle: 'Sign in to access your account',
    accent: '#2563eb',
  },
};

export default function Login({ role }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const selectedRole = role || location.state?.role || null;
  const content = ROLE_CONTENT[selectedRole] || ROLE_CONTENT.DEFAULT;
  const CardIcon = content.cardIcon;

  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loaderInfo, setLoaderInfo] = useState(null); // { userName, role, dest }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/login', form);
      login(res.data.token, res.data.user);
      const dest = res.data.user.role === 'ADMIN' ? '/admin/dashboard'
                 : res.data.user.role === 'STAFF' ? '/staff/dashboard'
                 : '/dashboard';
      setLoaderInfo({ userName: res.data.user.fullName, role: res.data.user.role, dest });
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Login failed');
      setLoading(false);
    }
  }

  async function handleGoogleSuccess(credentialResponse) {
    setLoading(true);
    try {
      const res = await api.post('/auth/google', { credential: credentialResponse.credential });
      login(res.data.token, res.data.user);
      const dest = res.data.user.role === 'ADMIN' ? '/admin/dashboard'
                 : res.data.user.role === 'STAFF' ? '/staff/dashboard'
                 : '/dashboard';
      setLoaderInfo({ userName: res.data.user.fullName, role: res.data.user.role, dest });
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || 'Google sign-in failed');
      setLoading(false);
    }
  }

  if (loaderInfo) {
    return (
      <SystemLoader
        userName={loaderInfo.userName}
        role={loaderInfo.role}
        onDone={() => navigate(loaderInfo.dest)}
      />
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">

      {/* ── Full-bleed background photo (spans the whole page, no seam) ── */}
      <img src="/town-hall.jpg" alt="" className="fixed inset-0 w-full h-full object-cover" />
      <div className="fixed inset-0" style={{ background: 'linear-gradient(100deg, rgba(6,16,42,0.78) 0%, rgba(6,16,42,0.5) 30%, rgba(20,50,100,0.28) 50%, rgba(180,205,235,0.55) 68%, rgba(219,234,254,0.88) 82%, rgba(219,234,254,0.96) 100%)' }} />

      <div className="relative z-10 min-h-screen flex flex-col lg:flex-row pb-10">

      {/* ── Left: hero copy over the photo ── */}
      <div className="relative hidden lg:flex flex-col flex-1 min-h-screen">

        <button onClick={() => navigate('/')}
          className="absolute top-8 left-8 z-10 flex items-center gap-4 text-left">
          <img src="/cantilan-seal.png" alt="Municipality of Cantilan" className="w-14 h-14 object-contain flex-shrink-0" />
          <div>
            <p className="text-white text-sm font-semibold" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}>Municipality of Cantilan</p>
            <h2 className="text-white text-lg font-extrabold leading-tight" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}>Surigao Del Sur - Philippines</h2>
          </div>
        </button>

        <div className="absolute z-10" style={{ left: 48, right: 48, top: '38%' }}>
          <p className="text-white font-bold text-xs uppercase tracking-[0.2em] mb-3" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.7)' }}>
            {content.eyebrow}
          </p>
          <h1 className="text-white font-extrabold mb-2" style={{ fontSize: 'clamp(2.2rem, 4vw, 3.2rem)', textShadow: '0 2px 10px rgba(0,0,0,0.55)' }}>
            {content.heading}
          </h1>
          <p className="text-white/90 text-xl font-semibold mb-4" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.55)' }}>{content.tagline}</p>
          <div className="w-16 h-1 rounded-full mb-5" style={{ background: '#3b82f6' }} />
          <p className="text-white/85 text-sm leading-relaxed max-w-md mb-8" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.5)' }}>
            {content.description}
          </p>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            {content.features.map((f, i) => {
              const FIcon = f.icon;
              return (
                <React.Fragment key={f.label}>
                  {i > 0 && <div className="hidden sm:block w-px h-8" style={{ background: 'rgba(255,255,255,0.3)' }} />}
                  <div className="flex items-center gap-2">
                    <FIcon className="w-5 h-5 text-white flex-shrink-0" style={{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.5))' }} />
                    <span className="text-white text-xs font-semibold leading-tight" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>{f.label}</span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>

      </div>

      {/* ── Right: form panel (transparent — shared photo/gradient shows through) ── */}
      <div className="relative flex-1 min-h-screen flex flex-col">
        <div className="flex justify-end px-8 pt-6">
          <p className="hidden lg:block italic font-medium text-right leading-snug" style={{ color: '#1e3a6d', fontFamily: 'Georgia, serif', maxWidth: 240 }}>
            A Cleaner, Safer, Stronger<br />Cantilan for Everyone
          </p>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-8">
          <div className="w-full rounded-3xl bg-white shadow-xl p-8" style={{ maxWidth: 420, boxShadow: '0 20px 60px rgba(30,58,109,0.18)' }}>

            <button onClick={() => navigate('/')}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors mb-4">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            <div className="flex flex-col items-center text-center mb-6">
              <img src="/cantilan-seal.png" alt="Municipality of Cantilan" className="w-16 h-16 object-contain mb-3" />
              <h2 className="flex items-center gap-2 text-xl font-extrabold" style={{ color: '#0b2f66' }}>
                {CardIcon && <CardIcon className="w-5 h-5" style={{ color: content.accent }} />}
                {content.cardHeading}
              </h2>
              <p className="text-sm text-gray-500 mt-1">{content.cardSubtitle}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600 mb-1.5">
                  <MailIcon className="w-3.5 h-3.5" /> Email Address
                </label>
                <div className="relative">
                  <MailIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="email" value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="admin@civix.gov" required
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all border border-gray-200 bg-gray-50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600 mb-1.5">
                  <LockIcon className="w-3.5 h-3.5" /> Password
                </label>
                <div className="relative">
                  <LockIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type={showPassword ? 'text' : 'password'} value={form.password}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="Enter your password" required
                    className="w-full pl-10 pr-11 py-2.5 rounded-xl text-sm outline-none transition-all border border-gray-200 bg-gray-50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden" />
                  <button type="button" onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    {showPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all disabled:opacity-60 mt-1"
                style={{ background: 'linear-gradient(135deg,#2563eb,#3b82f6)', boxShadow: '0 6px 20px rgba(37,99,235,0.35)' }}>
                {loading
                  ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>Signing in...</>
                  : <>
                      Sign In
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </>}
              </button>
            </form>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">OR</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {(selectedRole === 'ADMIN' || selectedRole === 'STAFF') ? (
              <div className="flex justify-center mb-4 [&>div]:w-full">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => toast.error('Google sign-in failed')}
                  theme="outline"
                  shape="rectangular"
                  size="large"
                  width="356"
                  text="signin_with"
                />
              </div>
            ) : (
              <p className="text-center text-xs text-gray-400 mb-4">Google sign-in is available for staff and admin accounts.</p>
            )}

            <div className="flex items-center justify-between text-xs">
              <button type="button"
                onClick={() => toast('Please contact the system administrator to reset your password.')}
                className="text-gray-500 hover:text-gray-700 font-medium transition-colors">
                Forgot Password?
              </button>
              <button type="button"
                onClick={() => toast('No account needed — citizen reports are submitted anonymously.')}
                className="font-semibold transition-colors" style={{ color: '#2563eb' }}>
                Need an Account? <span className="underline">Register</span>
              </button>
            </div>
          </div>
        </div>

        <div className="hidden lg:block px-8 py-3 text-right text-xs text-gray-500/80">
          © {new Date().getFullYear()} Municipality of Cantilan. All rights reserved.
        </div>
      </div>

      </div>

      {/* ── Full-width wave footer ── */}
      <div className="fixed bottom-0 left-0 right-0 z-20 pointer-events-none">
        <svg viewBox="0 0 1600 40" preserveAspectRatio="none" className="w-full block" style={{ height: 32 }}>
          <path d="M0,24 C400,0 1000,40 1600,10 L1600,40 L0,40 Z" fill="#0b2f66" />
        </svg>
        <div style={{ background: '#0b2f66' }} className="px-8 py-2.5 flex items-center justify-between text-white/70 text-xs -mt-px pointer-events-auto">
          <span className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Municipality of Cantilan &nbsp;|&nbsp; Cantilan, Surigao del Sur
          </span>
          <span className="hidden sm:inline">© {new Date().getFullYear()} Municipality of Cantilan. All rights reserved.</span>
        </div>
      </div>
    </div>
  );
}
