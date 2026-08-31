'use client';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTheme } from '../components/ThemeProvider';
import {
  LayoutDashboard, Users, FileText, Activity, Shield,
  Moon, Sun, ArrowLeft, Menu, Star, Settings, MessageSquare
} from 'lucide-react';

const ADMIN_NAV = [
  { href: '/admin', label: 'Dashboard', icon: <LayoutDashboard size={20} />, exact: true },
  { href: '/admin/logs', label: 'System Logs', icon: <Activity size={20} /> },
  { href: '/admin/users', label: 'Users', icon: <Users size={20} /> },
  { href: '/admin/transfers', label: 'Transfers', icon: <FileText size={20} /> },
  { href: '/admin/reviews', label: 'Reviews', icon: <Star size={20} /> },
  { href: '/admin/complaints', label: 'Complaints', icon: <MessageSquare size={20} /> },
  { href: '/admin/health', label: 'System Health', icon: <Activity size={20} /> },
  { href: '/admin/settings', label: 'Settings', icon: <Settings size={20} /> },
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

  // Show spinner while loading session
  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '3px solid rgba(245,158,11,0.2)', borderTop: '3px solid #f59e0b', borderRadius: '50%', margin: '0 auto 1rem', animation: 'spin 1s linear infinite' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Loading admin panel...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // If authenticated but not admin, redirect is handled by useEffect above
  if (status === 'authenticated' && session?.user?.role !== 'admin') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', border: '3px solid rgba(245,158,11,0.2)', borderTop: '3px solid #f59e0b', borderRadius: '50%', margin: '0 auto 1rem', animation: 'spin 1s linear infinite' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Redirecting...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const isActive = (item) => {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + '/');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex' }}>
      {/* Sidebar overlay — mobile only */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99 }}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} style={{ zIndex: 100 }}>
        <div style={{ padding: '1.5rem 1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.5rem', padding: '0 0.25rem' }}>
            <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Shield size={18} className="text-white" />
            </div>
            <div>
              <p style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '1rem', lineHeight: 1.2 }}>Admin Panel</p>
              <p style={{ color: '#f59e0b', fontSize: '0.7rem', fontWeight: 600 }}>P2P Transfer</p>
            </div>
          </div>

          <div className="divider" style={{ marginBottom: '1.25rem', marginTop: '1rem' }} />

          {/* Nav */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem', flex: 1 }}>
            {ADMIN_NAV.map(item => {
              const active = isActive(item);
              return (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className="sidebar-nav-item"
                  style={{
                    color: active ? '#f59e0b' : undefined,
                    background: active ? 'rgba(245,158,11,0.1)' : undefined,
                    borderColor: active ? 'rgba(245,158,11,0.2)' : undefined,
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center' }}>{item.icon}</span>
                  {item.label}
                </a>
              );
            })}

            <div className="divider" style={{ margin: '0.75rem 0' }} />
            <a href="/dashboard" className="sidebar-nav-item" onClick={() => setSidebarOpen(false)}>
              <span style={{ display: 'flex', alignItems: 'center' }}><ArrowLeft size={18} /></span>
              Back to App
            </a>
          </nav>
        </div>

        {/* User section */}
        <div style={{ padding: '1rem', borderTop: '1px solid var(--border-default)' }}>
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
            <button onClick={toggleTheme} className="btn btn-ghost btn-sm" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <button onClick={() => signOut({ callbackUrl: '/login' })} className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', flex: 1 }}>
              Exit
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, marginLeft: '256px', minHeight: '100vh', display: 'flex', flexDirection: 'column' }} className="main-with-sidebar">
        {/* Header */}
        <header style={{
          background: 'var(--bg-glass)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--border-glass)',
          padding: '0 2rem',
          height: '72px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={() => setSidebarOpen(true)}
              className="btn btn-ghost btn-icon mobile-menu-btn"
              aria-label="Open sidebar"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
            >
              <Menu size={20} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(245,158,11,0.1)', padding: '0.4rem 0.8rem', borderRadius: '999px', border: '1px solid rgba(245,158,11,0.2)' }}>
              <Shield size={16} color="#f59e0b" />
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f59e0b', letterSpacing: '0.02em' }}>Admin Mode</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <a href="/admin/settings" className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
              <Settings size={16} /> <span className="hide-mobile">Settings</span>
            </a>
            <a href="/dashboard" className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
              <ArrowLeft size={16} /> <span className="hide-mobile">Back to App</span>
            </a>
            <button onClick={() => signOut({ callbackUrl: '/login' })} className="btn btn-primary btn-sm" style={{ marginLeft: '0.5rem' }}>
              Sign Out
            </button>
          </div>
        </header>

        <div style={{ flex: 1, padding: '1.5rem 1.5rem' }} className="admin-content">
          {children}
        </div>
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .mobile-menu-btn { display: none; }
        .hide-mobile { display: inline; }
        @media (max-width: 768px) {
          main { margin-left: 0 !important; }
          .mobile-menu-btn { display: flex !important; }
          .hide-mobile { display: none !important; }
          .admin-content { padding: 1rem !important; }
        }
        @media (max-width: 480px) {
          .admin-content { padding: 0.75rem !important; }
        }
      `}</style>
    </div>
  );
}
