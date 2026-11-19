import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useOutletContext } from 'react-router-dom';
import toast from 'react-hot-toast';
import { TypeBadge, PriorityBadge, StatusBadge, ChannelBadge } from '../../components/common/StatusBadge';
import Icon from '../../components/common/Icons';
import { CHANNEL_LABELS, typedIn } from '../../data/channels';
import { SkeletonTable, Skel, useSkeletonGate } from '../../components/common/Skeleton';
import DeadlineBadge, { formatDueDate } from '../../components/common/DeadlineBadge';
import { OverallAnswer, LowPartActions } from '../../components/common/CsmAnswers';
import FilledForm from '../../components/staff/FilledForm';
import RemarkRule, { RemarkBadge } from '../../components/common/RemarkRule';
import PhotoViewer from '../../components/common/PhotoViewer';
import { useTheme } from '../../context/ThemeContext';
import { mediaUrl } from '../../utils/mediaUrl';
import { shrinkPhoto } from '../../utils/shrinkPhoto';
import { formatDate, formatDateTime, plural } from '../../utils/format';
import { PRIORITY_ORDER, PRIORITY_LABEL, URGENCY_REASON_LABEL, urgencyWords, quoteWords } from '../../data/urgency';
import api from '../../utils/api';

const STEPS = [
  { key: 'PENDING',     label: 'Pending',     hint: 'Not started yet' },
  { key: 'REVIEWING',   label: 'Reviewing',   hint: 'Checking the report' },
  { key: 'IN_PROGRESS', label: 'In Progress', hint: 'Work has started' },
  { key: 'RESOLVED',    label: 'Resolved',    hint: 'Fixed or answered' },
];
const STEP_INDEX = Object.fromEntries(STEPS.map((s, i) => [s.key, i]));
const STATUS_LABEL = { ...Object.fromEntries(STEPS.map(s => [s.key, s.label])), SPAM: 'Spam / Invalid' };
const STATUS_DOT = { PENDING: '#6B7280', REVIEWING: '#1D4ED8', IN_PROGRESS: '#a16207', RESOLVED: '#15803d', SPAM: '#475569' }; // white text on each ≥ 4.5:1
// Ready-made reasons for marking a report as spam or invalid.
const SPAM_REASONS = ['A test or joke message', 'An advertisement or scam', 'Not about Cantilan', 'The same report sent many times'];
const TYPE_LABEL = { COMPLAINT: 'Complaint', SUGGESTION: 'Suggestion', FEEDBACK: 'Feedback' };

// Ready-made notes for each step. Staff can change them before saving.
const QUICK_REPLIES = {
  PENDING:     ['We need more details before we can continue.'],
  REVIEWING:   ['We received your report and are checking it now.', 'We will visit the place to see the problem.'],
  IN_PROGRESS: ['Our team is working on this now.', 'The work is scheduled. We will update you when it is done.'],
  RESOLVED:    ['This has been fixed. Thank you for reporting it.', 'We have acted on your concern. Thank you for your feedback.'],
};

// Photos of the work: moving a report forward to In Progress or Resolved needs at
// least one (the server checks too, see controllers/staff.js); going back doesn't.
// At the same step, staff can post progress photos.
const PROOF_STEPS = ['IN_PROGRESS', 'RESOLVED'];
const PHOTO_HINT = {
  PENDING:     'You can add photos if they help.',
  REVIEWING:   'For example, a photo taken while checking the place.',
  IN_PROGRESS: 'A photo that shows the work has started.',
  RESOLVED:    'A photo of the finished work, or of the reply that was sent.',
};
const PHOTO_NEEDED = {
  IN_PROGRESS: 'Add at least one photo that shows the work has started.',
  RESOLVED:    'Add at least one photo that shows the finished work (or the reply that was sent).',
};
const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

// How urgent a report is: the dot in the history, and the reason the citizen sees
// when the office changes it (the server asks for at least 10 characters).
const URGENCY_DOT = { URGENT: '#b91c1c', STANDARD: '#1D4ED8', LOW: '#475569' };
const URGENCY_REASON_MIN = 10;

const CameraIcon = props => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" />
  </svg>
);

// The photos chosen for the next update, with a button that opens the camera or
// the gallery on phones (and a file picker on computers).
function ProofPhotoPicker({ photos, required, hint, error, adding, onPick, onRemove, inputRef, buttonRef }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-gray-800">
          Photos of the work{' '}
          {required ? <span className="text-red-700">(required)</span> : <span className="font-normal text-gray-600">(optional)</span>}
        </p>
        <span className="text-xs text-gray-600 tabular-nums">{photos.length} / {MAX_PHOTOS}</span>
      </div>
      <p className="text-xs text-gray-600 mt-0.5">{hint}</p>
      <div className="mt-2 grid grid-cols-3 sm:grid-cols-5 gap-2">
        {photos.map((p, i) => (
          <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
            <img src={p.url} alt={`Photo ${i + 1} to attach`} className="w-full h-full object-cover" />
            <button type="button" onClick={() => onRemove(p.id)} aria-label={`Remove photo ${i + 1}`}
              className="absolute top-1 right-1 w-7 h-7 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition-colors"
              style={{ background: 'rgba(0,0,0,0.6)' }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        ))}
        {photos.length < MAX_PHOTOS && (
          <button ref={buttonRef} type="button" onClick={() => inputRef.current?.click()} disabled={adding}
            className="aspect-square rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 text-blue-800 flex flex-col items-center justify-center gap-1 px-1 text-xs font-semibold text-center hover:bg-blue-100 disabled:opacity-60 transition-colors">
            <CameraIcon className="w-6 h-6" />
            {adding ? 'Adding...' : photos.length ? 'Add more' : 'Take or choose photos'}
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png" multiple className="hidden" onChange={onPick}
        aria-label="Photos of the work" />
      <p aria-live="polite" className={error ? 'mt-2 text-sm font-medium text-red-700' : 'sr-only'}>{error}</p>
    </div>
  );
}

// Thumbnails of the photos saved with one update; a tap opens them full size.
function SavedProofPhotos({ photos, onOpen }) {
  if (!photos?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {photos.map((p, i) => (
        <button key={p.id} type="button" onClick={() => onOpen(i)} aria-label={`Open photo ${i + 1} of ${photos.length}`}
          className="ss-photo w-16 h-16 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
          <img src={mediaUrl(p.filePath)} alt="" className="w-full h-full object-cover" />
        </button>
      ))}
    </div>
  );
}

// "set it to In Progress", or "added progress photos" when the step didn't change.
// Logs are newest first, so logs[i + 1] is the one before.
const updateVerb = (logs, i) => (i < logs.length - 1 && logs[i + 1].status === logs[i].status
  ? <>added progress photos</>
  : <>set it to <span className="font-semibold">{STATUS_LABEL[logs[i].status]}</span></>);

const TABS = [
  { key: '',            label: 'All',         count: c => c.total },
  { key: 'PENDING',     label: 'Pending',     count: c => c.pending },
  { key: 'REVIEWING',   label: 'Reviewing',   count: c => c.reviewing },
  { key: 'IN_PROGRESS', label: 'In Progress', count: c => c.inProgress },
  { key: 'OVERDUE',     label: 'Overdue',     count: c => c.overdue, alert: true },
  { key: 'RESOLVED',    label: 'Resolved',    count: c => c.resolved },
  { key: 'UNASSIGNED',  label: 'No office yet', count: c => c.unassigned, alert: true, receivingOnly: true },
  { key: 'SPAM',        label: 'Spam',        count: c => c.spam },
];
const SORTS = [
  { key: '',         label: 'Newest first' },
  { key: 'due',      label: 'Deadline first' },
  { key: 'priority', label: 'Urgent first' },
];
const PAGE_SIZE = 15;
const SECTION = 'text-xs font-bold text-gray-500 uppercase tracking-wide mb-2';

const pageCss = `
@keyframes ssOverlayIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes ssCardIn { 0% { opacity: 0; transform: translateY(16px) scale(0.96); } 60% { opacity: 1; transform: translateY(-2px) scale(1.005); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes ssLbIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
@keyframes ssNewRow { from { background-color: rgba(37,99,235,0.18); } to { background-color: transparent; } }
.ss-overlay { animation: ssOverlayIn .2s ease both; }
.ss-card { animation: ssCardIn .35s cubic-bezier(.22,1,.36,1) both; }
.ss-lb { animation: ssLbIn .25s cubic-bezier(.22,1,.36,1) both; }
.ss-photo { transition: transform .2s ease, box-shadow .2s ease; }
.ss-photo:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.15); }
.ss-new { animation: ssNewRow 4s ease-out both; }
@media (prefers-reduced-motion: reduce) {
  .ss-overlay, .ss-card, .ss-lb { animation: none; }
  .ss-new { animation: none; box-shadow: inset 4px 0 0 #2563eb; }
}
`;

function PhotoLightbox({ media, index, onClose, onNavigate }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onNavigate(1);
      if (e.key === 'ArrowLeft') onNavigate(-1);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, onNavigate]);

  const item = media[index];
  return (
    <div className="ss-overlay fixed inset-0 z-[60] flex items-center justify-center p-6"
      style={{ background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      onClick={e => { e.stopPropagation(); onClose(); }}>
      <button type="button" onClick={onClose} aria-label="Close"
        className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
      {media.length > 1 && (
        <>
          <button type="button" onClick={e => { e.stopPropagation(); onNavigate(-1); }} aria-label="Previous photo"
            className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 19l-7-7 7-7"/></svg>
          </button>
          <button type="button" onClick={e => { e.stopPropagation(); onNavigate(1); }} aria-label="Next photo"
            className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7"/></svg>
          </button>
        </>
      )}
      <img key={item.id} src={mediaUrl(item.filePath)} alt="Attached by the citizen"
        className="ss-lb max-w-full max-h-[80vh] rounded-xl shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
      {media.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold text-white" style={{ background: 'rgba(255,255,255,0.15)' }}>
          {index + 1} / {media.length}
        </div>
      )}
    </div>
  );
}

// One report. The window opens on the form the citizen filled in (components/staff/
// FilledForm.jsx) and shows only the form (the user, Nov 18, 2026: "make it whole form
// showing"). The button at the top ("Update the status") turns it to its second page:
// how urgent, the status steps with the photos of the work, the history, moving the
// report and marking it as spam. "Back to the citizen's form" turns it back.
function ReportWindow({ id, departments, onClose, onUpdated, onMoved }) {
  const { dark } = useTheme();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [nextStatus, setNextStatus] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTo, setMoveTo] = useState('');
  const [moveReason, setMoveReason] = useState('');
  const [moving, setMoving] = useState(false);
  const [spamOpen, setSpamOpen] = useState(false);
  const [spamReason, setSpamReason] = useState('');
  const [markingSpam, setMarkingSpam] = useState(false);
  const [photos, setPhotos] = useState([]);              // { id, file, url } for the next update
  const [photoError, setPhotoError] = useState('');
  const [addingPhotos, setAddingPhotos] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false); // progress photos at the same step
  const [viewer, setViewer] = useState(null);            // { photos, index, caption }: saved proof photos
  const [urgencyOpen, setUrgencyOpen] = useState(false);  // changing how urgent it is
  const [urgencyTo, setUrgencyTo] = useState('');
  const [urgencyWhy, setUrgencyWhy] = useState('');
  const [savingUrgency, setSavingUrgency] = useState(false);
  const photoInputRef = useRef(null);
  const photoButtonRef = useRef(null);
  // The window's two pages: 'form' (what it opens on) and 'work' (the status steps,
  // photos, history and the rest).
  const [view, setView] = useState('form');
  const boxRef = useRef(null);         // the layer the window sits on (it scrolls)
  const pageButtonRef = useRef(null);  // the button at the top that turns the page
  const turnedRef = useRef(false);     // the page was turned (not just opened)
  const photosRef = useRef(photos);
  photosRef.current = photos;

  useEffect(() => {
    api.get(`/staff/portal/submission/${id}`)
      .then(r => { setDetail(r.data); setNextStatus(r.data.status); })
      .catch(err => setLoadError(err.response?.data?.error || 'Could not load this report.'))
      .finally(() => setLoading(false));
  }, [id]);

  // The chosen photos' previews are freed when the window closes.
  useEffect(() => () => photosRef.current.forEach(p => URL.revokeObjectURL(p.url)), []);

  // Escape closes the window (the photo viewers handle their own Escape first).
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape' && lightboxIndex === null && !viewer) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, lightboxIndex, viewer]);

  // Large phone photos are made smaller first (faster on mobile data).
  async function pickPhotos(e) {
    const chosen = [...(e.target.files || [])];
    e.target.value = '';
    if (!chosen.length) return;
    const room = MAX_PHOTOS - photos.length;
    let problem = chosen.length > room ? `You can add up to ${MAX_PHOTOS} photos to one update.` : '';
    setAddingPhotos(true);
    const added = [];
    for (const file of chosen.slice(0, Math.max(0, room))) {
      if (!['image/jpeg', 'image/png'].includes(file.type)) { problem = 'Only JPG and PNG photos can be added.'; continue; }
      try {
        const small = await shrinkPhoto(file);
        if (small.size > MAX_PHOTO_BYTES) { problem = 'Each photo must be 5 MB or smaller.'; continue; }
        added.push({ id: `${Date.now()}-${added.length}-${Math.random().toString(36).slice(2)}`, file: small, url: URL.createObjectURL(small) });
      } catch {
        problem = 'A photo could not be opened. Please choose another.';
      }
    }
    setPhotos(prev => [...prev, ...added]);
    setPhotoError(problem);
    setAddingPhotos(false);
  }

  function removePhoto(photoId) {
    setPhotos(prev => {
      const gone = prev.find(p => p.id === photoId);
      if (gone) URL.revokeObjectURL(gone.url);
      return prev.filter(p => p.id !== photoId);
    });
    setPhotoError('');
  }

  function clearPhotos() {
    photos.forEach(p => URL.revokeObjectURL(p.url));
    setPhotos([]);
    setPhotoError('');
  }

  function addReply(text) {
    setNote(prev => {
      const current = prev.trim();
      if (!current) return text;
      return current.includes(text) ? current : `${current} ${text}`;
    });
  }

  // Saves the chosen step (or, with progressOpen, progress photos at the same step).
  // With photos it is sent as a form; the server keeps them with this update.
  async function saveStatus() {
    if (!detail) return;
    const progress = progressOpen && nextStatus === detail.status;
    if (!progress && nextStatus === detail.status) return;
    const status = progress ? detail.status : nextStatus;
    const needsPhoto = progress || (STEP_INDEX[status] > STEP_INDEX[detail.status] && PROOF_STEPS.includes(status));
    if (needsPhoto && !photos.length) {
      setPhotoError(progress ? 'Add at least one photo to post a progress update.' : PHOTO_NEEDED[status]);
      photoButtonRef.current?.focus();
      return;
    }
    setSaving(true);
    try {
      let body = { status, note: note.trim() || undefined };
      if (photos.length) {
        body = new FormData();
        body.append('status', status);
        if (note.trim()) body.append('note', note.trim());
        photos.forEach(p => body.append('photos', p.file, p.file.name));
      }
      const res = await api.patch(`/staff/portal/submission/${detail.id}`, body);
      setDetail(res.data);
      setNextStatus(res.data.status);
      setNote('');
      clearPhotos();
      setProgressOpen(false);
      onUpdated(res.data);
      toast.success(progress
        ? 'Progress photos posted. The administrators can see them in this report.'
        : `Saved as ${STATUS_LABEL[res.data.status]}. The citizen will see this update when they track the report.`);
    } catch (err) {
      const data = err.response?.data || {};
      if (['PROOF_NEEDED', 'BAD_PHOTO', 'LIMIT_FILE_SIZE', 'LIMIT_FILE_COUNT', 'TOO_LARGE'].includes(data.code)) setPhotoError(data.error);
      toast.error(data.error || err.message || 'Could not save the update');
    } finally {
      setSaving(false);
    }
  }

  function cancelUpdate() {
    setNextStatus(detail.status);
    setNote('');
    clearPhotos();
    setProgressOpen(false);
  }

  // How urgent it is (the AI set it for a complaint from its description). The server
  // counts the finish-by date again; the citizen sees the change and the reason.
  async function saveUrgency() {
    if (!urgencyTo || urgencyTo === detail.priority) return;
    if (urgencyWhy.trim().length < URGENCY_REASON_MIN) {
      toast.error('Please say why in a few words. The citizen will see your reason.');
      return;
    }
    setSavingUrgency(true);
    try {
      const res = await api.patch(`/staff/portal/urgency/${detail.id}`, { priority: urgencyTo, reason: urgencyWhy.trim() });
      setDetail(res.data);
      setUrgencyOpen(false);
      setUrgencyTo('');
      setUrgencyWhy('');
      onUpdated(res.data);
      toast.success(`Now ${PRIORITY_LABEL[res.data.priority]}${res.data.dueAt ? `, finish by ${formatDueDate(res.data.dueAt, true)}` : ''}. The citizen sees it when they track the report.`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not change the urgency');
    } finally {
      setSavingUrgency(false);
    }
  }

  // Spam / Invalid: the report leaves every list (except the Spam tab) and the
  // administrator may delete it. "Not spam" puts it back as Pending.
  async function setSpam(isSpam) {
    if (isSpam && !spamReason.trim()) return toast.error('Please say why this report is spam or invalid.');
    setMarkingSpam(true);
    try {
      await api.patch(`/staff/portal/submission/${detail.id}`, {
        status: isSpam ? 'SPAM' : 'PENDING',
        note: isSpam ? spamReason.trim() : 'Not spam — put back on the list.',
      });
      toast.success(isSpam
        ? 'Marked as spam / invalid. It left your lists; an administrator can delete it.'
        : 'Put back on your list as Pending.');
      onMoved(detail.id);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not save the change');
    } finally {
      setMarkingSpam(false);
    }
  }

  async function moveReport() {
    if (!moveTo || moveTo === detail.department) return;
    setMoving(true);
    try {
      await api.patch(`/staff/portal/assign/${detail.id}`, { department: moveTo, reason: moveReason.trim() || undefined });
      toast.success(`${noOffice ? 'Sent' : 'Moved'} to ${moveTo}`);
      onMoved(detail.id);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not move the report');
    } finally {
      setMoving(false);
    }
  }

  // Turns the window to the other page. It starts at the top, with the keyboard on the
  // button that turns it back (in the same place as the one just pressed).
  function showView(next) {
    turnedRef.current = true;
    setView(next);
  }
  useEffect(() => {
    if (!turnedRef.current) return;
    boxRef.current?.scrollTo({ top: 0 });
    pageButtonRef.current?.focus({ preventScroll: true });
  }, [view]);

  const currentIndex = detail ? STEP_INDEX[detail.status] : 0;
  const changing = detail && nextStatus !== detail.status;
  const noOffice = detail?.department === 'UNASSIGNED';
  // The button to the second page, named for what staff do there. The blue one is the
  // usual job (a complaint or suggestion to work on, or a report with no office yet).
  const workLabel = !detail ? ''
    : detail.status === 'SPAM' ? 'Spam: see why, or put it back'
    : noOffice ? 'Send to the right office'
    : detail.type !== 'FEEDBACK' ? 'Update the status'
    : detail.csm ? 'History, or mark as spam' : 'History, move, or mark as spam';
  const workMain = Boolean(detail) && detail.status !== 'SPAM' && (noOffice || detail.type !== 'FEEDBACK');

  // Moving the report to another office (for a report with no office: sending it to one).
  function moveForm({ heading, onCancel }) {
    return (
      <div className="rounded-2xl border border-amber-200 dark:border-amber-500/40 bg-amber-50 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">{heading}</h3>
          {onCancel && (
            <button type="button" onClick={onCancel} className="text-sm font-semibold text-amber-900 dark:text-amber-200 hover:underline">
              Cancel
            </button>
          )}
        </div>
        {noOffice && (
          <p className="text-sm text-amber-900 dark:text-amber-200">
            The citizen didn't choose an office and the system couldn't tell which one it is for. Read it, then send it to the right office.
          </p>
        )}
        <select value={moveTo} onChange={e => setMoveTo(e.target.value)} aria-label={noOffice ? 'Office to send the report to' : 'Office to move the report to'}
          className="w-full px-3 py-2.5 border border-amber-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400">
          <option value="">Choose an office...</option>
          {departments.filter(d => d !== detail.department).map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <input type="text" value={moveReason} onChange={e => setMoveReason(e.target.value)} maxLength={500}
          aria-label="Reason (optional)"
          placeholder={noOffice ? 'Note (optional), e.g. this is about road repair' : 'Reason (optional), e.g. this is about road repair'}
          className="w-full px-3 py-2.5 border border-amber-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400" />
        {moveTo && (
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {noOffice ? <>It will go to <strong>{moveTo}</strong>.</> : <>It will leave your list and go to <strong>{moveTo}</strong>.</>} The move is saved in the audit log.
          </p>
        )}
        <button type="button" onClick={moveReport} disabled={!moveTo || moving}
          className="w-full py-2.5 bg-amber-600 text-white rounded-xl text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {moving ? 'Sending...' : noOffice ? 'Send report' : 'Move report'}
        </button>
      </div>
    );
  }

  // The window is one long sheet, as tall as the form (the user's choice, Nov 18, 2026:
  // "Full-length window"). The layer it sits on scrolls (one scroll bar, no small scroll
  // box inside the window) and the header with "Update the status" stays at the top. The
  // dimmed background is a layer of its own: a blur on the scrolling layer would make the
  // photo viewers (outside it) scroll away with it.
  return (
    <>
    <div className="fixed inset-0 z-50" style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }} aria-hidden="true" />
    <div ref={boxRef} data-report-overlay className="fixed inset-0 z-50 overflow-y-auto overscroll-contain p-3 sm:p-6" onClick={onClose}>
      <div className="min-h-full flex justify-center">
      <div role="dialog" aria-modal="true" aria-labelledby="report-window-title"
        className="ss-card bg-white rounded-2xl shadow-2xl max-w-2xl w-full my-auto" onClick={e => e.stopPropagation()}>
        {loading ? (
          <div className="p-6">
            <Skel className="h-3 w-40 mb-2" />
            <Skel className="h-6 w-64 mb-6" />
            <Skel className="h-12 w-full mb-4" />
            <Skel className="h-24 w-full mb-4" />
            <Skel className="h-40 w-full" />
          </div>
        ) : !detail ? (
          <div className="py-20 px-6 text-center">
            <h2 id="report-window-title" className="font-semibold text-gray-800">{loadError}</h2>
            <button type="button" onClick={onClose} className="mt-4 px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50">Close</button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="sticky top-0 bg-white rounded-t-2xl border-b border-gray-100 px-5 sm:px-6 py-4 flex items-start justify-between gap-3 z-10">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className="font-mono text-xs font-semibold text-gray-600">{detail.trackingId}</span>
                  <TypeBadge type={detail.type} />
                  <ChannelBadge channel={detail.channel} />
                  {detail.priority !== 'STANDARD' && <PriorityBadge priority={detail.priority} />}
                  {/* Feedback has no deadline (the badge would only show a dash) */}
                  {detail.type !== 'FEEDBACK' && <DeadlineBadge submission={detail} />}
                </div>
                <h2 id="report-window-title" className="text-lg font-bold text-gray-900 line-clamp-2">
                  {TYPE_LABEL[detail.type] || 'Report'}{detail.csm?.service ? ` · ${detail.csm.service}` : detail.address ? ` · ${detail.address}` : ''}
                </h2>
                <p className="text-xs text-gray-600 mt-0.5">
                  Received {formatDate(detail.createdAt)}
                  {typedIn(detail) ? ` · ${CHANNEL_LABELS[detail.channel]}, typed in by ${detail.encodedByName || 'staff'}` : ''}
                  {detail.dueAt ? ` · Resolve by ${formatDueDate(detail.dueAt, true)}` : ''}
                </p>
                {/* The window shows only the form; this turns to the work on the report, and back */}
                {view === 'form' ? (
                  <button type="button" ref={pageButtonRef} onClick={() => showView('work')} data-view-work
                    className={`mt-2.5 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      workMain ? 'bg-blue-700 text-white hover:bg-blue-800' : 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50'}`}>
                    {workLabel}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </button>
                ) : (
                  <button type="button" ref={pageButtonRef} onClick={() => showView('form')} data-view-form
                    className="mt-2.5 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-800 hover:bg-gray-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Back to the citizen's form
                  </button>
                )}
              </div>
              <button type="button" onClick={onClose} aria-label="Close"
                className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors flex-shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-6">
              {/* Page 1: all of the citizen's form, their answers marked, and nothing else
                  (a walk-in report: the same form, parts 1 to 3 unanswered, since staff typed
                  it in). Since Nov 17, 2026 it shows no mobile number or email, not even the
                  ones older reports still have saved. */}
              {view === 'form' ? (
              <section data-view="form">
                <h3 className={SECTION}>The citizen's form</h3>
                <div className="space-y-4">
                  <FilledForm report={detail} answers={detail.csm || detail.formAnswers || null} onOpenPhoto={setLightboxIndex}>
                    {detail.type === 'FEEDBACK' && detail.remark && (
                      <div className="space-y-2" data-remark>
                        <RemarkBadge remark={detail.remark} />
                        <RemarkRule />
                      </div>
                    )}
                  </FilledForm>
                  {/* Feedback: what the office can do about the parts the client disagreed with */}
                  {detail.csm && <LowPartActions csm={detail.csm} />}
                </div>
              </section>
              ) : (<div data-view="work" className="space-y-6">
              {/* Page 2: the work on the report. No office yet: sending it on comes first. */}
              {noOffice && <section>{moveForm({ heading: 'Send to the right office' })}</section>}

              {/* Marked as spam: who, why, and the way back */}
              {detail.status === 'SPAM' && (() => {
                const spamLog = (detail.statusLogs || []).find(l => l.status === 'SPAM');
                return (
                  <section className="rounded-2xl border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800/60 p-4 sm:p-5">
                    <h3 className="text-base font-bold text-gray-900">Marked as spam / invalid</h3>
                    <p className="text-sm text-gray-700 mt-1">
                      {spamLog && <>By <strong>{spamLog.updatedByName}</strong> on {formatDateTime(spamLog.createdAt)}. </>}
                      It is left out of every list and count. An administrator can delete it for good.
                    </p>
                    {spamLog?.note && <p className="text-sm text-gray-800 mt-2 bg-white dark:bg-slate-900/50 rounded-lg px-3 py-2">“{spamLog.note}”</p>}
                    <button type="button" onClick={() => setSpam(false)} disabled={markingSpam}
                      className="mt-3 px-4 py-2.5 rounded-xl border border-gray-300 bg-white text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                      {markingSpam ? 'Saving...' : 'Not spam — put it back'}
                    </button>
                  </section>
                );
              })()}

              {/* How urgent: what the AI set (and why), the finish-by date, and changing it */}
              {detail.type !== 'FEEDBACK' && detail.status !== 'SPAM' && (() => {
                // The AI's level and the words behind it. Complaints sent before Oct 16,
                // 2026 show the citizen's own choice: before the first change, if any.
                const ai = detail.aiClassification;
                const words = urgencyWords(ai?.urgencyKeywords);
                const changes = detail.urgencyChanges || [];
                const chosen = changes.length ? changes[changes.length - 1].fromPriority : detail.priority;
                const why = URGENCY_REASON_LABEL[detail.urgencyReason];
                return (
                  <section className="rounded-2xl border border-gray-200 p-4 sm:p-5" aria-labelledby="urgency-title">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 id="urgency-title" className="text-base font-bold text-gray-900">How urgent</h3>
                      <PriorityBadge priority={detail.priority} />
                    </div>
                    <p className="text-sm text-gray-700 mt-1" data-urgency-source={detail.type === 'COMPLAINT' && ai?.predictedPriority ? 'ai' : 'other'}>
                      {detail.type !== 'COMPLAINT'
                        ? 'Suggestions start as Normal. '
                        : ai?.predictedPriority
                          ? <>Set automatically from the description: <strong>{PRIORITY_LABEL[ai.predictedPriority]}</strong>{words.length ? <>, because of {quoteWords(words)}</> : ''}. </>
                          : <>The citizen chose <strong>{PRIORITY_LABEL[chosen]}</strong>{why ? <>: “{why}”</> : ''}. </>}
                      {detail.dueAt && <>Finish by <strong>{formatDueDate(detail.dueAt, true)}</strong>.</>}
                    </p>
                    {detail.status === 'RESOLVED' ? (
                      <p className="text-sm text-gray-600 mt-2">This report is resolved, so its urgency stays as it is.</p>
                    ) : !urgencyOpen ? (
                      <button type="button" onClick={() => { setUrgencyOpen(true); setUrgencyTo(''); setUrgencyWhy(''); }}
                        className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-blue-700 hover:bg-blue-50 transition-colors">
                        Change urgency
                      </button>
                    ) : (
                      <div className="mt-3 space-y-3">
                        <p className="text-sm text-gray-700">
                          Choose the right urgency and say why. The finish-by date is counted again from the day the report was sent;
                          raising the urgency never gives more time. The citizen sees your reason, and the administrators see every change.
                        </p>
                        <div className="grid grid-cols-3 gap-2" role="group" aria-label="New urgency">
                          {PRIORITY_ORDER.map(key => (
                            <button key={key} type="button" aria-pressed={urgencyTo === key} disabled={key === detail.priority}
                              onClick={() => setUrgencyTo(key)}
                              className={`rounded-xl border-2 px-2 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                urgencyTo === key ? 'border-blue-600 bg-blue-50 text-gray-900' : 'border-gray-200 text-gray-800 hover:bg-gray-50'
                              }`}>
                              <span className="flex items-center justify-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: URGENCY_DOT[key] }} aria-hidden="true" />
                                {PRIORITY_LABEL[key]}
                              </span>
                              {key === detail.priority && <span className="block text-xs font-medium text-gray-600">Now</span>}
                            </button>
                          ))}
                        </div>
                        <textarea value={urgencyWhy} onChange={e => setUrgencyWhy(e.target.value)} rows={2} maxLength={500}
                          aria-label="Reason (the citizen sees it)"
                          placeholder="Reason (required, the citizen sees it), e.g. We checked the place: the leak is small and no one is in danger."
                          className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none" />
                        <div className="flex gap-2">
                          <button type="button" onClick={() => { setUrgencyOpen(false); setUrgencyTo(''); setUrgencyWhy(''); }} disabled={savingUrgency}
                            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                            Cancel
                          </button>
                          <button type="button" onClick={saveUrgency} disabled={!urgencyTo || savingUrgency}
                            className="flex-1 py-2.5 bg-blue-700 text-white text-sm font-semibold rounded-xl hover:bg-blue-800 disabled:opacity-50 transition-colors">
                            {savingUrgency ? 'Saving...' : urgencyTo ? `Save as ${PRIORITY_LABEL[urgencyTo]}` : 'Choose the new urgency'}
                          </button>
                        </div>
                      </div>
                    )}
                  </section>
                );
              })()}

              {/* Feedback: no status steps, deadline or urgency, only reading it */}
              {detail.type === 'FEEDBACK' && detail.status !== 'SPAM' && (
                <section className="rounded-2xl border border-green-200 dark:border-green-500/40 bg-green-50 p-4 sm:p-5">
                  <h3 className="text-base font-bold text-gray-900">Feedback for your office</h3>
                  <p className="text-sm text-gray-700 mt-1">
                    {detail.csm
                      ? 'A client answered the satisfaction form about your office\'s service. Feedback has no status steps or deadline: read it and use it to serve better.'
                      : 'A citizen rated your office\'s service. Feedback has no status steps or deadline: read it and use it to serve better. If it is meant for another office, move it below.'}
                  </p>
                </section>
              )}

              {/* Status steps */}
              {detail.status !== 'SPAM' && detail.type !== 'FEEDBACK' && <section data-status-steps className="rounded-2xl border border-gray-200 p-4 sm:p-5">
                <h3 className="text-base font-bold text-gray-900">Update the status</h3>
                <p className="text-sm text-gray-600 mt-0.5">Choose the step this report is at now.</p>
                <ol className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {STEPS.map((step, i) => {
                    const isCurrent = detail.status === step.key;
                    const isChosen = nextStatus === step.key;
                    const isDone = i < currentIndex;
                    const reached = isDone || isCurrent;
                    return (
                      <li key={step.key}>
                        <button type="button" onClick={() => setNextStatus(step.key)} aria-pressed={isChosen}
                          className={`w-full h-full text-left rounded-xl border-2 px-3 py-2.5 transition-colors ${
                            isChosen ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                          }`}>
                          <span className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                              style={reached
                                ? { background: STATUS_DOT[step.key], color: '#fff' }
                                : { background: dark ? '#334155' : '#e5e7eb', color: dark ? '#cbd5e1' : '#374151' }}>
                              {isDone
                                ? <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                                : i + 1}
                            </span>
                            <span className="text-sm font-semibold text-gray-800">{step.label}</span>
                          </span>
                          <span className={`block text-xs mt-1 ${isCurrent ? 'font-bold text-blue-700' : 'text-gray-600'}`}>
                            {isCurrent ? 'Now' : isDone ? 'Done' : step.hint}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>

                {changing || progressOpen ? (() => {
                  const progress = !changing;
                  const photoRequired = progress || (STEP_INDEX[nextStatus] > currentIndex && PROOF_STEPS.includes(nextStatus));
                  return (
                  <div className="mt-4 space-y-3">
                    {progress ? (
                      <p className="text-sm text-gray-700">
                        Post photos of the work so far. The report stays at <strong>{STATUS_LABEL[detail.status]}</strong>.
                        The administrators see the photos; the citizen sees only your note (optional).
                      </p>
                    ) : (
                      <>
                        <p className="text-sm text-gray-700">
                          Change from <strong>{STATUS_LABEL[detail.status]}</strong> to <strong>{STATUS_LABEL[nextStatus]}</strong>.
                          Add a note for the citizen (optional) — tap one to use it:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {QUICK_REPLIES[nextStatus].map(text => (
                            <button key={text} type="button" onClick={() => addReply(text)}
                              className="px-3 py-1.5 rounded-full border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 text-left transition-colors">
                              + {text}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} maxLength={1000}
                      aria-label="Note for the citizen"
                      placeholder={progress ? 'What was done so far (optional)' : 'Write a short note, or tap a ready-made one above'}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none" />
                    <ProofPhotoPicker photos={photos} required={photoRequired}
                      hint={progress ? 'Photos that show how the work is going.' : PHOTO_HINT[nextStatus]}
                      error={photoError} adding={addingPhotos} onPick={pickPhotos} onRemove={removePhoto}
                      inputRef={photoInputRef} buttonRef={photoButtonRef} />
                    <div className="flex gap-2">
                      <button type="button" onClick={cancelUpdate} disabled={saving}
                        className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                        Cancel
                      </button>
                      <button type="button" onClick={saveStatus} disabled={saving || addingPhotos}
                        className="flex-1 py-2.5 bg-blue-700 text-white text-sm font-semibold rounded-xl hover:bg-blue-800 disabled:opacity-50 transition-colors">
                        {saving ? (photos.length ? 'Uploading photos...' : 'Saving...') : progress ? 'Post progress photos' : `Save as ${STATUS_LABEL[nextStatus]}`}
                      </button>
                    </div>
                  </div>
                  );
                })() : (
                  <div className="mt-3">
                    <p className="text-sm text-gray-600">
                      {detail.status === 'RESOLVED'
                        ? 'This report is resolved. Choose another step only if more work is needed.'
                        : 'When the work moves forward, choose the next step.'}
                    </p>
                    {detail.status !== 'PENDING' && (
                      <button type="button" onClick={() => { setProgressOpen(true); setPhotoError(''); }}
                        className="mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-blue-700 hover:bg-blue-50 transition-colors">
                        <CameraIcon className="w-4 h-4" />
                        Add progress photos
                      </button>
                    )}
                  </div>
                )}
              </section>}

              {/* History */}
              <section>
                <h3 className={SECTION}>History</h3>
                <ol className="border-l-2 border-gray-200 ml-1.5 space-y-4">
                  {/* Status updates and urgency changes, newest first */}
                  {[
                    ...(detail.statusLogs || []).map((log, i) => ({ at: log.createdAt, log, i })),
                    ...(detail.urgencyChanges || []).map(change => ({ at: change.createdAt, change })),
                  ].sort((a, b) => new Date(b.at) - new Date(a.at)).map(({ log, i, change }) => (change ? (
                    <li key={`urgency-${change.id}`} className="relative pl-5">
                      <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full ring-2 ring-white dark:ring-slate-800" style={{ background: URGENCY_DOT[change.toPriority] }} aria-hidden="true" />
                      <p className="text-sm text-gray-800">
                        <span className="font-semibold">{change.changedByName}</span> changed the urgency from{' '}
                        <span className="font-semibold">{PRIORITY_LABEL[change.fromPriority]}</span> to <span className="font-semibold">{PRIORITY_LABEL[change.toPriority]}</span>
                      </p>
                      <p className="text-xs text-gray-600">
                        {formatDateTime(change.createdAt)}{change.toDueAt ? ` · Finish by ${formatDueDate(change.toDueAt, true)}` : ''}
                      </p>
                      <p className="text-sm text-gray-700 mt-1.5 bg-gray-50 rounded-lg px-3 py-2">“{change.reason}”</p>
                    </li>
                  ) : (
                    <li key={log.id} className="relative pl-5">
                      <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full ring-2 ring-white dark:ring-slate-800" style={{ background: STATUS_DOT[log.status] }} aria-hidden="true" />
                      <p className="text-sm text-gray-800">
                        <span className="font-semibold">{log.updatedByName}</span> {updateVerb(detail.statusLogs, i)}
                      </p>
                      <p className="text-xs text-gray-600">{formatDateTime(log.createdAt)}</p>
                      {log.note && <p className="text-sm text-gray-700 mt-1.5 bg-gray-50 rounded-lg px-3 py-2">“{log.note}”</p>}
                      <SavedProofPhotos photos={log.photos}
                        onOpen={index => setViewer({ photos: log.photos, index, caption: `${log.updatedByName} · ${formatDateTime(log.createdAt)}` })} />
                    </li>
                  )))}
                  <li className="relative pl-5">
                    <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full ring-2 ring-white dark:ring-slate-800 bg-gray-400" aria-hidden="true" />
                    <p className="text-sm text-gray-800">
                      {typedIn(detail)
                        ? <><span className="font-semibold">{detail.encodedByName || 'Staff'}</span> typed in the report ({CHANNEL_LABELS[detail.channel]})</>
                        : 'Report received'}
                    </p>
                    <p className="text-xs text-gray-600">{formatDateTime(detail.createdAt)}</p>
                  </li>
                </ol>
              </section>

              {/* Move to another office (not the answers to the satisfaction form: they
                  are about this office's own service) */}
              {!noOffice && !detail.csm && (
              <section>
                {!moveOpen ? (
                  <button type="button" onClick={() => setMoveOpen(true)}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300 hover:underline">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4M16 17H4m0 0l4 4m-4-4l4-4"/>
                    </svg>
                    Wrong office? Move this report
                  </button>
                ) : moveForm({ heading: 'Move to another office', onCancel: () => { setMoveOpen(false); setMoveTo(''); setMoveReason(''); } })}
              </section>
              )}

              {/* Not a real report: mark it as spam / invalid */}
              {detail.status !== 'SPAM' && (
              <section>
                {!spamOpen ? (
                  <button type="button" onClick={() => setSpamOpen(true)}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-red-700 hover:underline">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden="true">
                      <circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M5.6 5.6l12.8 12.8" />
                    </svg>
                    Not a real report? Mark as spam / invalid
                  </button>
                ) : (
                  <div className="rounded-2xl border border-red-200 dark:border-red-500/40 bg-red-50 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-bold text-red-700">Mark as spam / invalid</h3>
                      <button type="button" onClick={() => { setSpamOpen(false); setSpamReason(''); }}
                        className="text-sm font-semibold text-red-700 hover:underline">
                        Cancel
                      </button>
                    </div>
                    <p className="text-sm text-gray-700">
                      It leaves your lists and counts. The citizen gets no message, but sees “Closed as invalid” if they track it.
                      Your reason is for the municipality only; the citizen does not see it.
                      You can put it back from the Spam tab, and an administrator can delete it.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {SPAM_REASONS.map(r => (
                        <button key={r} type="button" onClick={() => setSpamReason(r)}
                          className="px-3 py-1.5 rounded-full border border-red-200 dark:border-red-500/40 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                          + {r}
                        </button>
                      ))}
                    </div>
                    <input type="text" value={spamReason} onChange={e => setSpamReason(e.target.value)} maxLength={500}
                      aria-label="Reason" placeholder="Reason (required), e.g. a test message"
                      className="w-full px-3 py-2.5 border border-red-200 dark:border-red-500/40 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-400" />
                    <button type="button" onClick={() => setSpam(true)} disabled={!spamReason.trim() || markingSpam}
                      className="w-full py-2.5 bg-red-700 text-white rounded-xl text-sm font-semibold hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                      {markingSpam ? 'Saving...' : 'Mark as spam / invalid'}
                    </button>
                  </div>
                )}
              </section>
              )}
              </div>)}
            </div>
          </>
        )}
      </div>
      </div>
    </div>

      {lightboxIndex !== null && detail?.media?.length > 0 && (
        <PhotoLightbox
          media={detail.media}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={delta => setLightboxIndex(i => (i + delta + detail.media.length) % detail.media.length)}
        />
      )}
      {viewer && (
        <PhotoViewer photos={viewer.photos} index={viewer.index} caption={viewer.caption} alt="Photo of the work"
          onIndex={index => setViewer(v => ({ ...v, index }))} onClose={() => setViewer(null)} />
      )}
    </>
  );
}

function citizenLine(s) {
  return s.type === 'FEEDBACK' ? 'Anonymous client' : s.user?.fullName || 'Anonymous';
}

// The line of text in the list: the report itself, or for feedback the client's
// suggestions (the service when none were written).
function reportLine(s) {
  if (s.description || !s.csm) return s.description;
  return `Satisfaction form${s.csm.service ? ` · ${s.csm.service}` : ''} (no suggestions written)`;
}

// Feedback has no status steps, so its row shows the citizen's rating instead.
function FeedbackStars({ rating }) {
  const n = Math.max(0, Math.min(5, Number(rating) || 0));
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span aria-hidden="true">
        <span style={{ color: '#f59e0b' }}>{'★'.repeat(n)}</span>
        <span className="text-gray-300">{'★'.repeat(5 - n)}</span>
      </span>
      <span className="text-xs font-semibold text-gray-700">Rated {n}/5</span>
    </span>
  );
}
// The status badge, or for feedback the overall answer (older feedback: its stars).
// A spam mark still shows as such.
const statusCell = s => (s.type === 'FEEDBACK' && s.status !== 'SPAM'
  ? (s.csm ? <OverallAnswer csm={s.csm} /> : <FeedbackStars rating={s.rating} />)
  : <StatusBadge status={s.status} />);

export default function StaffSubmissions() {
  const location = useLocation();
  const { openWalkIn } = useOutletContext() || {};
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [tab, setTab]                 = useState('');
  const [typeFilter, setTypeFilter]   = useState('');
  const [sortBy, setSortBy]           = useState('');
  // Search words can come from the search box in the top bar.
  const [searchDraft, setSearchDraft] = useState(() => location.state?.search || '');
  const [search, setSearch]           = useState(() => location.state?.search || '');
  const [page, setPage]               = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const [total, setTotal]             = useState(0);
  const [counts, setCounts]           = useState(null);
  const [department, setDepartment]   = useState('');
  const [departments, setDepartments] = useState([]);
  // Opened from the dashboard, the To-do list, a notification or an email's link (?open=).
  const [detailId, setDetailId]       = useState(() => location.state?.openId || new URLSearchParams(location.search).get('open') || null);
  const [freshIds, setFreshIds]       = useState(() => new Set());
  const known = useRef({ ids: null, at: 0 });
  const pageRef = useRef(1);
  const windowOpen = useRef(false);
  const gate = useSkeletonGate();
  pageRef.current = page;
  windowOpen.current = !!detailId;

  // Don't reopen the same report or repeat the search if the page is refreshed later.
  useEffect(() => {
    const passed = window.history.state?.usr;
    if (passed?.openId || passed?.search) window.history.replaceState({ ...window.history.state, usr: null }, '');
  }, []);
  // An email's link (?open=) stays in the address bar while its report is open (so
  // signing in again comes back to it), and leaves once the report is closed.
  useEffect(() => {
    if (!detailId && new URLSearchParams(window.location.search).has('open')) {
      window.history.replaceState(window.history.state, '', window.location.pathname);
    }
  }, [detailId]);

  useEffect(() => {
    api.get('/settings/public').then(r => setDepartments(r.data.departments || [])).catch(() => {});
  }, []);

  // Search runs on the server, a moment after typing stops.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchDraft.trim()), 350);
    return () => clearTimeout(t);
  }, [searchDraft]);

  // `quiet` refreshes keep the list on screen (no loading skeleton) and briefly
  // highlight reports that arrived since the last look.
  const fetchList = useCallback((p, { quiet = false } = {}) => {
    const params = new URLSearchParams({ page: p, limit: PAGE_SIZE });
    if (tab === 'OVERDUE') params.append('overdue', '1');
    else if (tab === 'UNASSIGNED') params.append('unassigned', '1');
    else if (tab) params.append('status', tab);
    if (typeFilter) params.append('type', typeFilter);
    if (sortBy) params.append('sortBy', sortBy);
    if (search) params.append('search', search);
    if (!quiet) setLoading(true);
    const request = Promise.all([
      api.get(`/staff/portal/submissions?${params}`),
      api.get(`/staff/portal/stats${typeFilter ? `?type=${typeFilter}` : ''}`),
    ]);
    return (quiet ? request : gate(request))
      .then(([list, stats]) => {
        const rows = list.data.submissions;
        if (quiet && known.current.ids) {
          const since = known.current.at - 60 * 1000;
          const fresh = rows.filter(r => !known.current.ids.has(r.id) && new Date(r.createdAt).getTime() > since).map(r => r.id);
          if (fresh.length) setFreshIds(new Set(fresh));
        }
        known.current = { ids: new Set(rows.map(r => r.id)), at: Date.now() };
        setSubmissions(rows);
        setTotal(list.data.total);
        setTotalPages(list.data.pages);
        setDepartment(list.data.department || '');
        setCounts(stats.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [tab, typeFilter, sortBy, search, gate]);

  useEffect(() => { setPage(1); fetchList(1); }, [fetchList]);

  // New reports appear on their own: a quiet refresh every 30 seconds while the
  // page is on screen and no report is open.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && !windowOpen.current) fetchList(pageRef.current, { quiet: true });
    }, 30000);
    return () => clearInterval(timer);
  }, [fetchList]);

  // A walk-in report just typed in shows at once (highlighted like other new reports).
  useEffect(() => {
    const refresh = () => fetchList(pageRef.current, { quiet: true });
    window.addEventListener('civix:report-added', refresh);
    return () => window.removeEventListener('civix:report-added', refresh);
  }, [fetchList]);

  useEffect(() => {
    if (!freshIds.size) return undefined;
    const t = setTimeout(() => setFreshIds(new Set()), 4500);
    return () => clearTimeout(t);
  }, [freshIds]);

  // The sidebar counts refresh when a report is updated or moved.
  const alertsChanged = () => window.dispatchEvent(new Event('civix:alerts-changed'));

  function handleUpdated(updated) {
    setSubmissions(prev => prev.map(s => (s.id === updated.id ? { ...s, ...updated } : s)));
    fetchList(page, { quiet: true });
    alertsChanged();
  }

  function handleMoved(id) {
    setSubmissions(prev => prev.filter(s => s.id !== id));
    fetchList(page, { quiet: true });
    alertsChanged();
  }

  function goToPage(p) {
    setPage(p);
    fetchList(p);
  }

  const closeWindow = useCallback(() => setDetailId(null), []);
  const filtering = !!(search || tab || typeFilter);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <style>{pageCss}</style>

      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">Our Reports</h1>
          <p className="text-sm text-gray-600 mt-1">
            Reports sent to <strong className="text-gray-800">{department || 'your office'}</strong>. Open one to read it and update its status.
          </p>
        </div>
        {/* Below 1024 px; wider, the top bar has the same button */}
        {openWalkIn && (
          <button type="button" onClick={openWalkIn}
            className="inline-flex lg:hidden items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
            <Icon name="write" className="w-4 h-4" /> Walk-in report
          </button>
        )}
      </div>

      {/* Status tabs with counts */}
      <div role="tablist" aria-label="Show reports by status" className="flex flex-wrap gap-2 mb-4">
        {TABS.filter(t => !t.receivingOnly || counts?.receivingOffice).map(t => {
          const active = tab === t.key;
          const n = counts ? t.count(counts) : null;
          return (
            <button key={t.key || 'ALL'} type="button" role="tab" aria-selected={active} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap border transition-colors ${
                active ? 'bg-blue-700 border-blue-700 text-white' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}>
              {t.label}
              {n !== null && (
                <span className={`min-w-[22px] px-1.5 py-0.5 rounded-full text-xs font-bold text-center ${
                  active ? '' : t.alert && n > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                }`} style={active ? { background: '#ffffff', color: '#1d4ed8' } : undefined}>
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Search, type and order */}
        <div className="px-4 sm:px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3">
          <label className="relative flex-1 min-w-0">
            <span className="sr-only">Search reports</span>
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="search" value={searchDraft} onChange={e => setSearchDraft(e.target.value)}
              placeholder="Search by ID, words, name or place"
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </label>
          <div className="flex gap-3">
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} aria-label="Type of report"
              className="flex-1 sm:flex-none min-w-0 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">All types</option>
              <option value="COMPLAINT">Complaints</option>
              <option value="SUGGESTION">Suggestions</option>
              <option value="FEEDBACK">Feedback</option>
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} aria-label="Order"
              className="flex-1 sm:flex-none min-w-0 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              {SORTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="overflow-x-auto"><SkeletonTable cols={5} rows={8} /></div>
        ) : submissions.length === 0 ? (
          <div className="py-14 px-6 text-center">
            <svg className="w-10 h-10 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/>
            </svg>
            <p className="font-semibold text-gray-800">{filtering ? 'No reports match' : 'No reports yet'}</p>
            <p className="text-sm text-gray-600 mt-1">
              {filtering ? 'Try another tab, or clear the search.' : 'Reports sent to your office will appear here.'}
            </p>
          </div>
        ) : (
          <>
            {/* Computer: a table, any part of a row opens the report */}
            <table className="hidden lg:table w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-600 uppercase">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold">Report</th>
                  <th className="px-4 py-3 text-left font-semibold">Citizen</th>
                  <th className="px-4 py-3 text-left font-semibold">Deadline</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Received</th>
                  <th className="w-10"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {submissions.map(s => (
                  <tr key={s.id} onClick={() => setDetailId(s.id)}
                    className={`cursor-pointer hover:bg-gray-50 transition-colors ${freshIds.has(s.id) ? 'ss-new' : ''}`}>
                    <td className="px-5 py-3.5 w-full max-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button type="button" onClick={e => { e.stopPropagation(); setDetailId(s.id); }}
                          aria-label={`Open report ${s.trackingId}`}
                          className="font-mono text-xs font-semibold text-gray-700 hover:text-blue-700 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                          {s.trackingId}
                        </button>
                        <TypeBadge type={s.type} />
                        <ChannelBadge channel={s.channel} />
                        {s.priority !== 'STANDARD' && <PriorityBadge priority={s.priority} />}
                        {s.department === 'UNASSIGNED' && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 dark:text-amber-200">No office yet</span>}
                        {freshIds.has(s.id) && <span className="text-xs font-bold text-blue-700">New</span>}
                      </div>
                      <p className="text-sm text-gray-800 mt-1 truncate">{reportLine(s)}</p>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <p className={`text-sm font-semibold ${s.user?.fullName ? 'text-gray-800' : 'text-gray-600 italic'}`}>{citizenLine(s)}</p>
                      {/* No mobile number or email since Nov 17, 2026 (not even older ones). */}
                      <p className="text-xs text-gray-600">{s.type === 'FEEDBACK' ? 'Not shown' : 'No contact'}</p>
                    </td>
                    <td className="px-4 py-3.5"><DeadlineBadge submission={s} showDate /></td>
                    <td className="px-4 py-3.5 whitespace-nowrap">{statusCell(s)}</td>
                    <td className="px-4 py-3.5 text-xs text-gray-600 whitespace-nowrap">{formatDate(s.createdAt)}</td>
                    <td className="pr-4 text-gray-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Phone and tablet: one card per report */}
            <ul className="lg:hidden divide-y divide-gray-100">
              {submissions.map(s => (
                <li key={s.id} className={freshIds.has(s.id) ? 'ss-new' : ''}>
                  <button type="button" onClick={() => setDetailId(s.id)} className="w-full text-left px-4 py-4 hover:bg-gray-50 transition-colors">
                    <span className="flex items-start justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-gray-700 pt-1">{s.trackingId}</span>
                      {statusCell(s)}
                    </span>
                    <span className="flex items-center gap-2 flex-wrap mt-2">
                      <TypeBadge type={s.type} />
                      <ChannelBadge channel={s.channel} />
                      {s.priority !== 'STANDARD' && <PriorityBadge priority={s.priority} />}
                      <DeadlineBadge submission={s} />
                    </span>
                    <span className="block text-[15px] text-gray-800 mt-2 line-clamp-2">{reportLine(s)}</span>
                    <span className="block text-xs text-gray-600 mt-1.5">{citizenLine(s)} · Received {formatDate(s.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>

            {/* Pages */}
            <div className="px-4 sm:px-5 py-4 border-t border-gray-100 flex justify-between items-center gap-3">
              <p className="text-sm text-gray-600">Page {page} of {totalPages} · {plural(total, 'report')}</p>
              <div className="flex gap-2">
                <button type="button" disabled={page <= 1} onClick={() => goToPage(page - 1)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 disabled:opacity-40 hover:bg-gray-50 transition-colors">
                  ← Prev
                </button>
                <button type="button" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 disabled:opacity-40 hover:bg-gray-50 transition-colors">
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {detailId && (
        <ReportWindow id={detailId} departments={departments} onClose={closeWindow} onUpdated={handleUpdated} onMoved={handleMoved} />
      )}
    </div>
  );
}
