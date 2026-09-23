import React from 'react';

export const REACTIONS = [
  { id: 'EXCELLENT', label: 'Excellent', emoji: '😄', rating: 5, ring: 'ring-emerald-400', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  { id: 'GOOD', label: 'Good', emoji: '🙂', rating: 4, ring: 'ring-green-400', bg: 'bg-green-50', text: 'text-green-700' },
  { id: 'OKAY', label: 'Okay', emoji: '😐', rating: 3, ring: 'ring-amber-400', bg: 'bg-amber-50', text: 'text-amber-700' },
  { id: 'POOR', label: 'Poor', emoji: '😞', rating: 2, ring: 'ring-orange-400', bg: 'bg-orange-50', text: 'text-orange-700' },
  { id: 'TERRIBLE', label: 'Terrible', emoji: '😠', rating: 1, ring: 'ring-red-400', bg: 'bg-red-50', text: 'text-red-700' },
];

export const EXPERIENCE_TAGS = [
  'Helpful staff',
  'Quick response',
  'Easy to use',
  'Clear updates',
  'Needs improvement',
  'Slow follow-up',
];

export function getReactionMeta(reactionId) {
  return REACTIONS.find(r => r.id === reactionId) || null;
}

function Star({ filled, onClick, onHover, size = 'lg' }) {
  const sizeClass = size === 'lg' ? 'w-9 h-9' : 'w-6 h-6';
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onHover}
      className={`${sizeClass} transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary/30 rounded`}
      aria-label="Rate star"
    >
      <svg viewBox="0 0 24 24" className={filled ? 'text-amber-400 fill-amber-400' : 'text-gray-300 fill-gray-200'}>
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    </button>
  );
}

export default function FeedbackRatingPanel({ rating, reaction, tags, onRatingChange, onReactionChange, onTagsChange }) {
  const [hoverStar, setHoverStar] = React.useState(0);
  const displayStars = hoverStar || rating || 0;
  const selectedReaction = getReactionMeta(reaction);

  function selectReaction(r) {
    onReactionChange(r.id);
    onRatingChange(r.rating);
  }

  function toggleTag(tag) {
    if (tags.includes(tag)) onTagsChange(tags.filter(t => t !== tag));
    else onTagsChange([...tags, tag]);
  }

  return (
    <div className="rounded-2xl border border-green-200 bg-gradient-to-br from-green-50 via-white to-emerald-50/40 p-5 space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-gray-800">How was your experience?</h3>
        <p className="text-xs text-gray-500 mt-0.5">Your reaction helps the government improve services</p>
      </div>

      <div className="grid grid-cols-5 gap-2 sm:gap-3">
        {REACTIONS.map(r => {
          const active = reaction === r.id;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => selectReaction(r)}
              className={`flex flex-col items-center gap-1.5 p-2 sm:p-3 rounded-xl border-2 transition-all ${
                active
                  ? `${r.bg} border-transparent ring-2 ${r.ring} scale-[1.02] shadow-sm`
                  : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'
              }`}
            >
              <span className="text-2xl sm:text-3xl leading-none" role="img" aria-hidden>{r.emoji}</span>
              <span className={`text-[10px] sm:text-xs font-semibold ${active ? r.text : 'text-gray-500'}`}>
                {r.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col items-center py-2 border-y border-green-100/80">
        <p className="text-xs font-medium text-gray-500 mb-2">Overall rating</p>
        <div className="flex gap-1" onMouseLeave={() => setHoverStar(0)}>
          {[1, 2, 3, 4, 5].map(star => (
            <Star
              key={star}
              filled={star <= displayStars}
              onClick={() => {
                onRatingChange(star);
                const match = REACTIONS.find(r => r.rating === star);
                if (match) onReactionChange(match.id);
              }}
              onHover={() => setHoverStar(star)}
            />
          ))}
        </div>
        <p className="text-sm font-semibold text-gray-700 mt-2 min-h-[1.25rem]">
          {displayStars > 0 ? `${displayStars} out of 5` : 'Tap a star or reaction above'}
        </p>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-600 mb-2">What stood out? <span className="text-gray-400 font-normal">(optional)</span></p>
        <div className="flex flex-wrap gap-2">
          {EXPERIENCE_TAGS.map(tag => {
            const on = tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  on
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-primary/40'
                }`}
              >
                {on ? '✓ ' : ''}{tag}
              </button>
            );
          })}
        </div>
      </div>

      {selectedReaction && (
        <div className={`text-center text-xs font-medium px-3 py-2 rounded-lg ${selectedReaction.bg} ${selectedReaction.text}`}>
          You selected: {selectedReaction.label} ({rating}/5)
        </div>
      )}
    </div>
  );
}

