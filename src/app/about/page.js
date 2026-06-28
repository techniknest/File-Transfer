'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function AboutPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />

      <main style={{ flex: 1, paddingTop: '120px', paddingBottom: '80px', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          
          <div className={`stagger ${mounted ? 'animate-fade-in' : ''}`} style={{ textAlign: 'center', marginBottom: '5rem' }}>
            <h1 className="gradient-hero animate-gradient" style={{
              fontSize: 'calc(2.5rem + 2vw)', fontWeight: 900, letterSpacing: '-0.02em',
              color: 'var(--text-primary)', marginBottom: '1.5rem', WebkitBackgroundClip: 'text',
              backgroundClip: 'text', textFillColor: 'transparent', WebkitTextFillColor: 'transparent'
            }}>
              About P2P Transfer
            </h1>
            <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', maxWidth: '650px', margin: '0 auto', lineHeight: 1.6 }}>
              We believe file sharing should be fast, private, and free — without compromising your data or requiring complex setups.
            </p>
          </div>

          {/* Mission */}
          <div className={`glass-card ${mounted ? 'animate-fade-up' : ''}`} style={{ padding: '3rem', marginBottom: '4rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '3rem', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1.5rem' }}>Our Mission</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: 1.6, marginBottom: '1rem' }}>
                P2P Transfer was built to solve a simple problem — why should your files go through a third-party server just to reach someone?
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: 1.6 }}>
                Using WebRTC technology, we enable direct device-to-device transfers. Your files travel directly from you to the receiver — encrypted, fast, and completely private.
              </p>
            </div>
            
            <div style={{ background: 'var(--bg-elevated)', borderRadius: '1rem', padding: '2rem', border: '1px solid var(--border-default)' }}>
              {[
                { label: 'Files Transferred', value: '100% Private' },
                { label: 'Server Storage', value: 'Zero' },
                { label: 'File Size Limit', value: 'None' },
                { label: 'Cost', value: 'Free Forever' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: i < 3 ? '1px solid var(--border-subtle)' : 'none', marginBottom: i < 3 ? '1rem' : 0 }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{item.label}</span>
                  <span className="gradient-text" style={{ fontWeight: 800 }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Team */}
          <div className={mounted ? 'animate-fade-up' : ''} style={{ animationDelay: '150ms', textAlign: 'center', marginBottom: '5rem' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>Built by TechniKnest</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', marginBottom: '3rem' }}>
              A passionate team dedicated to building innovative, privacy-first tech solutions.
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
              {[
                { icon: '🚀', title: 'Innovation First', desc: 'We build solutions that push boundaries.' },
                { icon: '🔐', title: 'Privacy Focused', desc: 'Your data belongs to you, always.' },
                { icon: '💡', title: 'Open & Transparent', desc: 'Simple, honest technology for everyone.' },
              ].map((item, i) => (
                <div key={i} className="card card-hover" style={{ padding: '2rem' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '1rem', filter: 'drop-shadow(0 4px 12px rgba(99,102,241,0.3))' }}>{item.icon}</div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{item.title}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className={`glass-card ${mounted ? 'animate-fade-up' : ''}`} style={{ animationDelay: '300ms', padding: '4rem 2rem', textAlign: 'center', background: 'linear-gradient(135deg, rgba(99,102,241,0.05), rgba(139,92,246,0.1))' }}>
            <h2 style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>Ready to Transfer?</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginBottom: '2rem' }}>Join thousands of users who trust P2P Transfer.</p>
            <Link href="/register" className="btn btn-primary btn-lg" style={{ fontSize: '1.1rem', padding: '1rem 2.5rem' }}>
              Get Started Free
            </Link>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}