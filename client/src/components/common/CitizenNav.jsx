import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import DarkModeToggle from './DarkModeToggle';

export default function CitizenNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (to) => location.pathname === to;

  const navLinks = [
    {
      to: '/submit',
      label: 'Submit a Report',
      icon: 'M12 4v16m8-8H4',
    },
    {
      to: '/track',
      label: 'Track Complaint',
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
    },
  ];

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">

          {/* Left: Logo + nav links */}
          <div className="flex items-center gap-8">
            <Link to="/submit" className="flex items-center gap-2.5 flex-shrink-0">
              <img src="/civix-logo.png" alt="CIVIX" className="h-9 w-auto" />
              <span className="hidden sm:block text-xs font-semibold text-gray-400 tracking-wide uppercase">Public Portal</span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {navLinks.map(l => (
                <Link key={l.to} to={l.to}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-all"
                  style={isActive(l.to)
                    ? { background: '#f5f3ff', color: '#7c3aed' }
                    : { color: '#6b7280' }}
                  onMouseEnter={e => { if (!isActive(l.to)) { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.color = '#111827'; } }}
                  onMouseLeave={e => { if (!isActive(l.to)) { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#6b7280'; } }}>
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={l.icon} />
                  </svg>
                  {l.label}
                  {isActive(l.to) && <span className="w-1.5 h-1.5 rounded-full bg-violet-500 ml-0.5" />}
                </Link>
              ))}
            </div>
          </div>

          {/* Right: Dark mode + Staff/Admin login */}
          <div className="flex items-center gap-2">
            <DarkModeToggle />
            <button
              onClick={() => navigate('/')}
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all text-gray-500 hover:text-gray-800 hover:bg-gray-100">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Staff / Admin
            </button>

            {/* Mobile hamburger */}
            <button className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100" onClick={() => setMenuOpen(!menuOpen)}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {menuOpen && (
          <div className="md:hidden pb-3 pt-1 border-t border-gray-100">
            {navLinks.map(l => (
              <Link key={l.to} to={l.to} onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg mx-1 text-sm font-medium transition-colors"
                style={isActive(l.to) ? { background: '#f5f3ff', color: '#7c3aed' } : { color: '#374151' }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={l.icon} />
                </svg>
                {l.label}
              </Link>
            ))}
            <button onClick={() => { setMenuOpen(false); navigate('/'); }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg mx-1 text-sm font-medium text-gray-500 w-full">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Staff / Admin Login
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
