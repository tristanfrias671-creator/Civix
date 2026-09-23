import React from 'react';
import { useTheme } from '../../context/ThemeContext';

const STATUS_LIGHT = {
  PENDING:     { label: 'Pending',     dot: '#9ca3af', bg: '#f3f4f6', color: '#374151' },
  REVIEWING:   { label: 'Reviewing',   dot: '#3b82f6', bg: '#eff6ff', color: '#1d4ed8' },
  IN_PROGRESS: { label: 'In Progress', dot: '#f59e0b', bg: '#fffbeb', color: '#b45309' },
  RESOLVED:    { label: 'Resolved',    dot: '#22c55e', bg: '#f0fdf4', color: '#15803d' },
};
const STATUS_DARK = {
  PENDING:     { label: 'Pending',     dot: '#94a3b8', bg: 'rgba(148,163,184,0.12)', color: '#94a3b8' },
  REVIEWING:   { label: 'Reviewing',   dot: '#60a5fa', bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa' },
  IN_PROGRESS: { label: 'In Progress', dot: '#fbbf24', bg: 'rgba(245,158,11,0.15)',  color: '#fbbf24' },
  RESOLVED:    { label: 'Resolved',    dot: '#4ade80', bg: 'rgba(34,197,94,0.15)',   color: '#4ade80' },
};

export function StatusBadge({ status }) {
  const { dark } = useTheme();
  const map = dark ? STATUS_DARK : STATUS_LIGHT;
  const cfg = map[status] || (dark
    ? { label: status, dot: '#94a3b8', bg: 'rgba(148,163,184,0.12)', color: '#94a3b8' }
    : { label: status, dot: '#9ca3af', bg: '#f3f4f6', color: '#374151' });

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

const TYPE_LIGHT = {
  COMPLAINT:  { label: 'Complaint',  bg: '#fef2f2', color: '#dc2626', icon: '!' },
  SUGGESTION: { label: 'Suggestion', bg: '#eff6ff', color: '#2563eb', icon: '✦' },
  FEEDBACK:   { label: 'Feedback',   bg: '#f0fdf4', color: '#16a34a', icon: '★' },
};
const TYPE_DARK = {
  COMPLAINT:  { label: 'Complaint',  bg: 'rgba(220,38,38,0.15)',  color: '#f87171', icon: '!' },
  SUGGESTION: { label: 'Suggestion', bg: 'rgba(37,99,235,0.15)',  color: '#60a5fa', icon: '✦' },
  FEEDBACK:   { label: 'Feedback',   bg: 'rgba(22,163,74,0.15)',  color: '#4ade80', icon: '★' },
};

export function TypeBadge({ type }) {
  const { dark } = useTheme();
  const map = dark ? TYPE_DARK : TYPE_LIGHT;
  const cfg = map[type] || (dark
    ? { label: type, bg: 'rgba(148,163,184,0.12)', color: '#94a3b8', icon: '•' }
    : { label: type, bg: '#f3f4f6', color: '#374151', icon: '•' });

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}>
      <span className="text-xs leading-none">{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

const PRIORITY_LIGHT = {
  URGENT:   { label: 'Urgent',   bg: '#fef2f2', color: '#dc2626' },
  STANDARD: { label: 'Standard', bg: '#eff6ff', color: '#2563eb' },
  LOW:      { label: 'Low',      bg: '#f3f4f6', color: '#6b7280' },
};
const PRIORITY_DARK = {
  URGENT:   { label: 'Urgent',   bg: 'rgba(220,38,38,0.15)', color: '#f87171' },
  STANDARD: { label: 'Standard', bg: 'rgba(37,99,235,0.15)', color: '#60a5fa' },
  LOW:      { label: 'Low',      bg: 'rgba(107,114,128,0.15)', color: '#9ca3af' },
};

export function PriorityBadge({ priority }) {
  const { dark } = useTheme();
  const map = dark ? PRIORITY_DARK : PRIORITY_LIGHT;
  const cfg = map[priority] || (dark
    ? { label: priority, bg: 'rgba(148,163,184,0.12)', color: '#94a3b8' }
    : { label: priority, bg: '#f3f4f6', color: '#6b7280' });

  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

const SENTIMENT_LIGHT = {
  POSITIVE: { label: 'Positive', bg: '#f0fdf4', color: '#15803d' },
  NEUTRAL:  { label: 'Neutral',  bg: '#f3f4f6', color: '#374151' },
  NEGATIVE: { label: 'Negative', bg: '#fef2f2', color: '#dc2626' },
};
const SENTIMENT_DARK = {
  POSITIVE: { label: 'Positive', bg: 'rgba(22,163,74,0.15)',  color: '#4ade80' },
  NEUTRAL:  { label: 'Neutral',  bg: 'rgba(107,114,128,0.15)', color: '#94a3b8' },
  NEGATIVE: { label: 'Negative', bg: 'rgba(220,38,38,0.15)',  color: '#f87171' },
};

export function SentimentBadge({ sentiment }) {
  const { dark } = useTheme();
  const map = dark ? SENTIMENT_DARK : SENTIMENT_LIGHT;
  const cfg = map[sentiment] || (dark
    ? { label: sentiment, bg: 'rgba(148,163,184,0.12)', color: '#94a3b8' }
    : { label: sentiment, bg: '#f3f4f6', color: '#374151' });

  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}
