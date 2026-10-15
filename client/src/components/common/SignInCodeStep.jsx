import React, { useEffect, useRef, useState } from 'react';
import api from '../../utils/api';
import { deviceId } from '../../utils/deviceId';
import { signInCss } from './signInButtonCss';

const CODE_LENGTH = 6;

// The code boxes shrink to fit narrow phones (the sign-in card has wide padding).
const css = `
.sc-code {
  flex: 1 1 0; min-width: 0; max-width: 2.875rem; height: 3rem;
  text-align: center; font-size: 1.375rem; font-weight: 700;
  border-radius: .75rem; outline: none; border: 1px solid #d1d5db; background: #f9fafb; color: #111827;
  transition: border-color .2s ease, background-color .2s ease, box-shadow .2s ease;
}
.sc-code:focus { background: #fff; border-color: #60a5fa; box-shadow: 0 0 0 3px rgba(37,99,235,.15); }
.sc-code:disabled { opacity: .6; }
`;
const LABEL = 'block text-xs font-bold text-gray-600 mb-1.5';

const ShieldIcon = props => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />
  </svg>
);

// The second step of an administrator's sign-in when sign-in codes are on
// (Settings > Security): the 6-digit code emailed after the right password.
// `start` is the server's answer to the password ({ ticket, email,
// expiresInMinutes, resendAfterSeconds, alreadySent }). onSignedIn({ token, user })
// finishes; onBack() returns to the password form.
export default function SignInCodeStep({ start, adminPath, onSignedIn, onBack }) {
  const [digits, setDigits] = useState(() => Array(CODE_LENGTH).fill(''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(start.alreadySent ? 'We sent you a code less than a minute ago. Use the code in that email.' : '');
  const [ended, setEnded] = useState(false);      // the sign-in must start again (password)
  const [expired, setExpired] = useState(false);  // this code expired: send a new one
  const [wait, setWait] = useState(start.alreadySent ? 0 : start.resendAfterSeconds ?? 60);
  const boxes = useRef([]);
  const headingRef = useRef(null);

  useEffect(() => { boxes.current[0]?.focus(); }, []);

  // Countdown until another code may be sent.
  useEffect(() => {
    if (wait <= 0) return undefined;
    const timer = setTimeout(() => setWait(w => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  const request = extra => ({ ticket: start.ticket, portal: 'ADMIN', adminPath, device: deviceId(), ...extra });
  const clearCode = () => setDigits(Array(CODE_LENGTH).fill(''));

  async function verify(current = digits) {
    const code = current.join('');
    if (code.length < CODE_LENGTH) {
      setError('Please type the 6-digit code from the email.');
      boxes.current[Math.max(0, current.findIndex(d => !d))]?.focus();
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data } = await api.post('/auth/login/code', request({ code }));
      onSignedIn(data); // stays busy while the dashboard opens
    } catch (err) {
      const data = err.response?.data || {};
      setError(data.error || err.message || 'Could not check the code. Please try again.');
      clearCode();
      if (data.codeError === 'restart') { setEnded(true); setTimeout(() => headingRef.current?.focus(), 0); }
      else if (data.codeError === 'expired') { setExpired(true); setWait(0); }
      else setTimeout(() => boxes.current[0]?.focus(), 0);
      setBusy(false);
    }
  }

  // Typing or pasting several digits fills the next boxes too; a full code is checked.
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
    if (next.every(Boolean)) verify(next);
    else boxes.current[Math.min(index + typed.length, CODE_LENGTH - 1)]?.focus();
  }

  function onCodeKey(index, e) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) boxes.current[index - 1]?.focus();
    else if (e.key === 'ArrowLeft' && index > 0) boxes.current[index - 1]?.focus();
    else if (e.key === 'ArrowRight' && index < CODE_LENGTH - 1) boxes.current[index + 1]?.focus();
  }

  async function resend() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data } = await api.post('/auth/login/code/resend', request());
      setWait(data.resendAfterSeconds ?? 60);
      setExpired(false);
      clearCode();
      setNotice('We sent a new code. Use the code in the newest email.');
      setTimeout(() => boxes.current[0]?.focus(), 0);
    } catch (err) {
      const data = err.response?.data || {};
      if (data.retryAfter) setWait(data.retryAfter);
      if (data.codeError === 'restart') setEnded(true);
      setError(data.error || err.message || 'Could not send a new code. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <style>{css + signInCss}</style>
      <button type="button" onClick={onBack}
        className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-800 transition-colors mb-4">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to sign in
      </button>

      <div className="flex flex-col items-center text-center mb-5">
        <span className="w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ background: '#eff6ff', color: '#2563eb' }}>
          <ShieldIcon className="w-7 h-7" />
        </span>
        <h2 ref={headingRef} tabIndex={-1} className="text-xl font-extrabold outline-none" style={{ color: '#0b2f66' }}>
          {ended ? 'Please sign in again' : 'Check your email'}
        </h2>
        <p className="text-sm text-gray-600 mt-1.5">
          {ended
            ? 'For your safety, this sign-in was stopped. Enter your password again to get a new code.'
            : <>Your password is right. To finish signing in, type the 6-digit code we sent to <strong className="text-gray-800 break-all">{start.email}</strong>. It works for {start.expiresInMinutes || 10} minutes.</>}
        </p>
      </div>

      <form onSubmit={e => { e.preventDefault(); if (ended) onBack(); else verify(); }} className="space-y-4" noValidate>
        {!ended && (
          // min-w-0: a fieldset is otherwise never narrower than its six boxes
          <fieldset className="min-w-0">
            <legend className={LABEL}>6-digit code</legend>
            <div className="flex justify-center gap-1.5">
              {digits.map((digit, i) => (
                <input key={i} ref={el => { boxes.current[i] = el; }} value={digit}
                  onChange={e => fill(i, e.target.value)} onKeyDown={e => onCodeKey(i, e)} onFocus={e => e.target.select()}
                  inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'} maxLength={CODE_LENGTH}
                  aria-label={`Digit ${i + 1} of ${CODE_LENGTH}`} disabled={busy || expired} className="sc-code" />
              ))}
            </div>
          </fieldset>
        )}

        {notice && <p role="status" className="text-sm font-medium text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{notice}</p>}
        {error && <p role="alert" className="text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

        <button type="submit" disabled={busy || (expired && !ended)}
          className="si-btn w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center disabled:opacity-60">
          {ended ? 'Sign in again' : busy ? 'Checking...' : 'Verify and sign in'}
        </button>

        {!ended && (
          <p className="text-xs text-gray-600 text-center">
            Didn't get it? Check your Spam folder, or{' '}
            {wait > 0
              ? <span className="font-semibold tabular-nums">send a new code in {wait}s</span>
              : (
                <button type="button" onClick={resend} disabled={busy} className="font-semibold underline" style={{ color: '#1d4ed8' }}>
                  send a new code
                </button>
              )}
          </p>
        )}
      </form>
    </div>
  );
}
