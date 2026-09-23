import React from 'react';
import { getReactionMeta } from '../citizen/FeedbackRatingPanel';

export default function FeedbackRatingDisplay({ rating, reaction, feedbackTags, compact = false }) {
  if (!rating && !reaction) return null;

  const meta = getReactionMeta(reaction);
  let tags = [];
  try {
    tags = feedbackTags ? JSON.parse(feedbackTags) : [];
  } catch {
    tags = [];
  }

  if (compact) {
    return (
      <div className="inline-flex items-center gap-2 flex-wrap">
        {meta && <span className="text-lg" title={meta.label}>{meta.emoji}</span>}
        {rating && (
          <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
            {rating}/5
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-green-100 bg-gradient-to-r from-green-50/80 to-white p-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Citizen feedback rating</p>
      <div className="flex flex-wrap items-center gap-4">
        {meta && (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${meta.bg}`}>
            <span className="text-2xl">{meta.emoji}</span>
            <span className={`text-sm font-semibold ${meta.text}`}>{meta.label}</span>
          </div>
        )}
        {rating && (
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map(s => (
              <svg key={s} className={`w-5 h-5 ${s <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200 fill-gray-100'}`} viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            ))}
            <span className="text-sm font-bold text-gray-700 ml-1">{rating}/5</span>
          </div>
        )}
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {tags.map(tag => (
            <span key={tag} className="text-xs bg-white border border-gray-200 text-gray-600 px-2.5 py-1 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

