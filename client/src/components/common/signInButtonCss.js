// Animated submit button shared by the sign-in and staff sign-up pages:
// the label slides to a spinner while working, then to a checkmark on success,
// and the button shakes on an error. Markup lives in each page.
export const signInCss = `
.si-btn {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background: linear-gradient(135deg,#2563eb,#3b82f6);
  box-shadow: 0 6px 20px rgba(37,99,235,0.35);
  transition: transform .2s ease, box-shadow .3s ease;
}
.si-btn:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 10px 28px rgba(37,99,235,0.45); }
.si-btn:not(:disabled):active { transform: translateY(0) scale(0.98); }
.si-btn:not(:disabled):hover .si-arrow { transform: translateX(3px); }
.si-arrow { transition: transform .2s ease; }

/* Background layers: green fill that fades in on success, and the shine sweep */
.si-success-bg, .si-core {
  position: absolute; inset: 0; border-radius: inherit; z-index: -1;
}
.si-success-bg {
  background: linear-gradient(135deg,#16a34a,#22c55e);
  opacity: 0; transition: opacity .35s ease;
}
.si-core { overflow: hidden; }
.si-core::after {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.28) 50%, transparent 75%);
  transform: translateX(-100%); opacity: 0;
}

/* Three stacked labels (idle / spinner / checkmark) that slide vertically */
.si-labels { display: grid; place-items: center; height: 20px; overflow: hidden; }
.si-label {
  grid-area: 1 / 1; display: inline-flex; align-items: center; gap: .5rem;
  transition: transform .4s cubic-bezier(.2,.8,.2,1), opacity .3s ease;
}
.si-label-loading, .si-label-success { transform: translateY(120%); opacity: 0; }
.si-spinner { width: 20px; height: 20px; }
.si-spinner-arc { stroke-dasharray: 1, 150; stroke-dashoffset: 0; }
.si-check { stroke-dasharray: 1; stroke-dashoffset: 1; }

/* Loading */
.si-btn.is-loading { cursor: progress; }
.si-btn.is-loading .si-core::after { opacity: 1; animation: si-sweep 1.4s ease-in-out infinite; }
.si-btn.is-loading .si-label-idle { transform: translateY(-120%); opacity: 0; }
.si-btn.is-loading .si-label-loading { transform: translateY(0); opacity: 1; }
/* Spinner keeps turning during success so it slides out smoothly instead of snapping. */
.si-btn:is(.is-loading, .is-success) .si-spinner { animation: si-rotate .9s linear infinite; }
.si-btn:is(.is-loading, .is-success) .si-spinner-arc { animation: si-dash 1.4s ease-in-out infinite; }

/* Success: turn green, spinner slides up, checkmark draws itself in */
.si-btn.is-success { cursor: default; box-shadow: 0 6px 20px rgba(22,163,74,0.4); }
.si-btn.is-success .si-success-bg { opacity: 1; }
.si-btn.is-success .si-label-idle,
.si-btn.is-success .si-label-loading { transform: translateY(-120%); opacity: 0; }
.si-btn.is-success .si-label-success { transform: translateY(0); opacity: 1; }
.si-btn.is-success .si-check-icon { animation: si-pop .35s .1s cubic-bezier(.2,.8,.2,1.4) both; }
.si-btn.is-success .si-check { animation: si-draw .4s .15s ease-out forwards; }

/* Error: short horizontal shake */
.si-btn.is-error { animation: si-shake .45s cubic-bezier(.36,.07,.19,.97); }

@keyframes si-sweep { 0% { transform: translateX(-100%); } 60%, 100% { transform: translateX(100%); } }
@keyframes si-rotate { to { transform: rotate(360deg); } }
@keyframes si-dash {
  0%   { stroke-dasharray: 1, 150;  stroke-dashoffset: 0; }
  50%  { stroke-dasharray: 90, 150; stroke-dashoffset: -35; }
  100% { stroke-dasharray: 90, 150; stroke-dashoffset: -124; }
}
@keyframes si-draw { to { stroke-dashoffset: 0; } }
@keyframes si-pop { from { transform: scale(.6); } to { transform: scale(1); } }
@keyframes si-shake {
  10%, 90% { transform: translateX(-1px); }
  20%, 80% { transform: translateX(2px); }
  30%, 50%, 70% { transform: translateX(-5px); }
  40%, 60% { transform: translateX(5px); }
}
/* Reduced motion: keep a plain rotating arc (it signals "working"), show the
   checkmark without drawing it, and skip the sweep and shake. */
@media (prefers-reduced-motion: reduce) {
  .si-btn.is-loading .si-core::after, .si-btn.is-error,
  .si-btn:is(.is-loading, .is-success) .si-spinner-arc,
  .si-btn.is-success .si-check-icon, .si-btn.is-success .si-check { animation: none; }
  .si-spinner-arc { stroke-dasharray: 60, 150; }
  .si-btn:is(.is-loading, .is-success) .si-spinner { animation-duration: 1.6s; }
  .si-btn.is-success .si-check { stroke-dashoffset: 0; }
}
`;
