'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';

export default function HomePage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Navbar />

      {/* Hero Section */}
      <section style={{ position: 'relative', overflow: 'hidden', padding: '160px 1.5rem 80px', textAlign: 'center' }}>
        {/* Animated background highlights */}
        <div style={{
          position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)',
          width: '600px', height: '600px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(99,102,241,0) 70%)',
          filter: 'blur(50px)', pointerEvents: 'none', zIndex: 0
        }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: '800px', margin: '0 auto' }} className={`stagger ${mounted ? 'animate-fade-in' : ''}`}>
          <div className="badge badge-primary animate-fade-up" style={{ marginBottom: '1.5rem' }}>
            <span className="status-dot online" style={{ width: 6, height: 6, marginRight: 4 }}></span>
            No Cloud • No Storage Limits • Fully Encrypted
          </div>

          <h1 className="gradient-hero animate-gradient" style={{
            fontSize: 'calc(2rem + 3vw)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.15,
            color: 'var(--text-primary)', marginBottom: '1.5rem', WebkitBackgroundClip: 'text',
            backgroundClip: 'text', textFillColor: 'transparent', WebkitTextFillColor: 'transparent'
          }}>
            Direct Peer-to-Peer File Transfer
          </h1>

          <p style={{ fontSize: 'calc(1rem + 0.3vw)', color: 'var(--text-secondary)', marginBottom: '2.5rem', lineHeight: 1.6, maxWidth: '600px', margin: '0 auto 2.5rem' }}>
            Share files of any size directly from your device to the receiver. Pure WebRTC connection without uploading to cloud servers.
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/register" className="btn btn-primary btn-lg">
              🚀 Start Transferring Free
            </Link>
            <Link href="/how-it-works" className="btn btn-secondary btn-lg">
              Learn More
            </Link>
          </div>
        </div>
      </section>

      {/* Statistics counters */}
      <section style={{ padding: '3rem 1.5rem', background: 'var(--bg-surface)', borderTop: '1px solid var(--border-default)', borderBottom: '1px solid var(--border-default)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem', textAlign: 'center' }}>
          {[
            { value: '0 GB', label: 'Storage Used' },
            { value: '< 10ms', label: 'Connection Latency' },
            { value: '100%', label: 'P2P Transfer Security' },
            { value: 'Unlimited', label: 'Maximum File Size' }
          ].map((stat, idx) => (
            <div key={idx} className="animate-fade-up">
              <p style={{ fontSize: '2.2rem', fontWeight: 800, color: '#818cf8', marginBottom: '0.25rem' }}>{stat.value}</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Core Features list */}
      <section style={{ padding: '80px 1.5rem' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center', marginBottom: '3rem' }}>
            Engineered for Maximum Speed & Privacy
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
            {[
              { icon: '🔒', title: 'End-to-End Secure', desc: 'Signaling coordinates connection details but actual data flows directly between browsers via secure Datachannels.' },
              { icon: '⚡', title: 'Speed Limitless', desc: 'Transfer speeds are governed strictly by your client and recipient ISP capacities—no throttling limits.' },
              { icon: '📁', title: 'Real-time Streaming', desc: 'Receiver starts compiling and downloading the payload instantly as the sender streams chunks live.' },
              { icon: '💻', title: 'Device Agnostic', desc: 'Runs entirely in the web browser. No plugins, no installers, no mobile packages necessary.' },
              { icon: '🔗', title: '24 Hour Lifespan', desc: 'Lobby signaling configurations expire securely after 24 hours. Rooms clean up automatically.' },
              { icon: '➕', title: 'On-the-fly Batching', desc: 'Add files to an active room session dynamically without renegotiating candidate handshakes.' }
            ].map((f, idx) => (
              <div key={idx} className="card card-hover" style={{ padding: '2rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>{f.icon}</div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{f.title}</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Box */}
      <section style={{ padding: '60px 1.5rem 100px' }}>
        <div className="glass-card" style={{ maxWidth: '900px', margin: '0 auto', padding: '3.5rem 2rem', textAlign: 'center', border: '1px solid rgba(99,102,241,0.2)' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>
            Ready to experience next-gen sharing?
          </h2>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '2rem', maxWidth: '500px', margin: '0 auto 2rem' }}>
            Create a free account to generate sharing links, review past transfer reports, and access admin dashboard tools.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/register" className="btn btn-primary btn-lg">
              Get Started Instantly
            </Link>
            <Link href="/login" className="btn btn-secondary btn-lg">
              Sign In to Dashboard
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}