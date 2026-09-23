import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import CitizenPortalLayout from '../../components/common/CitizenPortalLayout';
import Icon from '../../components/common/Icons';
import FeedbackRatingPanel from '../../components/citizen/FeedbackRatingPanel';
import { useTheme } from '../../context/ThemeContext';
import api from '../../utils/api';
import { CANTILAN_LOCATIONS } from '../../data/cantilanLocations';

const fadeCss = `
@keyframes submitFadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
.submit-fade-0 { animation: submitFadeUp .45s .02s cubic-bezier(.22,1,.36,1) both; }
.submit-fade-1 { animation: submitFadeUp .45s .08s cubic-bezier(.22,1,.36,1) both; }
.submit-fade-2 { animation: submitFadeUp .45s .14s cubic-bezier(.22,1,.36,1) both; }
`;

const DEPARTMENTS = [
  "Mayor's Office – CRMO", 'HR', 'Tourism', 'Motorpool', 'Traffic',
  'CSDO', 'OSCA', 'MDRRMO',
  'Municipal Budget Office', 'Municipal Accountant Office',
  'Municipal Agriculture Office', 'Municipal Health Office',
  'Municipal Civil Registry Office',
  'Municipal Social Welfare & Development Office',
  'Municipal Economic & Natural Resource Office',
  'Municipal Treasurer Office', 'Municipal Engineering Office',
  'Municipal Planning & Development Office',
  'Sangguniang Bayan Office', 'Office of the Vice Mayor',
];

function ConfidenceBadge({ confidence }) {
  const color = confidence >= 70 ? '#16a34a' : confidence >= 40 ? '#d97706' : '#dc2626';
  const bg    = confidence >= 70 ? '#dcfce7' : confidence >= 40 ? '#fef3c7' : '#fee2e2';
  return (
    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color, background: bg }}>
      {confidence}% confidence
    </span>
  );
}

export default function Submit() {
  const { dark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const debounceRef = useRef(null);

  const [form, setForm] = useState({ type: 'COMPLAINT', department: '', description: '', contactNumber: '', email: '', address: '' });
  const [trackInput, setTrackInput] = useState('');
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [trackingId, setTrackingId] = useState(null);
  const [feedbackRating, setFeedbackRating]     = useState(0);
  const [feedbackReaction, setFeedbackReaction] = useState('');
  const [feedbackTags, setFeedbackTags]         = useState([]);

  const [aiResult, setAiResult]       = useState(null);
  const [aiLoading, setAiLoading]     = useState(false);
  const [aiDismissed, setAiDismissed] = useState(false);

  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const locationFieldRef = useRef(null);

  const [deptOpen, setDeptOpen] = useState(false);
  const deptFieldRef = useRef(null);

  useEffect(() => {
    function onClickOutside(e) {
      if (deptFieldRef.current && !deptFieldRef.current.contains(e.target)) {
        setDeptOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    const urls = photos.map(p => URL.createObjectURL(p));
    setPhotoPreviews(urls);
    return () => urls.forEach(u => URL.revokeObjectURL(u));
  }, [photos]);

  function addPhotos(fileList) {
    const incoming = Array.from(fileList).filter(f => f.type === 'image/jpeg' || f.type === 'image/png');
    setPhotos(prev => [...prev, ...incoming].slice(0, 5));
  }

  function removePhoto(idx) {
    setPhotos(prev => prev.filter((_, i) => i !== idx));
  }

  useEffect(() => {
    function onClickOutside(e) {
      if (locationFieldRef.current && !locationFieldRef.current.contains(e.target)) {
        setShowLocationSuggestions(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function handleAddressChange(value) {
    setForm(p => ({ ...p, address: value }));
    if (value.trim().length < 1) {
      setLocationSuggestions([]);
      setShowLocationSuggestions(false);
      return;
    }
    const q = value.toLowerCase();
    const matches = CANTILAN_LOCATIONS.filter(loc => loc.toLowerCase().includes(q)).slice(0, 6);
    setLocationSuggestions(matches);
    setShowLocationSuggestions(matches.length > 0);
  }

  function selectLocationSuggestion(loc) {
    setForm(p => ({ ...p, address: loc }));
    setShowLocationSuggestions(false);
  }

  useEffect(() => {
    if (location.state?.type) setForm(p => ({ ...p, type: location.state.type }));
  }, [location.state]);

  const runAI = useCallback((text) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text || text.length < 10) { setAiResult(null); setAiLoading(false); return; }
    setAiLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.post('/classify', { text });
        if (res.data.department !== 'UNASSIGNED') {
          setAiResult(res.data);
          setAiDismissed(false);
        } else {
          setAiResult(null);
        }
      } catch {
        setAiResult(null);
      } finally {
        setAiLoading(false);
      }
    }, 600);
  }, []);

  function handleDescriptionChange(e) {
    const text = e.target.value;
    setForm(p => ({ ...p, description: text }));
    if (!form.department) runAI(text);
    else { setAiResult(null); setAiLoading(false); }
  }

  function applyAISuggestion() {
    if (aiResult) {
      setForm(p => ({ ...p, department: aiResult.department }));
      setAiResult(null);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.department) return toast.error('Please select a department / office');
    if (form.description.length < 20) return toast.error('Description must be at least 20 characters');
    if (!form.contactNumber.trim()) return toast.error('Contact number is required');
    if (!form.email.trim()) return toast.error('Email address is required');
    if (form.type === 'FEEDBACK') {
      if (!feedbackRating) return toast.error('Please rate your experience (1–5 stars)');
      if (!feedbackReaction) return toast.error('Please select how you felt about the service');
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('type', form.type);
      fd.append('citizenDepartment', form.department);
      fd.append('description', form.description);
      if (form.contactNumber) fd.append('contactNumber', form.contactNumber);
      if (form.email) fd.append('email', form.email);
      if (form.address) fd.append('address', form.address);
      if (form.type === 'FEEDBACK') {
        fd.append('rating', String(feedbackRating));
        fd.append('reaction', feedbackReaction);
        if (feedbackTags.length) fd.append('feedbackTags', JSON.stringify(feedbackTags));
      }
      photos.forEach(p => fd.append('photos', p));

      const res = await api.post('/submissions', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setTrackingId(res.data.trackingId);
      toast.success('Submission received!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Submission failed');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setTrackingId(null);
    setForm({ type: 'COMPLAINT', department: '', description: '', contactNumber: '', email: '', address: '' });
    setPhotos([]);
    setFeedbackRating(0);
    setFeedbackReaction('');
    setFeedbackTags([]);
    setAiResult(null);
    setAiDismissed(false);
  }

  if (trackingId) {
    return (
      <CitizenPortalLayout>
        <div className="max-w-lg mx-auto py-8 text-center">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10">
            <div className="mb-4 flex justify-center">
              <div className="p-4 rounded-full bg-green-50" style={{ color: '#16a34a' }}>
                <Icon name="checkCircle" className="w-14 h-14" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Submission Received!</h2>
            <p className="text-gray-500 mb-2">Your Transaction Code is:</p>
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-6 py-4 font-mono text-xl font-bold mb-3"
              style={{ color: dark ? '#60a5fa' : '#2563eb' }}>
              {trackingId}
            </div>
            <p className="text-sm text-gray-500 mb-1 font-medium">
              Save this code to track the status of your submission.
            </p>
            <p className="text-xs text-gray-400 mb-8">
              No account is required. Enter this code on the Track Complaint page at any time.
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={resetForm}
                className="px-5 py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors">
                Submit Another
              </button>
              <button onClick={() => navigate('/track', { state: { prefill: trackingId } })}
                className="px-5 py-2.5 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                Track This Complaint
              </button>
            </div>
          </div>
        </div>
      </CitizenPortalLayout>
    );
  }

  return (
    <CitizenPortalLayout>
      <style>{fadeCss}</style>
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 items-start">
        <div>
        <div className="submit-fade-0 mb-5 bg-blue-50 border border-blue-100 rounded-2xl px-6 py-5 flex items-start gap-4">
          <div className="p-2.5 rounded-xl bg-blue-600 text-white flex-shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-800">Report a Concern</h1>
            <p className="text-gray-500 text-sm mt-0.5">Help us keep Cantilan clean, safe and organized.</p>
            <p className="text-gray-400 text-xs mt-0.5">No registration. Just fill out the form and submit your report.</p>
          </div>
        </div>

        {/* Data Privacy Act notice */}
        <div className="mb-6 flex items-start gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-500 leading-relaxed">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span>
            In compliance with the <strong>Data Privacy Act of 2012 (Republic Act No. 10173)</strong>, any information you voluntarily provide (such as an optional contact number) will be used solely for processing and following up on your report, and will not be shared with unauthorized third parties.
          </span>
        </div>

        <form onSubmit={handleSubmit} className="submit-fade-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
          <h2 className="flex items-center gap-2 text-base font-bold text-gray-800 -mb-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Submit a Report
          </h2>

          {/* REPORT TYPE + DEPARTMENT */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type of Concern *</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm">
                <option value="COMPLAINT">Complaint</option>
                <option value="SUGGESTION">Suggestion</option>
                <option value="FEEDBACK">Feedback</option>
              </select>
            </div>
            <div ref={deptFieldRef} className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department Concerned *
                {form.department && (
                  <span className="ml-2 text-xs text-primary font-normal">(AI auto-selected — you may change)</span>
                )}
              </label>
              <button type="button" onClick={() => setDeptOpen(v => !v)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm text-left bg-white flex items-center justify-between gap-2">
                <span className={form.department ? 'text-gray-900' : 'text-gray-400'}>
                  {form.department || 'Select department / office...'}
                </span>
                <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${deptOpen ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {deptOpen && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1.5 bg-white rounded-lg border border-gray-200 shadow-lg overflow-y-auto"
                  style={{ maxHeight: '16rem' }}>
                  {DEPARTMENTS.map(d => (
                    <button key={d} type="button"
                      onClick={() => {
                        setForm(p => ({ ...p, department: d }));
                        setAiResult(null);
                        setDeptOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                        form.department === d ? 'bg-blue-50 text-primary font-semibold' : 'text-gray-700 hover:bg-gray-50'
                      }`}>
                      {d}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* LOCATION */}
          <div ref={locationFieldRef}>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <div className="relative">
              <svg className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <input type="text" value={form.address}
                onChange={e => handleAddressChange(e.target.value)}
                onFocus={() => { if (locationSuggestions.length > 0) setShowLocationSuggestions(true); }}
                placeholder="e.g. Barangay, landmark, or address"
                autoComplete="off"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm" />

              {showLocationSuggestions && (
                <div className="absolute z-20 left-0 right-0 mt-1.5 bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden">
                  {locationSuggestions.map(loc => (
                    <button key={loc} type="button"
                      onClick={() => selectLocationSuggestion(loc)}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-blue-50 transition-colors">
                      <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {loc}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">Suggestions are limited to Cantilan barangays and landmarks.</p>
          </div>

          {/* CONTACT NUMBER (REQUIRED) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number *</label>
            <input type="tel" value={form.contactNumber} required
              onChange={e => setForm(p => ({ ...p, contactNumber: e.target.value }))}
              placeholder="e.g. 09XX XXX XXXX"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
            <p className="text-xs text-gray-400 mt-1">Used so the concerned office can follow up with you and send SMS updates on your report's status.</p>
          </div>

          {/* EMAIL (REQUIRED) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
            <input type="email" value={form.email} required
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              placeholder="e.g. juandelacruz@gmail.com"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
            <p className="text-xs text-gray-400 mt-1">We'll email you automatically whenever your report's status changes — no need to keep checking Track My Report.</p>
          </div>

          {form.type === 'FEEDBACK' && (
            <FeedbackRatingPanel rating={feedbackRating} reaction={feedbackReaction} tags={feedbackTags}
              onRatingChange={setFeedbackRating} onReactionChange={setFeedbackReaction} onTagsChange={setFeedbackTags} />
          )}

          {/* DESCRIPTION + AI */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {form.type === 'FEEDBACK' ? 'Tell us more *' : 'Description *'}
            </label>
            {form.type !== 'FEEDBACK' && (
              <div className="mb-2 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700 leading-relaxed">
                <strong>Please include:</strong> (1) <strong>What happened</strong> — describe the issue clearly, (2) <strong>Where it occurred</strong>, (3) <strong>When it started</strong>, (4) Any other details that will help the concerned office act on your concern.
              </div>
            )}
            <div className="relative">
              <textarea value={form.description} onChange={handleDescriptionChange} rows={5}
                placeholder={form.type === 'FEEDBACK'
                  ? 'Share what went well or what could be improved...'
                  : 'Example: There is a broken streetlight in front of Brgy. Hall, Hayanggabon, Cantilan. It has been broken for 2 weeks and is dangerous at night...'}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm resize-none" />
              {aiLoading && (
                <div className="absolute bottom-3 right-3 flex items-center gap-1.5 text-xs text-gray-400">
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  AI analyzing...
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex-1 h-1 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (form.description.length / 20) * 100)}%`,
                    background: form.description.length >= 20 ? '#16a34a' : form.description.length >= 10 ? '#d97706' : '#dc2626',
                  }} />
              </div>
              <p className="text-xs text-gray-400 flex-shrink-0">{form.description.length} / 20 min</p>
            </div>

            {/* AI Suggestion Panel */}
            {aiResult && !aiDismissed && !form.department && (
              <div className="mt-3 rounded-xl border border-blue-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-blue-600 text-white">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                    </svg>
                    <span className="text-xs font-bold uppercase tracking-wide">AI Department Suggestion</span>
                  </div>
                  <button type="button" onClick={() => setAiDismissed(true)}
                    className="text-blue-200 hover:text-white text-lg leading-none">×</button>
                </div>
                <div className="bg-blue-50 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                    <div>
                      <p className="text-xs text-blue-600 font-medium mb-0.5">Suggested Department</p>
                      <p className="text-sm font-bold text-gray-800">{aiResult.department}</p>
                    </div>
                    <ConfidenceBadge confidence={aiResult.confidence} />
                  </div>
                  {aiResult.matchedKeywords?.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-gray-500 mb-1.5">Detected keywords:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {aiResult.matchedKeywords.map(kw => (
                          <span key={kw} className="px-2 py-0.5 bg-white border border-blue-200 text-blue-700 text-xs rounded-full font-medium">
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button type="button" onClick={applyAISuggestion}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                      Apply Suggestion
                    </button>
                    <button type="button" onClick={() => setAiDismissed(true)}
                      className="px-4 py-2 border border-gray-300 text-gray-600 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors">
                      Choose Manually
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* FILE ATTACHMENT */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">File Attachment (Optional)</label>
            <div
              onDragOver={e => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={e => { e.preventDefault(); setDragActive(false); addPhotos(e.dataTransfer.files); }}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-all hover:border-primary hover:shadow-[0_0_0_4px_rgba(37,99,235,0.08)] ${
                dragActive ? 'border-primary bg-blue-50 shadow-[0_0_0_4px_rgba(37,99,235,0.12)]' : 'border-gray-200'
              }`}>
              <input type="file" accept="image/jpeg,image/png" multiple
                onChange={e => addPhotos(e.target.files)}
                className="hidden" id="photo-upload" />
              <label htmlFor="photo-upload" className="cursor-pointer">
                <div className="mb-2 flex justify-center text-gray-400">
                  <Icon name="camera" className="w-10 h-10" />
                </div>
                <p className="text-sm text-gray-500">
                  <span className="text-primary font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-400 mt-1">JPG or PNG files only, up to 5 photos</p>
              </label>
              {photos.length > 0 && (
                <div className="mt-4 grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {photos.map((p, i) => (
                    <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200">
                      <img src={photoPreviews[i]} alt={p.name} className="w-full h-full object-cover" />
                      <button type="button" onClick={() => removePhoto(i)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <button type="submit" disabled={loading}
            className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
            {loading ? 'Submitting...' : 'Submit Report'}
          </button>
        </form>
        </div>

        {/* RIGHT SIDE PANELS */}
        <div className="submit-fade-2 space-y-5">
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-blue-600 text-white flex items-center justify-center">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">Your report matters!</h3>
            <p className="text-sm text-gray-500">
              We appreciate your effort in helping make Cantilan a better and safer place for everyone.
            </p>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-1">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
              </svg>
              Track Your Report
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Already submitted a report? Check the status using your tracking code.
            </p>
            <input type="text" value={trackInput} onChange={e => setTrackInput(e.target.value)}
              placeholder="Enter your tracking code (e.g. CIVIX-2025-0418)"
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-primary" />
            <button type="button"
              onClick={() => navigate('/track', { state: { prefill: trackInput } })}
              className="w-full bg-primary text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" />
              </svg>
              Check Status
            </button>
          </div>

          <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-2xl p-4">
            <div className="p-1.5 rounded-lg bg-blue-600 text-white flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-800">Your report is anonymous.</p>
              <p className="text-xs text-gray-500">We do not require any registration or personal account.</p>
            </div>
          </div>
        </div>
      </div>
    </CitizenPortalLayout>
  );
}
