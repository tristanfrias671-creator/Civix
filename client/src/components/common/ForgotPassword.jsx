import React, { useEffect, useRef, useState } from 'react';
import api from '../../utils/api';
import { deviceId } from '../../utils/deviceId';
import { signInCss } from './signInButtonCss';

const CODE_LENGTH = 6;
const MIN_PASSWORD = 8; // the same rule as a new staff account
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The code boxes shrink to fit narrow phones (the sign-in card has wide padding).
const css = `
.fp-code {
  flex: 1 1 0; min-width: 0; max-width: 2.875rem; height: 3rem;
  text-align: center; font-size: 1.375rem; font-weight: 700;
  border-radius: .75rem; outline: none; border: 1px solid #d1d5db; background: #f9fafb; color: #111827;
  transition: border-color .2s ease, background-color .2s ease, box-shadow .2s ease;
}
.fp-code:focus { background: #fff; border-color: #60a5fa; box-shadow: 0 0 0 3px rgba(37,99,235,.15); }
.fp-code:disabled { opacity: .6; }
`;

const INPUT = 'w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all border border-gray-200 bg-gray-50 focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-100 [&::-ms-reveal]:hidden [&::-ms-clear]:hidden';
const LABEL = 'block text-xs font-bold text-gray-600 mb-1.5';

const icon = d => p => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>{d}</svg>
);
const MailIcon = icon(<><path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" /><path d="M22 6l-10 7L2 6" /></>);
const LockIcon = icon(<><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></>);
const KeyIcon = icon(<><circle cx="7.5" cy="15.5" r="4.5" /><path d="M10.7 12.3L21 2M16 7l3 3M18 5l2 2" /></>);
const CheckIcon = icon(<path d="M5 12.5l4.5 4.5L19 7.5" />);

// "Forgot password?" on the Staff Login page and on the private admin sign-in page:
// the email of the account, then the 6-digit code emailed to it and a new password.
// The server never says whether an email has an account, and neither does this page.
// `onBack(email)` returns to the sign-in form.
export default function ForgotPassword({ portal, adminPath, initialEmail = '', onBack }) {
  const [step, setStep] = useState('email'); // email | code | done
  const [email, setEmail] = useState(initialEmail);
  const [digits, setDigits] = useState(() => Array(CODE_LENGTH).fill(''));
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [needsNewCode, setNeedsNewCode] = useState(false);
  const [wait, setWait] = useState(0);
  const emailRef = useRef(null);
  const boxes = useRef([]);
  const passwordRef = useRef(null);
  const headingRef = useRef(null);

  // Countdown until another code may be sent.
  useEffect(() => {
    if (wait <= 0) return undefined;
    const timer = setTimeout(() => setWait(w => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  // Each step starts with the focus where the person types next.
  useEffect(() => {
    if (step === 'email') emailRef.current?.focus();
    else if (step === 'code') boxes.current[0]?.focus();
    else headingRef.current?.focus();
  }, [step]);

  const request = extra => ({ portal, adminPath, device: deviceId(), email: email.trim(), ...extra });
  const clearCode = () => setDigits(Array(CODE_LENGTH).fill(''));

  async function sendCode(e) {
    e?.preventDefault();
    if (!EMAIL_RE.test(email.trim())) {
      setError('Please enter a valid email address.');
      emailRef.current?.focus();
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data } = await api.post('/auth/password-reset/code', request());
      setWait(data.resendAfterSeconds ?? 60);
      setNeedsNewCode(false);
      clearCode();
      if (step === 'code') {
        setNotice('We sent a new code. Use the code in the newest email.');
        boxes.current[0]?.focus();
      }
      setStep('code');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Could not send the code. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  // Typing or pasting several digits fills the next boxes too; a full code moves
  // on to the new password.
  function fill(index, value) {
    const typed = value.replace(/\D/g, '');
    const next = [...digits];
    if (!typed) {
      next[index] = '';
      setDigits(next);
      return;
    }
    for (let i = 0; i < typed.length && index + i < CODE_LENGTH; i++) next[index + i] = typed[i];
    setDigits(next);
    if (next.every(Boolean)) passwordRef.current?.focus();
    else boxes.current[Math.min(index + typed.length, CODE_LENGTH - 1)]?.focus();
  }

  function onCodeKey(index, e) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) boxes.current[index - 1]?.focus();
    else if (e.key === 'ArrowLeft' && index > 0) boxes.current[index - 1]?.focus();
    else if (e.key === 'ArrowRight' && index < CODE_LENGTH - 1) boxes.current[index + 1]?.focus();
  }

  async function changePassword(e) {
    e.preventDefault();
    const code = digits.join('');
    setNotice('');
    if (code.length < CODE_LENGTH) {
      setError('Please type the 6-digit code from the email.');
      boxes.current[Math.max(0, digits.findIndex(d => !d))]?.focus();
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setError(`Your new password must be at least ${MIN_PASSWORD} characters.`);
      passwordRef.current?.focus();
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/password-reset', request({ code, newPassword: password }));
      setStep('done');
    } catch (err) {
      const data = err.response?.data || {};
      setError(data.error || err.message || 'Could not change the password. Please try again.');
      if (data.codeError) {
        clearCode();
        if (data.codeError === 'wrong') setTimeout(() => boxes.current[0]?.focus(), 0);
        else { setNeedsNewCode(true); setWait(0); }
      } else if (data.field === 'password') {
        passwordRef.current?.focus();
      }
    } finally {
      setBusy(false);
    }
  }

  const mismatch = confirm.length > 0 && confirm !== password;
  const StepIcon = step === 'done' ? CheckIcon : step === 'code' ? MailIcon : KeyIcon;

  return (
    <div>
      <style>{css + signInCss}</style>
      <button type="button" onClick={() => onBack(email.trim())}
        className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-800 transition-colors mb-4">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to sign in
      </button>

      <div className="flex flex-col items-center text-center mb-5">
        <span className="w-14 h-14 rounded-full flex items-center justify-center mb-3"
          style={step === 'done' ? { background: '#dcfce7', color: '#15803d' } : { background: '#eff6ff', color: '#2563eb' }}>
          <StepIcon className="w-7 h-7" />
        </span>
        <h2 ref={headingRef} tabIndex={-1} className="text-xl font-extrabold outline-none" style={{ color: '#0b2f66' }}>
          {step === 'done' ? 'Password changed' : step === 'code' ? 'Check your email' : 'Reset your password'}
        </h2>
        <p className="text-sm text-gray-600 mt-1.5">
          {step === 'email' && 'Type the email of your account. We will send you a 6-digit code.'}
          {step === 'code' && (
            <>If <strong className="text-gray-800 break-all">{email.trim()}</strong> belongs to an active account, we sent a 6-digit code to it. It works for 10 minutes.</>
          )}
          {step === 'done' && 'You can now sign in with your new password. You were signed out on your other phones and computers.'}
        </p>
      </div>

      {step === 'email' && (
        <form onSubmit={sendCode} className="space-y-4" noValidate>
          <div>
            <label htmlFor="fp-email" className={LABEL}>Email Address</label>
            <div className="relative">
              <MailIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input id="fp-email" ref={emailRef} type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com" autoComplete="email" className={INPUT} />
            </div>
          </div>
          {error && <p role="alert" className="text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={busy}
            className="si-btn w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center disabled:opacity-70">
            {busy ? 'Sending the code...' : 'Send code'}
          </button>
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={changePassword} className="space-y-4" noValidate>
          {/* min-w-0: a fieldset is otherwise never narrower than its six boxes */}
          <fieldset className="min-w-0">
            <legend className={LABEL}>6-digit code</legend>
            <div className="flex justify-center gap-1.5">
              {digits.map((digit, i) => (
                <input key={i} ref={el => { boxes.current[i] = el; }} value={digit}
                  onChange={e => fill(i, e.target.value)} onKeyDown={e => onCodeKey(i, e)} onFocus={e => e.target.select()}
                  inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'} maxLength={CODE_LENGTH}
                  aria-label={`Digit ${i + 1} of ${CODE_LENGTH}`} disabled={busy || needsNewCode} className="fp-code" />
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="fp-new" className={LABEL}>New password</label>
            <div className="relative">
              <LockIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input id="fp-new" ref={passwordRef} type={show ? 'text' : 'password'} value={password}
                onChange={e => setPassword(e.target.value)} autoComplete="new-password" className={INPUT} />
            </div>
          </div>
          <div>
            <label htmlFor="fp-confirm" className={LABEL}>Type the new password again</label>
            <div className="relative">
              <LockIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input id="fp-confirm" type={show ? 'text' : 'password'} value={confirm}
                onChange={e => setConfirm(e.target.value)} autoComplete="new-password" className={INPUT} />
            </div>
            <p className={`text-xs mt-1.5 ${mismatch ? 'text-red-700 font-semibold' : 'text-gray-600'}`}>
              {mismatch ? "The passwords don't match yet." : `At least ${MIN_PASSWORD} characters.`}
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
            <input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} className="w-4 h-4 rounded accent-blue-600" />
            Show passwords
          </label>

          {notice && <p role="status" className="text-sm font-medium text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{notice}</p>}
          {error && <p role="alert" className="text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <button type="submit" disabled={busy || needsNewCode}
            className="si-btn w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center disabled:opacity-60">
            {busy ? 'Changing the password...' : 'Change password'}
          </button>

          <p className="text-xs text-gray-600 text-center">
            Didn't get it? Check your Spam folder, or{' '}
            {wait > 0
              ? <span className="font-semibold tabular-nums">send a new code in {wait}s</span>
              : (
                <button type="button" onClick={sendCode} disabled={busy} className="font-semibold underline" style={{ color: '#1d4ed8' }}>
                  send a new code
                </button>
              )}
          </p>
          <button type="button" onClick={() => { setStep('email'); setError(''); setNotice(''); }}
            className="block mx-auto text-xs font-semibold text-gray-600 hover:text-gray-800 transition-colors">
            Use a different email
          </button>
        </form>
      )}

      {step === 'done' && (
        <button type="button" onClick={() => onBack(email.trim())}
          className="si-btn w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center">
          Back to sign in
        </button>
      )}
    </div>
  );
}
