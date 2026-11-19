import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { RuleDetails } from './LabelRule';

// The kind of remark a client wrote in the last box of the satisfaction form: a
// comment, a complaint or a suggestion. The server sorts it from the client's words
// (server/src/utils/remarks.js); this shows it as a chip and explains how, in a few
// lines that open on demand. A remark is not a complaint report.

export const REMARKS = ['COMMENT', 'COMPLAINT', 'SUGGESTION'];
export const REMARK_LABEL = { COMMENT: 'Comment', COMPLAINT: 'Complaint', SUGGESTION: 'Suggestion' };
export const REMARK_PLURAL = { COMMENT: 'Comments', COMPLAINT: 'Complaints', SUGGESTION: 'Suggestions' };

// Outlined and gray, so it is not taken for the report type (Complaint, Suggestion)
// or the label (Positive, Neutral, Negative).
export function RemarkBadge({ remark }) {
  const { dark } = useTheme();
  if (!REMARK_LABEL[remark]) return null;
  return (
    <span data-remark-badge={remark} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs whitespace-nowrap"
      style={{ borderColor: dark ? 'rgba(148,163,184,0.55)' : '#94a3b8', color: dark ? '#e2e8f0' : '#334155' }}>
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z" />
      </svg>
      Remark: <strong className="font-semibold">{REMARK_LABEL[remark]}</strong>
    </span>
  );
}

export default function RemarkRule({ className = '' }) {
  return (
    <RuleDetails question="How is a remark classified?" data="remark-rule" className={className}>
      <p>CIVIX reads the words of the client's remark in English, Filipino or Bisaya:</p>
      <ul className="list-disc pl-5 space-y-0.5">
        <li>
          <strong className="text-gray-900">Complaint:</strong> it names a problem (such as slow, rude, matagal, bastos,
          dugay or guba), or a good quality with "not" before it (such as not clear or hindi maayos).
        </li>
        <li>
          <strong className="text-gray-900">Suggestion:</strong> otherwise, it asks for a change (such as should, add,
          improve, sana, dapat, unta or dugangan).
        </li>
        <li><strong className="text-gray-900">Comment:</strong> any other remark, such as thanks or praise.</li>
      </ul>
      <p>
        A word right after no, not, hindi, wala or dili is read the opposite way: "walang problema" is not a complaint.
        "None" or "Wala po" counts as no remark.
      </p>
      <p>
        A remark is not a complaint report and has no deadline. A client who wants the office to act should file a
        complaint on the complaint form.
      </p>
    </RuleDetails>
  );
}
