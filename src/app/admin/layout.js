'use client';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTheme } from '../components/ThemeProvider';

const ADMIN_NAV = [
  { href: '/admin', label: 'Overview', icon: '📊' },
  { href: '/admin/users', label: 'Users', icon: '👥' },
  { href: '/admin/transfers', label: 'Transfers', icon: '📦' },
  { href: '/admin/health', label: 'System Health', icon: '❤️' },
];

export default function AdminLayout({ children }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return; }
    if (status === 'authenticated' && session?.user?.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  if (status === 'loading' || session?.user?.role !== 'admin') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '3px solid rgba(245,158,11,0.2)', borderTop: '3px solid #f59e0b', borderRadius: '50%', margin: '0 auto 1rem', animation: 'spin 1s linear infinite' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Checking permissions...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex' }}>
      {/* Sidebar overlay mobile */}
      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99 }} />}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} style={{ zIndex: 100 }}>
        <div style={{ padding: '1.5rem 1rem' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem', padding: '0 0.25rem' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: '1rem' }}>🛡️</span>
            </div>
            <div>
              <p style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '1rem', lineHeight: 1.2 }}>Admin Panel</p>
              <p style={{ color: '#f59e0b', fontSize: '0.7rem', fontWeight: 600 }}>P2P Transfer</p>
            </div>
          </div>

          <div className="divider" style={{ marginBottom: '1.25rem', marginTop: '1rem' }} />

          {/* Nav */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
            {ADMIN_NAV.map(item => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`sidebar-nav-item ${pathname === item.href ? 'active' : ''}`}
                style={{ color: pathname === item.href ? '#f59e0b' : undefined, background: pathname === item.href ? 'rgba(245,158,11,0.1)' : undefined, borderColor: pathname === item.href ? 'rgba(245,158,11,0.2)' : undefined }}
              >
                <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
                {item.label}
              </a>
            ))}

            <div className="divider" style={{ margin: '0.75rem 0' }} />
            <a href="/dashboard" className="sidebar-nav-item">
              <span style={{ fontSize: '1.1rem' }}>← </span>
              Back to Dashboard
            </a>
          </nav>
        </div>

        {/* User */}
        <div style={{ marginTop: 'auto', padding: '1rem', borderTop: '1px solid var(--border-default)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', padding: '0.75rem', borderRadius: '0.75rem', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, flexShrink: 0 }}>
              {session.user.name?.[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{session.user.name}</p>
              <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>Admin</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={toggleTheme} className="btn btn-ghost btn-sm" style={{ flex: 1 }}>
              {theme === 'dark' ? '🌙' : '☀️'}
            </button>
            <button onClick={() => signOut({ callbackUrl: '/login' })} className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', flex: 1 }}>
              Exit
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, marginLeft: '256px', minHeight: '100vh', display: 'flex', flexDirection: 'column' }} className="main-with-sidebar">
        {/* Header */}
        <header className="glass" style={{ borderBottom: '1px solid var(--border-default)', padding: '0 1.5rem', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button onClick={() => setSidebarOpen(true)} className="btn btn-ghost btn-icon" style={{ display: 'none' }}>☰</button>
            <span className="badge badge-warning">🛡️ Admin Mode</span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <a href="/dashboard" className="btn btn-ghost btn-sm">← Dashboard</a>
            <button onClick={() => signOut({ callbackUrl: '/login' })} className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}>Sign Out</button>
          </div>
        </header>

        <div style={{ flex: 1, padding: '2rem 1.5rem' }}>
          {children}
        </div>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          main { margin-left: 0 !important; }
          header button { display: flex !important; }
        }
      `}</style>
    </div>
  );
}
