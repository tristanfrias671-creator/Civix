import React from 'react';

// A question that opens on demand to a short explanation (closed at first), such as
// "How is Positive, Neutral or Negative determined?". `data` names the data
// attribute the element carries (data-label-rule, data-remark-rule, data-score-rule).
export function RuleDetails({ question, data, className = '', children }) {
  return (
    <details {...{ [`data-${data}`]: '' }} className={`group text-sm ${className}`}>
      <summary className="inline-flex items-center gap-1.5 cursor-pointer select-none font-semibold text-blue-700 hover:underline underline-offset-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 [&::-webkit-details-marker]:hidden">
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
        </svg>
        {question}
        <svg className="w-3.5 h-3.5 flex-shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="mt-2 space-y-2 rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-3 leading-relaxed text-gray-700">
        {children}
      </div>
    </details>
  );
}

// How CIVIX determines Positive, Neutral or Negative. It says what the server does:
// server/src/utils/csm.js (csmSentiment) for feedback and server/src/utils/sentiment.js
// for complaints and suggestions.
// `type`: 'FEEDBACK' for the satisfaction form only, 'REPORT' for complaints and
// suggestions only, or nothing for both.

function FeedbackRule() {
  return (
    <>
      <p>
        <strong className="text-gray-900">Feedback (the satisfaction form)</strong> is based on the client's answer to
        SQD0, "I am satisfied with the service that I availed":
      </p>
      <ul className="list-disc pl-5 space-y-0.5">
        <li><strong className="text-gray-900">Positive:</strong> Agree or Strongly agree</li>
        <li><strong className="text-gray-900">Neutral:</strong> Neither agree nor disagree</li>
        <li><strong className="text-gray-900">Negative:</strong> Disagree or Strongly disagree</li>
      </ul>
      <p>
        If SQD0 is N/A, the average of SQD1–SQD8 is used: 3.5 and above is Positive, below 2.5 is Negative, and
        anything in between is Neutral. If every answer is N/A, the words of the client's suggestions are used, as
        for complaints; with no words, the form is Neutral.
      </p>
    </>
  );
}

function ReportRule() {
  return (
    <p>
      <strong className="text-gray-900">Complaints and suggestions</strong> are based on their words. CIVIX counts
      positive words (such as thank you, fast, salamat, maayo) and negative words (such as slow, rude, matagal, guba)
      in English, Filipino and Bisaya. More positive words is Positive, more negative words is Negative, and an equal
      count is Neutral.
    </p>
  );
}

export default function LabelRule({ type, className = '' }) {
  return (
    <RuleDetails question="How is Positive, Neutral or Negative determined?" data="label-rule" className={className}>
      {type !== 'REPORT' && <FeedbackRule />}
      {type !== 'FEEDBACK' && <ReportRule />}
    </RuleDetails>
  );
}
