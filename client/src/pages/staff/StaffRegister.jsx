import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BrandImg } from '../../context/BrandingContext';
import { Skel, useSkeletonGate } from '../../components/common/Skeleton';
import { signInCss } from '../../components/common/signInButtonCss';
import api from '../../utils/api';

const MIN_SPIN_MS = 800;
const SUCCESS_MS = 700;
const SHAKE_MS = 450;
const NOTE_MAX = 1000;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const regCss = `
@keyframes rg-card-in { from { opacity: 0; transform: translateY(18px) scale(.985); } to { opacity: 1; transform: none; } }
@keyframes rg-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes rg-ring { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
@keyframes rg-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,.45); } 50% { box-shadow: 0 0 0 6px rgba(245,158,11,0); } }
.rg-card { animation: rg-card-in .55s cubic-bezier(.22,1,.36,1) both; }
.rg-rise { animation: rg-rise .45s cubic-bezier(.22,1,.36,1) both; }
.rg-field .rg-icon { transition: color .2s ease; }
.rg-field:focus-within .rg-icon { color: #2563eb; }
.rg-input {
  width: 100%; border-radius: .75rem; font-size: .875rem; outline: none;
  border: 1px solid #e5e7eb; background: #f9fafb; color: #111827;
  padding: .625rem 1rem .625rem 2.5rem;
  transition: border-color .2s ease, background-color .2s ease, box-shadow .2s ease;
}
.rg-input:hover { border-color: #d1d5db; }
.rg-input:focus { background: #fff; border-color: #60a5fa; box-shadow: 0 0 0 3px rgba(37,99,235,.12); }
.rg-input.is-good { border-color: #86efac; }
.rg-input.is-bad { border-color: #fca5a5; }
.rg-input::-ms-reveal, .rg-input::-ms-clear { display: none; }
.rg-meter > span { transition: background-color .3s ease; }
.rg-ring { stroke-dasharray: 1; stroke-dashoffset: 1; animation: rg-ring .6s .15s ease-out forwards; }
.rg-tick { stroke-dasharray: 1; stroke-dashoffset: 1; animation: rg-ring .35s .6s ease-out forwards; }
.rg-pulse { animation: rg-pulse 1.8s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .rg-card, .rg-rise, .rg-pulse { animation: none; }
  .rg-ring, .rg-tick { animation: none; stroke-dashoffset: 0; }
}
`;

// ── Icons (same stroke style as the sign-in page) ────────────────────────────
const svg = d => p => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>{d}</svg>
);
const UserIcon = svg(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></>);
const MailIcon = svg(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>);
const BuildingIcon = svg(<><path d="M4 21V5a2 2 0 012-2h8a2 2 0 012 2v16" /><path d="M16 9h2a2 2 0 012 2v10M3 21h18M8 7h4M8 11h4M8 15h4" /></>);
const LockIcon = svg(<><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></>);
const NoteIcon = svg(<><path d="M4 20h4L19 9a2.8 2.8 0 00-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></>);
const EyeIcon = svg(<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>);
const EyeOffIcon = svg(<><path d="M3 3l18 18M10.6 5.1A10.4 10.4 0 0112 5c6.5 0 10 7 10 7a17.4 17.4 0 01-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 005.4-1.6" /><path d="M9.9 9.9a3 3 0 004.2 4.2" /></>);
const CheckIcon = svg(<path d="M5 12.5l4.5 4.5L19 7.5" />);
const XIcon = svg(<path d="M6 6l12 12M18 6L6 18" />);

// 0 = too short, then weak / fair / good / strong
function passwordStrength(pw) {
  if (pw.length < 8) return 0;
  let score = 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  if (pw.length >= 12) score++;
  return Math.min(score, 4);
}
const STRENGTH = [
  { label: 'At least 8 characters', color: '#d1d5db', text: '#9ca3af' },
  { label: 'Weak', color: '#ef4444', text: '#dc2626' },
  { label: 'Fair', color: '#f59e0b', text: '#d97706' },
  { label: 'Good', color: '#22c55e', text: '#16a34a' },
  { label: 'Strong', color: '#15803d', text: '#15803d' },
];

// Request -> administrator verifies -> sign in
function Steps({ current }) {
  const steps = ['Send request', 'Admin verifies', 'Sign in'];
  return (
    <ol className="flex items-center gap-2" aria-label="How it works">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center gap-2 min-w-0 flex-1 last:flex-none">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 transition-colors ${
              done ? 'bg-green-500 text-white' : active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'
            }`}>
              {done ? <CheckIcon className="w-3.5 h-3.5" strokeWidth="3" /> : i + 1}
            </span>
            <span className={`text-[11px] font-semibold whitespace-nowrap ${active ? 'text-blue-700' : done ? 'text-gray-600' : 'text-gray-400'}`}>{label}</span>
            {i < steps.length - 1 && <span className={`hidden sm:block h-px flex-1 ${done ? 'bg-green-300' : 'bg-gray-200'}`} aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}

function Field({ label, htmlFor, icon: FieldIcon, hint, delay, children, trailing }) {
  return (
    <div className="rg-field rg-rise" style={{ animationDelay: `${delay}s` }}>
      <label htmlFor={htmlFor} className="flex items-center gap-1.5 text-xs font-bold text-gray-600 mb-1.5">
        <FieldIcon className="w-3.5 h-3.5" /> {label}
      </label>
      <div className="relative">
        <FieldIcon className="rg-icon w-4 h-4 absolute left-3.5 top-3 text-gray-400 pointer-events-none" />
        {children}
        {trailing}
      </div>
      {hint}
    </div>
  );
}

function RegisterSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading form">
      <Skel className="h-3 w-24 mb-5" />
      <Skel className="h-6 w-60 mb-2" />
      <Skel className="h-3 w-full mb-1.5" />
      <Skel className="h-3 w-4/5 mb-5" />
      <div className="flex gap-3 mb-6">
        {[0, 1, 2].map(i => <div key={i} className="flex items-center gap-2 flex-1"><Skel className="w-6 h-6 rounded-full" /><Skel className="h-3 flex-1" /></div>)}
      </div>
      {[0, 1, 2].map(i => (
        <div key={i} className="mb-4"><Skel className="h-3 w-28 mb-2" /><Skel className="h-11 w-full rounded-xl" /></div>
      ))}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {[0, 1].map(i => <div key={i}><Skel className="h-3 w-24 mb-2" /><Skel className="h-11 w-full rounded-xl" /></div>)}
      </div>
      <Skel className="h-3 w-36 mb-2" />
      <Skel className="h-20 w-full rounded-xl mb-5" />
      <Skel className="h-12 w-full rounded-xl" />
    </div>
  );
}

function SentView({ email, onBack }) {
  const timeline = [
    { label: 'Request sent', detail: 'Your account is created but locked for now.', state: 'done' },
    { label: 'Administrator verifies you', detail: 'An administrator checks that you work for the municipality.', state: 'current' },
    { label: 'Sign in on Staff Login', detail: `Once approved, we'll email ${email}.`, state: 'next' },
  ];
  return (
    <div className="text-center py-2">
      <svg className="w-16 h-16 mx-auto" viewBox="0 0 52 52" aria-hidden="true">
        <circle cx="26" cy="26" r="24" fill="#f0fdf4" />
        <circle className="rg-ring" cx="26" cy="26" r="24" fill="none" stroke="#22c55e" strokeWidth="3" pathLength="1" transform="rotate(-90 26 26)" />
        <path className="rg-tick" d="M16 27l7 7 14-15" fill="none" stroke="#16a34a" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" pathLength="1" />
      </svg>
      <h1 className="rg-rise mt-4 text-xl font-extrabold" style={{ color: '#0b2f66', animationDelay: '.2s' }}>Request sent</h1>
      <p className="rg-rise text-sm text-gray-500 mt-1.5" style={{ animationDelay: '.28s' }}>Here's what happens next.</p>

      <ol className="mt-6 text-left space-y-0">
        {timeline.map((t, i) => (
          <li key={t.label} className="rg-rise flex gap-3" style={{ animationDelay: `${0.36 + i * 0.08}s` }}>
            <div className="flex flex-col items-center">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                t.state === 'done' ? 'bg-green-500 text-white' : t.state === 'current' ? 'rg-pulse bg-amber-500 text-white' : 'bg-gray-100 text-gray-400'
              }`}>
                {t.state === 'done' ? <CheckIcon className="w-3.5 h-3.5" strokeWidth="3" /> : <span className="text-[11px] font-bold">{i + 1}</span>}
              </span>
              {i < timeline.length - 1 && <span className="w-px flex-1 my-1 bg-gray-200" aria-hidden="true" />}
            </div>
            <div className="pb-4">
              <p className={`text-sm font-semibold ${t.state === 'next' ? 'text-gray-500' : 'text-gray-800'}`}>{t.label}</p>
              <p className="text-xs text-gray-500 mt-0.5 break-words">{t.detail}</p>
            </div>
          </li>
        ))}
      </ol>

      <button type="button" onClick={onBack}
        className="si-btn w-full mt-2 py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2">
        Back to Staff Login
      </button>
    </div>
  );
}

// Public page for municipal employees to ask for a staff account. The account
// can't sign in until an administrator approves it in Access Requests.
export default function StaffRegister() {
  const navigate = useNavigate();
  const gate = useSkeletonGate();
  const [departments, setDepartments] = useState(null);
  const [form, setForm] = useState({ fullName: '', email: '', department: '', password: '', confirm: '', reason: '' });
  const [showPw, setShowPw] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [sent, setSent] = useState(false);
  const busy = status !== 'idle';
  const set = key => e => setForm(p => ({ ...p, [key]: e.target.value }));

  useEffect(() => {
    gate(api.get('/settings/public'))
      .then(res => setDepartments(res.data.departments || []))
      .catch(() => {
        setDepartments([]);
        toast.error('Could not load the office list. Please refresh the page.');
      });
  }, [gate]);

  const strength = passwordStrength(form.password);
  const emailOk = EMAIL_RE.test(form.email.trim());
  const confirmState = !form.confirm ? null : form.confirm === form.password ? 'match' : 'mismatch';

  function fail(message) {
    toast.error(message);
    setStatus('error');
    setTimeout(() => setStatus('idle'), SHAKE_MS);
  }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    if (!form.fullName.trim()) return fail('Please enter your full name');
    if (!emailOk) return fail('Please enter a valid email address');
    if (!form.department) return fail('Please choose your office');
    if (form.password.length < 8) return fail('Password must be at least 8 characters');
    if (form.password !== form.confirm) return fail('Passwords do not match');
    setStatus('loading');
    try {
      const { confirm, ...body } = form;
      await Promise.all([api.post('/auth/staff-register', body), sleep(MIN_SPIN_MS)]);
      setStatus('success');
      await sleep(SUCCESS_MS);
      setSent(true);
    } catch (err) {
      fail(err.response?.data?.error || err.message || 'Failed to send the request');
    }
  }

  const eyeButton = (
    <button type="button" onClick={() => setShowPw(v => !v)} tabIndex={-1}
      className="absolute right-3.5 top-3 text-gray-400 hover:text-gray-600 transition-colors"
      aria-label={showPw ? 'Hide passwords' : 'Show passwords'}>
      {showPw ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
    </button>
  );

  return (
    <div className="min-h-screen relative overflow-hidden">
      <style>{signInCss}{regCss}</style>
      <BrandImg kind="hero" className="fixed inset-0 w-full h-full object-cover" />
      <div className="fixed inset-0" style={{ background: 'linear-gradient(160deg, rgba(6,16,42,0.82) 0%, rgba(20,50,100,0.6) 45%, rgba(219,234,254,0.85) 100%)' }} />

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-10">
        <button type="button" onClick={() => navigate('/')} className="rg-rise flex items-center gap-3 mb-6 text-left">
          <BrandImg kind="seal" alt="Municipality of Cantilan" className="w-12 h-12 object-contain flex-shrink-0" />
          <div>
            <p className="text-white/80 text-xs font-semibold" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}>Municipality of Cantilan</p>
            <p className="text-white text-base font-extrabold leading-tight" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}>Surigao Del Sur - Philippines</p>
          </div>
        </button>

        <div className="rg-card w-full rounded-3xl bg-white p-6 sm:p-8" style={{ maxWidth: 500, boxShadow: '0 24px 64px -12px rgba(15,23,42,0.4)' }}>
          {departments === null ? (
            <RegisterSkeleton />
          ) : sent ? (
            <SentView email={form.email.trim()} onBack={() => navigate('/staff-login')} />
          ) : (
            <>
              <button type="button" onClick={() => navigate('/staff-login')}
                className="rg-rise flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-600 transition-colors mb-4">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                Staff Login
              </button>
              <div className="rg-rise" style={{ animationDelay: '.04s' }}>
                <h1 className="text-xl font-extrabold" style={{ color: '#0b2f66' }}>Request a Staff Account</h1>
                <p className="text-sm text-gray-500 mt-1">
                  For employees of the Municipality of Cantilan. An administrator must approve your account before you can sign in.
                </p>
              </div>
              <div className="rg-rise mt-4 mb-5 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100" style={{ animationDelay: '.08s' }}>
                <Steps current={0} />
              </div>

              <form onSubmit={submit} className="space-y-4" noValidate>
                <Field label="Full Name *" htmlFor="rg-name" icon={UserIcon} delay={0.12}>
                  <input id="rg-name" className="rg-input" value={form.fullName} onChange={set('fullName')} required autoComplete="name" placeholder="Juan Dela Cruz" />
                </Field>

                <Field label="Email Address *" htmlFor="rg-email" icon={MailIcon} delay={0.16}
                  hint={<p className="text-[11px] text-gray-400 mt-1">You'll sign in with this email. The approval notice is also sent here.</p>}
                  trailing={emailOk && <CheckIcon className="w-4 h-4 absolute right-3.5 top-3 text-green-500" strokeWidth="2.5" />}>
                  <input id="rg-email" type="email" className={`rg-input pr-10 ${emailOk ? 'is-good' : ''}`} value={form.email} onChange={set('email')} required autoComplete="email" placeholder="you@example.com" />
                </Field>

                <Field label="Department / Office *" htmlFor="rg-dept" icon={BuildingIcon} delay={0.2}>
                  <select id="rg-dept" className="rg-input" value={form.department} onChange={set('department')} required>
                    <option value="" disabled>Select your office</option>
                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Password *" htmlFor="rg-pw" icon={LockIcon} delay={0.24} trailing={eyeButton}
                    hint={
                      <div className="mt-1.5" aria-live="polite">
                        <div className="rg-meter grid grid-cols-4 gap-1" aria-hidden="true">
                          {[1, 2, 3, 4].map(n => (
                            <span key={n} className="h-1 rounded-full" style={{ background: form.password && strength >= n ? STRENGTH[strength].color : '#e5e7eb' }} />
                          ))}
                        </div>
                        <p className="text-[11px] mt-1 font-medium" style={{ color: STRENGTH[form.password ? strength : 0].text }}>
                          {!form.password ? STRENGTH[0].label : strength === 0 ? 'Too short: use at least 8 characters' : `Strength: ${STRENGTH[strength].label}`}
                        </p>
                      </div>
                    }>
                    <input id="rg-pw" type={showPw ? 'text' : 'password'} className="rg-input pr-10" value={form.password} onChange={set('password')} required minLength={8} autoComplete="new-password" />
                  </Field>

                  <Field label="Confirm Password *" htmlFor="rg-confirm" icon={LockIcon} delay={0.28}
                    trailing={confirmState && (confirmState === 'match'
                      ? <CheckIcon className="w-4 h-4 absolute right-3.5 top-3 text-green-500" strokeWidth="2.5" />
                      : <XIcon className="w-4 h-4 absolute right-3.5 top-3 text-red-400" strokeWidth="2.5" />)}
                    hint={confirmState && (
                      <p className={`text-[11px] mt-1.5 font-medium ${confirmState === 'match' ? 'text-green-600' : 'text-red-500'}`} aria-live="polite">
                        {confirmState === 'match' ? 'Passwords match' : "Passwords don't match yet"}
                      </p>
                    )}>
                    <input id="rg-confirm" type={showPw ? 'text' : 'password'} value={form.confirm} onChange={set('confirm')} required autoComplete="new-password"
                      className={`rg-input pr-10 ${confirmState === 'match' ? 'is-good' : confirmState === 'mismatch' ? 'is-bad' : ''}`} />
                  </Field>
                </div>

                <Field label="Note for the administrator" htmlFor="rg-note" icon={NoteIcon} delay={0.32}
                  hint={
                    <div className="flex justify-between gap-3 text-[11px] text-gray-400 mt-1">
                      <span>Your position or who can vouch for you, so the administrator can verify you.</span>
                      <span className="flex-shrink-0 tabular-nums">{form.reason.length} / {NOTE_MAX}</span>
                    </div>
                  }>
                  <textarea id="rg-note" className="rg-input resize-none" rows={3} maxLength={NOTE_MAX} value={form.reason} onChange={set('reason')}
                    placeholder="e.g., Administrative Aide, Municipal Engineering Office" />
                </Field>

                <div className="rg-rise" style={{ animationDelay: '.36s' }}>
                  <button type="submit" disabled={busy} aria-busy={status === 'loading'}
                    className={`si-btn w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center ${busy ? `is-${status}` : ''}`}>
                    <span className="si-success-bg" aria-hidden="true" />
                    <span className="si-core" aria-hidden="true" />
                    <span className="si-labels">
                      <span className="si-label si-label-idle" aria-hidden={status === 'loading' || status === 'success'}>
                        Send request
                        <svg className="si-arrow w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14M13 6l6 6-6 6" />
                        </svg>
                      </span>
                      <span className="si-label si-label-loading" aria-hidden={status !== 'loading'}>
                        <svg className="si-spinner" viewBox="0 0 50 50" aria-hidden="true">
                          <circle cx="25" cy="25" r="20" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="5" />
                          <circle className="si-spinner-arc" cx="25" cy="25" r="20" fill="none" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" />
                        </svg>
                        <span className="sr-only">Sending request</span>
                      </span>
                      <span className="si-label si-label-success" aria-hidden={status !== 'success'}>
                        <svg className="si-check-icon w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path className="si-check" pathLength="1" d="M5 12.5l4.5 4.5L19 7.5" />
                        </svg>
                        <span className="sr-only">Request sent</span>
                      </span>
                    </span>
                  </button>
                  <p className="text-center text-xs text-gray-500 mt-4">
                    Already approved?{' '}
                    <button type="button" onClick={() => navigate('/staff-login')} className="font-semibold underline" style={{ color: '#2563eb' }}>Sign in</button>
                  </p>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
