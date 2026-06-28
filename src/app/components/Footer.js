import Link from 'next/link';

const FOOTER_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/how-it-works', label: 'How it Works' },
  { href: '/faq', label: 'FAQ' },
  { href: '/login', label: 'Sign In' },
  { href: '/register', label: 'Register' },
];

export default function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--border-default)', padding: '3rem 1.5rem 2rem', background: 'var(--bg-surface)' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '2rem', marginBottom: '2rem' }}>
          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.75rem' }}>
              <div className="gradient-brand" style={{ width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: 'white', fontSize: '1rem' }}>⚡</span>
              </div>
              <span style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '1.1rem' }}>P2P Transfer</span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '240px', lineHeight: 1.6 }}>
              Transfer files directly peer-to-peer. No cloud. No limits. Just transfer.
            </p>
          </div>

          {/* Links */}
          <div style={{ display: 'flex', gap: '3rem', flexWrap: 'wrap' }}>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>Product</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {['/how-it-works', '/faq', '/about'].map(href => (
                  <Link key={href} href={href} style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textDecoration: 'none', transition: 'color 0.2s' }}>
                    {href.slice(1).replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1rem' }}>Account</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[{ href: '/login', label: 'Sign In' }, { href: '/register', label: 'Register' }, { href: '/dashboard', label: 'Dashboard' }].map(l => (
                  <Link key={l.href} href={l.href} style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textDecoration: 'none', transition: 'color 0.2s' }}>
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="divider" style={{ marginBottom: '1.5rem' }} />

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>© 2026 P2P Transfer. Built by TechniKnest.</p>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
              <span className="status-dot online" style={{ width: '6px', height: '6px' }} />
              All Systems Operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
