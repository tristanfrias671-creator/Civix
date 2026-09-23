import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../utils/api';

const css = `
@keyframes floatA { 0%,100%{transform:translate(0,0)} 50%{transform:translate(18px,-14px)} }
@keyframes floatB { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-14px,18px)} }
@keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
@keyframes stepIn { from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:translateX(0)} }
.orb-a { animation: floatA 16s ease-in-out infinite; }
.orb-b { animation: floatB 20s ease-in-out infinite; }
.fade-up   { animation: fadeUp .55s cubic-bezier(.22,1,.36,1) both; }
.fade-up-1 { animation: fadeUp .55s .08s cubic-bezier(.22,1,.36,1) both; }
.step-in   { animation: stepIn .3s cubic-bezier(.22,1,.36,1) both; }
`;

const EyeIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);
const EyeOffIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="2" y1="2" x2="22" y2="22"/>
    <path d="M6.71 6.71A10 10 0 0 0 2.46 12c1.27 4.06 5.06 7 9.54 7a9.97 9.97 0 0 0 5.29-1.52"/>
    <path d="M17.37 17.37A10 10 0 0 0 21.54 12c-1.27-4.06-5.06-7-9.54-7a9.97 9.97 0 0 0-3.71.72"/>
  </svg>
);
const CheckIcon = () => (
  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const ArrowIcon = () => (
  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
);

const DOTS = [
  {top:'8%', left:'6%',  s:6},  {top:'15%', right:'8%', s:4},
  {top:'40%', left:'3%', s:5},  {top:'65%', right:'5%', s:6},
  {top:'80%', left:'12%',s:4},  {top:'25%', left:'45%', s:3},
  {top:'70%', right:'15%',s:5}, {top:'50%', left:'88%', s:4},
];

const STEPS = ['Account', 'Contact', 'Security'];

const inputCls     = 'w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all text-white placeholder-gray-300';
const glassInputSt = { background:'rgba(255,255,255,0.12)', border:'1px solid rgba(255,255,255,0.25)' };
const glassOnFocus = e => { e.target.style.border='1px solid rgba(255,255,255,0.7)'; e.target.style.boxShadow='0 0 0 3px rgba(255,255,255,0.1)'; };
const glassOnBlur  = e => { e.target.style.border='1px solid rgba(255,255,255,0.25)'; e.target.style.boxShadow='none'; };
const inputSt  = { border:'1px solid #e5e7eb' };
const onFocus  = e => { e.target.style.border='1px solid #7c3aed'; e.target.style.boxShadow='0 0 0 3px rgba(124,58,237,.12)'; e.target.style.background='#fff'; };
const onBlur   = e => { e.target.style.border='1px solid #e5e7eb'; e.target.style.boxShadow='none'; e.target.style.background='#f9fafb'; };

const btnPrimary = {
  background: 'linear-gradient(135deg,#6d28d9,#7c3aed)',
  boxShadow:  '0 4px 18px rgba(109,40,217,.35)',
};
const btnBack = {
  background: 'rgba(255,255,255,0.12)',
  border:     '1px solid rgba(255,255,255,0.25)',
  color:      'rgba(255,255,255,0.85)',
};

export default function Register() {
  const navigate = useNavigate();
  const [step, setStep]             = useState(0);
  const [form, setForm]             = useState({ fullName:'', email:'', gmail:'', mobileNumber:'', password:'', confirm:'' });
  const [loading, setLoading]       = useState(false);
  const [showPass, setShowPass]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  function nextStep(e) {
    e.preventDefault();
    if (step === 0 && !form.fullName.trim()) return toast.error('Full name is required');
    if (step === 1 && !form.email.trim())    return toast.error('Email is required');
    setStep(s => s + 1);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password !== form.confirm) return toast.error('Passwords do not match');
    if (form.password.length < 6)       return toast.error('Password must be at least 6 characters');
    setLoading(true);
    try {
      await api.post('/auth/register', {
        fullName: form.fullName, email: form.email,
        gmail: form.gmail, mobileNumber: form.mobileNumber, password: form.password,
      });
      toast.success('Account created! Please sign in.');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally { setLoading(false); }
  }

  return (
    <>
      <style>{css}</style>
      <div className="glass-page min-h-screen w-screen flex flex-col items-center justify-center overflow-auto py-10 px-4 relative"
        style={{
          backgroundImage: 'url(/town-hall.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}>

        {/* ── Dark overlay over the photo ── */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(10,12,35,0.72)' }} />


        {/* ── Logos ── */}
        <div className="fade-up flex items-center justify-center relative z-10"
          style={{ background: 'transparent', marginBottom: '-20px', gap: '2px' }}>
          <img src="/cantilan-seal.png" alt="Municipality of Cantilan"
            style={{ width: 95, height: 95, objectFit: 'contain', objectPosition: 'center', display: 'block' }} />
          <img src="/civix-logo.png" alt="CIVIX"
            style={{ width: 200, height: 200, objectFit: 'contain', objectPosition: 'center', display: 'block' }} />
        </div>

        {/* ── Card ── */}
        <div className="fade-up-1 relative z-10 w-full" style={{ maxWidth:420 }}>
          <div className="rounded-2xl px-8 py-8"
            style={{
              background: 'rgba(255,255,255,0.12)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.25)',
              boxShadow: '0 8px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.2)',
            }}>

            <h2 className="text-2xl font-extrabold text-white mb-0.5">Create account</h2>
            <p className="text-sm mb-5" style={{ color:'rgba(255,255,255,0.7)' }}>Fill in the details to get started</p>

            {/* Step indicator */}
            <div className="flex items-center mb-6">
              {STEPS.map((label, i) => (
                <React.Fragment key={i}>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                      style={{
                        background: i < step ? 'linear-gradient(135deg,#6d28d9,#7c3aed)' : i === step ? 'linear-gradient(135deg,#7c3aed,#9333ea)' : '#f3f4f6',
                        color:      i <= step ? '#fff' : '#9ca3af',
                        boxShadow:  i === step ? '0 0 12px rgba(124,58,237,.35)' : 'none',
                      }}>
                      {i < step ? <CheckIcon/> : i + 1}
                    </div>
                    <span className="text-xs font-semibold hidden sm:block"
                      style={{ color: i === step ? '#c4b5fd' : 'rgba(255,255,255,0.4)' }}>
                      {label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="flex-1 h-px mx-2 transition-all"
                      style={{ background: i < step ? '#a78bfa' : 'rgba(255,255,255,0.2)' }}/>
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Fixed height — no layout jump between steps */}
            <div style={{ minHeight: 210 }}>

              {/* STEP 0 */}
              {step === 0 && (
                <form onSubmit={nextStep} className="step-in space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color:'rgba(255,255,255,0.85)' }}>Full Name</label>
                    <input type="text" value={form.fullName} onChange={e => set('fullName', e.target.value)}
                      placeholder="Juan dela Cruz" required
                      className={inputCls} style={glassInputSt} onFocus={glassOnFocus} onBlur={glassOnBlur}/>
                  </div>
                  <button type="submit"
                    className="w-full py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 mt-1 transition-all"
                    style={btnPrimary}
                    onMouseEnter={e => e.currentTarget.style.boxShadow='0 6px 26px rgba(109,40,217,.50)'}
                    onMouseLeave={e => e.currentTarget.style.boxShadow='0 4px 18px rgba(109,40,217,.35)'}>
                    Continue <ArrowIcon/>
                  </button>
                </form>
              )}

              {/* STEP 1 */}
              {step === 1 && (
                <form onSubmit={nextStep} className="step-in space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color:'rgba(255,255,255,0.85)' }}>Email Address</label>
                    <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                      placeholder="juan@email.com" required
                      className={inputCls} style={glassInputSt} onFocus={glassOnFocus} onBlur={glassOnBlur}/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color:'rgba(255,255,255,0.85)' }}>
                      Gmail <span className="font-normal" style={{ color:'rgba(255,255,255,0.5)' }}>(Optional)</span>
                    </label>
                    <input type="email" value={form.gmail} onChange={e => set('gmail', e.target.value)}
                      placeholder="juan@gmail.com"
                      className={inputCls} style={glassInputSt} onFocus={glassOnFocus} onBlur={glassOnBlur}/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color:'rgba(255,255,255,0.85)' }}>
                      Mobile Number <span className="font-normal" style={{ color:'rgba(255,255,255,0.5)' }}>(Optional)</span>
                    </label>
                    <input type="tel" value={form.mobileNumber} onChange={e => set('mobileNumber', e.target.value)}
                      placeholder="09XXXXXXXXX"
                      className={inputCls} style={glassInputSt} onFocus={glassOnFocus} onBlur={glassOnBlur}/>
                  </div>
                  <div className="flex gap-2 mt-1">
                    <button type="button" onClick={() => setStep(0)}
                      className="flex-1 py-2.5 rounded-xl font-bold text-sm transition-all hover:bg-gray-100"
                      style={btnBack}>Back</button>
                    <button type="submit"
                      className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all"
                      style={btnPrimary}
                      onMouseEnter={e => e.currentTarget.style.boxShadow='0 6px 26px rgba(109,40,217,.50)'}
                      onMouseLeave={e => e.currentTarget.style.boxShadow='0 4px 18px rgba(109,40,217,.35)'}>
                      Continue <ArrowIcon/>
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 2 */}
              {step === 2 && (
                <form onSubmit={handleSubmit} className="step-in space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color:'rgba(255,255,255,0.85)' }}>Password</label>
                    <div className="relative">
                      <input type={showPass?'text':'password'} value={form.password}
                        onChange={e => set('password', e.target.value)} placeholder="Min. 6 characters" required
                        className={`${inputCls} pr-11 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden`}
                        style={glassInputSt} onFocus={glassOnFocus} onBlur={glassOnBlur}/>
                      <button type="button" onClick={() => setShowPass(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors" style={{ color:'rgba(255,255,255,0.5)' }}>
                        {showPass ? <EyeOffIcon/> : <EyeIcon/>}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color:'rgba(255,255,255,0.85)' }}>Confirm Password</label>
                    <div className="relative">
                      <input type={showConfirm?'text':'password'} value={form.confirm}
                        onChange={e => set('confirm', e.target.value)} placeholder="Re-enter password" required
                        className={`${inputCls} pr-11 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden`}
                        style={glassInputSt} onFocus={glassOnFocus} onBlur={glassOnBlur}/>
                      <button type="button" onClick={() => setShowConfirm(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors" style={{ color:'rgba(255,255,255,0.5)' }}>
                        {showConfirm ? <EyeOffIcon/> : <EyeIcon/>}
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-1">
                    <button type="button" onClick={() => setStep(1)}
                      className="flex-1 py-2.5 rounded-xl font-bold text-sm transition-all hover:bg-gray-100"
                      style={btnBack}>Back</button>
                    <button type="submit" disabled={loading}
                      className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-60 transition-all"
                      style={loading ? { background:'#a78bfa' } : btnPrimary}
                      onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow='0 6px 26px rgba(109,40,217,.50)'; }}
                      onMouseLeave={e => e.currentTarget.style.boxShadow='0 4px 18px rgba(109,40,217,.35)'}>
                      {loading
                        ? <><svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                          </svg>Creating...</>
                        : 'Create Account'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mt-5 mb-4">
              <div className="flex-1 h-px" style={{ background:'rgba(255,255,255,0.2)' }}/>
              <span className="text-xs" style={{ color:'rgba(255,255,255,0.5)' }}>or</span>
              <div className="flex-1 h-px" style={{ background:'rgba(255,255,255,0.2)' }}/>
            </div>

            <p className="text-center text-sm" style={{ color:'rgba(255,255,255,0.7)' }}>
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-red-500 hover:text-red-300 transition-colors">
                Sign in here
              </Link>
            </p>
          </div>

          {/* Footer */}
          <p className="text-center text-xs mt-6" style={{ color:'rgba(255,255,255,0.45)' }}>
            © {new Date().getFullYear()} Municipality of Cantilan · All rights reserved
          </p>
        </div>
      </div>
    </>
  );
}
