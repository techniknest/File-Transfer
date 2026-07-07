'use client';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Rocket, Lock, Lightbulb, Shield, Zap, Users, Globe, Heart, Star, ArrowRight, CheckCircle } from 'lucide-react';

function useCountUp(target, duration = 1800, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start || typeof target !== 'number') return;
    let startTime = null;
    const step = (ts) => {
      if (!startTime) startTime = ts;
      const p = Math.min((ts - startTime) / duration, 1);
      const eased = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
      setCount(Math.floor(eased * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return count;
}

function AnimatedStat({ value, suffix, label, start }) {
  const num = useCountUp(value, 1600, start);
  return (
    <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
      <p style={{
        fontSize: '2.6rem', fontWeight: 900,
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        backgroundClip: 'text', marginBottom: '0.4rem', lineHeight: 1,
      }}>
        {typeof value === 'number' ? `${num}${suffix || ''}` : value}
      </p>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</p>
    </div>
  );
}

export default function AboutPage() {
  const [mounted, setMounted] = useState(false);
  const statsRef = useRef(null);
  const [statsVisible, setStatsVisible] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!statsRef.current) return;
    const observer = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStatsVisible(true); }, { threshold: 0.3 });
    observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, [mounted]);

  const values = [
    {
      icon: <Shield size={40} />, title: 'Privacy First',
      desc: 'Your data is yours. Files never touch our servers. WebRTC encryption ensures data only travels between you and the receiver.',
    },
    {
      icon: <Zap size={40} />, title: 'Speed Without Compromise',
      desc: 'Direct P2P transfers mean no upload bottlenecks. You transfer at the full speed of your internet connection.',
    },
    {
      icon: <Lightbulb size={40} />, title: 'Radical Simplicity',
      desc: 'No installs, no plugins, no configuration. Just a link. File sharing should be that simple — and now it is.',
    },
  ];

  const teamMembers = [
    { name: 'TechniKnest', role: 'Core Engineering', initials: 'TK', desc: 'The team behind P2P Transfer — passionate about privacy-first, real-time web tech.' },
    { name: 'WebRTC Team', role: 'Protocol & Signaling', initials: 'WR', desc: 'Specialists in STUN/TURN infrastructure, data channels, and low-latency P2P connectivity.' },
    { name: 'UI/UX Guild', role: 'Design & Experience', initials: 'UX', desc: 'Crafting interfaces that feel premium, responsive, and instantly intuitive for every user.' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Navbar />

      <main style={{ flex: 1, paddingTop: '120px', paddingBottom: '80px', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>

          {/* ── Hero ── */}
          <div className={mounted ? 'animate-fade-in' : ''} style={{ textAlign: 'center', marginBottom: '5rem' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: '999px', padding: '0.4rem 1rem',
              color: '#818cf8', fontSize: '0.8rem', fontWeight: 600, marginBottom: '1.5rem',
            }}>
              <Heart size={14} /> Built with purpose by TechniKnest
            </div>
            <h1 className="gradient-hero animate-gradient" style={{
              fontSize: 'clamp(2.2rem, 4vw, 3.5rem)', fontWeight: 900, letterSpacing: '-0.02em',
              marginBottom: '1.5rem', WebkitBackgroundClip: 'text',
              backgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              About P2P Transfer
            </h1>
            <p style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', maxWidth: '640px', margin: '0 auto', lineHeight: 1.7 }}>
              We believe file sharing should be fast, private, and free — without compromising your data or requiring
              complex cloud infrastructure.
            </p>
          </div>

          {/* ── Mission ── */}
          <div className={`glass-card ${mounted ? 'animate-fade-up' : ''}`}
            style={{ padding: '3rem', marginBottom: '4rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '3rem', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1.25rem' }}>Our Mission</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: 1.7, marginBottom: '1rem' }}>
                P2P Transfer was built to solve a simple problem — why should your files pass through a third-party server
                just to reach someone else?
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: 1.7, marginBottom: '1.5rem' }}>
                Using WebRTC DataChannels, we enable direct device-to-device file streaming. Your data travels encrypted,
                at full speed, and never lands on our infrastructure.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {[
                  'Files go directly from sender to receiver',
                  'Zero data stored on our servers',
                  'DTLS/SRTP WebRTC encryption standard',
                  'Free forever — no account needed to receive',
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <CheckCircle size={16} style={{ color: '#10b981', flexShrink: 0 }} />
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats grid */}
            <div ref={statsRef} style={{ background: 'var(--bg-elevated)', borderRadius: '1.25rem', padding: '2rem', border: '1px solid var(--border-default)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                {[
                  { value: '100', suffix: '%', label: 'Private Transfers' },
                  { value: 'Zero', label: 'Server Storage' },
                  { value: 'None', label: 'File Size Limit' },
                  { value: 'Free', label: 'Cost Forever' },
                ].map((s, i) => (
                  <div key={i} style={{
                    background: 'var(--bg-glass)', border: '1px solid var(--border-subtle)',
                    borderRadius: '1rem', padding: '1.25rem 1rem', textAlign: 'center',
                  }}>
                    <AnimatedStat value={typeof s.value === 'string' && !isNaN(parseInt(s.value)) ? parseInt(s.value) : s.value} suffix={s.suffix} label={s.label} start={statsVisible} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Values ── */}
          <div className={mounted ? 'animate-fade-up' : ''} style={{ animationDelay: '150ms', marginBottom: '5rem' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center', marginBottom: '0.75rem' }}>Our Values</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', textAlign: 'center', marginBottom: '3rem' }}>
              The principles that guide every decision we make
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
              {values.map((item, i) => (
                <div key={i} className="card card-hover" style={{ padding: '2rem' }}>
                  <div style={{
                    width: '60px', height: '60px', borderRadius: '16px',
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.1))',
                    border: '1px solid rgba(99,102,241,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#818cf8', marginBottom: '1.25rem',
                    filter: 'drop-shadow(0 4px 12px rgba(99,102,241,0.25))',
                  }}>
                    {item.icon}
                  </div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.6rem' }}>{item.title}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Team ── */}
          <div className={mounted ? 'animate-fade-up' : ''} style={{ animationDelay: '200ms', marginBottom: '5rem' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center', marginBottom: '0.75rem' }}>
              Built by TechniKnest
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', textAlign: 'center', marginBottom: '3rem' }}>
              A passionate team dedicated to innovative, privacy-first tech solutions
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
              {teamMembers.map((m, i) => (
                <div key={i} className="glass-card card-hover" style={{ padding: '2rem' }}>
                  <div style={{
                    width: '56px', height: '56px', borderRadius: '50%',
                    background: `linear-gradient(135deg, hsl(${240 + i * 30}, 70%, 55%), hsl(${260 + i * 30}, 70%, 45%))`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontWeight: 800, fontSize: '1rem',
                    marginBottom: '1rem', boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
                  }}>
                    {m.initials}
                  </div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{m.name}</h3>
                  <p style={{ color: '#818cf8', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.75rem' }}>{m.role}</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>{m.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── CTA ── */}
          <div className={`glass-card ${mounted ? 'animate-fade-up' : ''}`}
            style={{ animationDelay: '300ms', padding: '4rem 2rem', textAlign: 'center', background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(139,92,246,0.1))' }}>
            <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>Ready to Transfer?</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', marginBottom: '2.5rem', maxWidth: '450px', margin: '0 auto 2.5rem' }}>
              Join users who trust P2P Transfer for secure, instant file sharing.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/register" className="btn btn-primary btn-lg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Rocket size={20} /> Get Started Free
              </Link>
              <Link href="/how-it-works" className="btn btn-secondary btn-lg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Learn How It Works <ArrowRight size={18} />
              </Link>
            </div>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}