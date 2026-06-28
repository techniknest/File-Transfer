'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useState } from 'react';
import { useTheme } from './ThemeProvider';

const NAV_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/how-it-works', label: 'How it Works' },
  { href: '/faq', label: 'FAQ' },
];

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav
      className="glass"
      style={{
        position: 'fixed', top: 0, width: '100%', zIndex: 500,
        borderBottom: '1px solid var(--border-glass)',
      }}
    >
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 1.5rem', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', textDecoration: 'none' }}>
          <div className="gradient-brand" style={{ width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(99,102,241,0.4)' }}>
            <span style={{ fontSize: '1.1rem' }}>⚡</span>
          </div>
          <span style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '1.15rem', letterSpacing: '-0.01em' }}>P2P Transfer</span>
        </Link>

        {/* Desktop Links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }} className="hidden md:flex">
          {NAV_LINKS.map(l => (
            <Link key={l.href} href={l.href} style={{
              color: pathname === l.href ? '#818cf8' : 'var(--text-secondary)',
              fontWeight: 500, fontSize: '0.9rem',
              transition: 'color 0.2s',
              textDecoration: 'none',
              borderBottom: pathname === l.href ? '2px solid #818cf8' : '2px solid transparent',
              paddingBottom: '2px',
            }}>
              {l.label}
            </Link>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="btn btn-ghost btn-icon"
            aria-label="Toggle theme"
            style={{ fontSize: '1.1rem' }}
          >
            {theme === 'dark' ? '🌙' : '☀️'}
          </button>

          {session ? (
            <>
              <Link href="/dashboard" className="btn btn-secondary btn-sm" style={{ display: 'none' }}>Dashboard</Link>
              <Link href="/dashboard" className="btn btn-primary btn-sm">Dashboard</Link>
              {session.user.role === 'admin' && (
                <Link href="/admin" className="btn btn-ghost btn-sm" style={{ color: '#fbbf24', display: 'none' }}>Admin</Link>
              )}
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm" style={{ display: 'none' }}>Sign In</Link>
              <Link href="/login" className="btn btn-ghost btn-sm">Sign In</Link>
              <Link href="/register" className="btn btn-primary btn-sm">Get Started</Link>
            </>
          )}

          {/* Mobile burger */}
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="btn btn-ghost btn-icon"
            aria-label="Menu"
            style={{ fontSize: '1.1rem' }}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div
          className="glass animate-fade-down"
          style={{ borderTop: '1px solid var(--border-glass)', padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}
        >
          {NAV_LINKS.map(l => (
            <Link key={l.href} href={l.href} onClick={() => setMenuOpen(false)} style={{
              display: 'block', padding: '0.75rem 0.5rem',
              color: pathname === l.href ? '#818cf8' : 'var(--text-secondary)',
              fontWeight: 500, borderBottom: '1px solid var(--border-subtle)',
              textDecoration: 'none',
            }}>
              {l.label}
            </Link>
          ))}
          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
            {session ? (
              <>
                <Link href="/dashboard" className="btn btn-primary btn-sm" onClick={() => setMenuOpen(false)}>Dashboard</Link>
                <button onClick={() => signOut({ callbackUrl: '/login' })} className="btn btn-ghost btn-sm">Sign Out</button>
              </>
            ) : (
              <>
                <Link href="/login" className="btn btn-ghost btn-sm" onClick={() => setMenuOpen(false)}>Sign In</Link>
                <Link href="/register" className="btn btn-primary btn-sm" onClick={() => setMenuOpen(false)}>Get Started</Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
