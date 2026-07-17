'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useState, useEffect, useRef } from 'react';
import { useTheme } from './ThemeProvider';
import { Zap, Moon, Sun, Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/how-it-works', label: 'How it Works' },
  { href: '/services', label: 'Services' },
  { href: '/faq', label: 'FAQ' },
  { href: '/reviews', label: 'Reviews' },
];

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <>
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
              <Zap className="text-white" size={20} />
            </div>
            <span style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '1.15rem', letterSpacing: '-0.01em' }}>P2P Transfer</span>
          </Link>

          {/* Desktop Links — ONLY visible md and above */}
          <div className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
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

          {/* Desktop Actions — ONLY visible md and above */}
          <div className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={toggleTheme}
              className="btn btn-ghost btn-icon"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
            </button>

            {session ? (
              <>
                <Link href="/dashboard" className="btn btn-primary btn-sm">Dashboard</Link>
                {session.user.role === 'admin' && (
                  <Link href="/admin" className="btn btn-ghost btn-sm" style={{ color: '#fbbf24' }}>Admin</Link>
                )}
              </>
            ) : (
              <>
                <Link href="/login" className="btn btn-ghost btn-sm">Sign In</Link>
                <Link href="/register" className="btn btn-primary btn-sm">Get Started</Link>
              </>
            )}
          </div>

          {/* Mobile right-side actions */}
          <div className="mobile-nav" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={toggleTheme}
              className="btn btn-ghost btn-icon"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
            </button>

            {/* Mobile hamburger — ONLY visible below md */}
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="btn btn-ghost btn-icon"
              aria-label="Toggle menu"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Dropdown — positioned as fixed overlay, NOT pushing content */}
      {menuOpen && (
        <div
          ref={menuRef}
          className="glass animate-fade-down mobile-menu-dropdown"
          style={{
            position: 'fixed',
            top: '64px',
            left: 0,
            right: 0,
            zIndex: 499,
            borderBottom: '1px solid var(--border-glass)',
            padding: '1rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
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
                {session.user.role === 'admin' && (
                  <Link href="/admin" className="btn btn-ghost btn-sm" style={{ color: '#fbbf24' }} onClick={() => setMenuOpen(false)}>Admin</Link>
                )}
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

      {/* Responsive styles injected via style tag */}
      <style>{`
        /* Desktop: show desktop-nav, hide mobile-nav */
        @media (min-width: 768px) {
          .desktop-nav { display: flex !important; }
          .mobile-nav { display: none !important; }
          .mobile-menu-dropdown { display: none !important; }
        }
        /* Mobile: hide desktop-nav, show mobile-nav */
        @media (max-width: 767px) {
          .desktop-nav { display: none !important; }
          .mobile-nav { display: flex !important; }
        }
      `}</style>
    </>
  );
}
