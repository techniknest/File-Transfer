'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function HowItWorksPage() {
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
              How It Works
            </h1>
            <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>
              Simple, fast, and secure file transfer in 3 easy steps
            </p>
          </div>

          <div className={`stagger ${mounted ? 'animate-fade-up' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginBottom: '6rem' }}>
            {[
              { step: '01', icon: '📁', title: 'Select Your Files', desc: 'Login to your account and click Send Files. Select one or multiple files from your device. Any file type, any size is supported.', color: 'blue' },
              { step: '02', icon: '🔗', title: 'Get Transfer Link', desc: 'A unique secure link is generated instantly. Share this link with anyone you want to send files to — via WhatsApp, email, or any other way.', color: 'purple' },
              { step: '03', icon: '⚡', title: 'Direct Transfer', desc: 'The receiver opens the link and clicks Receive. Files transfer directly from your device to theirs — no server, no cloud, just pure P2P.', color: 'green' },
            ].map((s, i) => (
              <div key={i} className="glass-card card-hover" style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', padding: '2.5rem' }}>
                <div style={{ fontSize: '4rem', fontWeight: 900, color: 'rgba(99,102,241,0.2)', lineHeight: 1 }}>
                  {s.step}
                </div>
                <div>
                  <div style={{ fontSize: '2.5rem', marginBottom: '1rem', filter: 'drop-shadow(0 4px 12px rgba(99,102,241,0.3))' }}>{s.icon}</div>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>{s.title}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: 1.6 }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className={mounted ? 'animate-fade-up' : ''} style={{ animationDelay: '300ms', textAlign: 'center', marginBottom: '5rem' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '3rem' }}>The Technology Behind It</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
              {[
                { icon: '🌐', title: 'WebRTC', desc: 'Direct peer-to-peer connection between browsers — no central server bottleneck.' },
                { icon: '🔒', title: 'End-to-End Encryption', desc: 'All data is encrypted via WebRTC standard DTLS/SRTP before leaving your device.' },
                { icon: '📡', title: 'TURN/STUN Servers', desc: 'Smart relay servers help establish the connection smoothly even across complex networks or strict NATs.' },
              ].map((t, i) => (
                <div key={i} className="card card-hover" style={{ padding: '2rem' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '1rem', filter: 'drop-shadow(0 4px 12px rgba(99,102,241,0.3))' }}>{t.icon}</div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{t.title}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>{t.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className={`glass-card ${mounted ? 'animate-fade-up' : ''}`} style={{ animationDelay: '400ms', padding: '4rem 2rem', textAlign: 'center', background: 'linear-gradient(135deg, rgba(99,102,241,0.05), rgba(139,92,246,0.1))' }}>
            <h2 style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>Ready to Try?</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginBottom: '2rem' }}>Start transferring files in seconds — completely free!</p>
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