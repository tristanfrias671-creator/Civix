import React from 'react';
import { Link } from 'react-router-dom';

const PORTALS = [
  {
    to: '/admin-login',
    label: 'Administrator',
    description: 'Manage staff, review reports, and configure CIVIX.',
    icon: 'M12 3 3 7v2h18V7l-9-4ZM5 10v8m4-8v8m6-8v8m4-8v8M3 21h18M4 18h16',
  },
  {
    to: '/staff-login',
    label: 'Staff',
    description: 'Review assigned reports and coordinate service requests.',
    icon: 'M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m6-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7-3h6m-3-3v6',
  },
];

export default function PortalLoginSelect() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-[#0b2f66] text-white px-6 py-5 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div>
            <p className="text-white/65 text-xs font-semibold">Municipality of Cantilan</p>
            <h1 className="text-lg font-extrabold">CIVIX Staff and Admin Portals</h1>
          </div>
          <Link to="/submit" className="text-sm font-semibold text-white/80 hover:text-white underline underline-offset-4">
            Public Portal
          </Link>
        </div>
      </header>

      <section className="flex-1 w-full max-w-5xl mx-auto px-6 py-14 sm:py-20">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Secure Sign In</p>
        <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">Choose your portal</h2>
        <p className="mt-3 max-w-2xl text-slate-600">Select the account type provided by your CIVIX administrator.</p>

        <div className="mt-9 grid gap-5 sm:grid-cols-2">
          {PORTALS.map(portal => (
            <Link key={portal.to} to={portal.to}
              className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-100">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700 group-hover:bg-blue-100">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={portal.icon} />
                </svg>
              </span>
              <h3 className="mt-5 text-xl font-bold text-slate-900">{portal.label} Login</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{portal.description}</p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-blue-700">
                Continue to sign in <span aria-hidden="true">→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white px-6 py-4 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Municipality of Cantilan
      </footer>
    </main>
  );
}
