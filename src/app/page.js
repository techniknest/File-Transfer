'use client';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import {
  Rocket, Shield, Zap, FolderSync, Laptop, Link as LinkIcon,
  Plus, Upload, Download, Lock, CloudOff, Package, Globe,
  ArrowRight, CheckCircle, Star, Users, Activity, Clock, Wifi
} from 'lucide-react';

function useCountUp(target, duration = 1800, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime = null;
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return count;
}

function StatCounter({ value, label, suffix = '' }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const num = useCountUp(typeof value === 'number' ? value : 0, 1600, visible);

  useEffect(() => {
    const observer = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.3 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ textAlign: 'center' }}>
      <p style={{ fontSize: '2.4rem', fontWeight: 800, color: '#818cf8', marginBottom: '0.25rem', lineHeight: 1 }}>
        {typeof value === 'number' ? `${num}${suffix}` : value}
      </p>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{label}</p>
    </div>
  );
}

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState({ totalDataFormatted: '0 GB', totalUsers: 0 });
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    setMounted(true);
    fetch('/api/stats/public')
      .then(r => r.json())
      .then(data => { if (!data.error) setStats(data); })
      .catch(e => console.log(e));
    
    fetch('/api/reviews?limit=3')
      .then(r => r.json())
      .then(data => { if (!data.error) setReviews(data.reviews || []); })
      .catch(e => console.log(e));
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Navbar />

      {/* ── Hero ── */}
      <section style={{ position: 'relative', overflow: 'hidden', padding: '0 1.5rem', textAlign: 'center', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{
          position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)',
          width: '700px', height: '700px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, rgba(139,92,246,0.06) 50%, transparent 70%)',
          filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0,
        }} />
        <div style={{
          position: 'absolute', top: '20%', right: '5%',
          width: '300px', height: '300px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)',
          filter: 'blur(40px)', pointerEvents: 'none', zIndex: 0,
        }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: '820px', margin: '0 auto' }}
          className={mounted ? 'animate-fade-in' : ''}>
          <div className="badge badge-primary" style={{ marginBottom: '1.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <span className="status-dot online" style={{ width: 6, height: 6 }} />
            No Cloud Storage · No Size Limits · End-to-End Encrypted
          </div>

          <h1 className="gradient-hero animate-gradient" style={{
            fontSize: 'clamp(2.2rem, 5vw, 4rem)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1,
            marginBottom: '1.5rem', WebkitBackgroundClip: 'text',
            backgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Direct Peer-to-Peer<br />File Transfer
          </h1>

          <p style={{
            fontSize: 'clamp(1rem, 2vw, 1.2rem)', color: 'var(--text-secondary)',
            marginBottom: '2.5rem', lineHeight: 1.7, maxWidth: '600px', margin: '0 auto 2.5rem',
          }}>
            Share files of any size directly from your device to the receiver — no upload, no cloud, no limits.
            Pure WebRTC connection with DTLS encryption.
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/register" className="btn btn-primary btn-lg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Rocket size={20} /> Start Transferring Free
            </Link>
            <Link href="/how-it-works" className="btn btn-secondary btn-lg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              How It Works <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section style={{ padding: '3rem 1.5rem', background: 'var(--bg-surface)', borderTop: '1px solid var(--border-default)', borderBottom: '1px solid var(--border-default)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '2rem' }}>
          <StatCounter value={stats.totalDataFormatted} label="Data Transferred" />
          <StatCounter value={100} suffix="%" label="P2P Encrypted" />
          <StatCounter value={stats.totalUsers} label="Registered Users" />
          <StatCounter value="None" label="Size Limits" />
        </div>
      </section>

      {/* ── How It Works ── */}
      <section style={{ padding: '90px 1.5rem', background: 'var(--bg-base)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>
              How It Works
            </h2>
            <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)' }}>
              Three steps from sender to receiver — no cloud, no waiting
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem' }}>
            {[
              {
                step: '01', icon: <Upload size={36} />, title: 'Select Your Files',
                desc: 'Choose one or many files from your device — any type, any size. Drag & drop supported.',
                color: '#6366f1',
              },
              {
                step: '02', icon: <LinkIcon size={36} />, title: 'Generate Transfer Link',
                desc: 'Click "Generate Transfer Link" to create a unique, secure room. Copy and share the link.',
                color: '#8b5cf6',
              },
              {
                step: '03', icon: <Download size={36} />, title: 'Live Direct Transfer',
                desc: 'Receiver opens the link, clicks Start Receiving. Files stream P2P — no cloud in between.',
                color: '#10b981',
              },
            ].map((s, i) => (
              <div key={i} className="card card-hover" style={{ padding: '2rem', position: 'relative', overflow: 'hidden' }}>
                <div style={{
                  position: 'absolute', top: '1rem', right: '1.25rem',
                  fontSize: '4rem', fontWeight: 900, color: `${s.color}18`, lineHeight: 1, userSelect: 'none',
                }}>
                  {s.step}
                </div>
                <div style={{
                  width: '56px', height: '56px', borderRadius: '14px',
                  background: `linear-gradient(135deg, ${s.color}33, ${s.color}15)`,
                  border: `1px solid ${s.color}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: s.color, marginBottom: '1.25rem',
                  boxShadow: `0 4px 16px ${s.color}25`,
                }}>
                  {s.icon}
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.6rem' }}>{s.title}</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Grid ── */}
      <section style={{ padding: '80px 1.5rem', background: 'var(--bg-surface)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>
              Engineered for Speed &amp; Privacy
            </h2>
            <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)' }}>
              Every feature designed to keep your files off third-party servers
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {[
              { icon: <Package size={28} />, title: 'No Size Limit', desc: 'Transfer files of any size — from 1 KB to 100 GB. The only limit is your available memory.' },
              { icon: <Lock size={28} />, title: 'End-to-End Encrypted', desc: 'WebRTC DTLS/SRTP encryption ensures data never leaves your device in plaintext.' },
              { icon: <Zap size={28} />, title: 'Instant Transfer', desc: 'No upload wait. Data streams directly at your full ISP speed — both directions simultaneously.' },
              { icon: <CloudOff size={28} />, title: 'No Cloud Storage', desc: 'Files are never stored on our servers. Zero data retention — the transfer is yours alone.' },
              { icon: <FolderSync size={28} />, title: 'Multi-File Batching', desc: 'Select and transfer entire folders of files in one session. Add more files mid-transfer.' },
              { icon: <Globe size={28} />, title: 'Free Forever', desc: 'No subscription, no premium tier, no credit card. P2P Transfer is free for everyone, always.' },
            ].map((f, i) => (
              <div key={i} className="card card-hover" style={{ padding: '1.75rem' }}>
                <div style={{
                  width: '50px', height: '50px', borderRadius: '12px',
                  background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#818cf8', marginBottom: '1rem',
                }}>
                  {f.icon}
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{f.title}</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section style={{ padding: '90px 1.5rem', background: 'var(--bg-base)' }}>
        <div style={{ maxWidth: '1050px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <h2 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.5rem)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>
              Trusted by Professionals
            </h2>
            <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)' }}>
              Real stories from users who made the switch to P2P
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {reviews.length > 0 ? reviews.map((r, i) => (
              <div key={i} className="glass-card card-hover" style={{ padding: '2rem' }}>
                {/* Stars */}
                <div style={{ display: 'flex', gap: '0.2rem', marginBottom: '1rem' }}>
                  {Array.from({ length: r.rating }).map((_, j) => (
                    <Star key={j} size={16} style={{ fill: '#f59e0b', color: '#f59e0b' }} />
                  ))}
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.7, marginBottom: '1.5rem', fontStyle: 'italic' }}>
                  &ldquo;{r.comment}&rdquo;
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontWeight: 700, fontSize: '1rem', flexShrink: 0,
                  }}>
                    {r.userName?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <p style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '0.9rem' }}>{r.userName}</p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.78rem' }}>Verified User</p>
                  </div>
                </div>
              </div>
            )) : (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', gridColumn: '1 / -1' }}>No reviews available yet.</p>
            )}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: '60px 1.5rem 100px' }}>
        <div className="glass-card" style={{
          maxWidth: '900px', margin: '0 auto', padding: '4rem 2rem',
          textAlign: 'center', border: '1px solid rgba(99,102,241,0.2)',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(139,92,246,0.1))',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            {[
              { icon: <Shield size={18} />, label: '100% Private' },
              { icon: <CloudOff size={18} />, label: 'No Cloud' },
              { icon: <Zap size={18} />, label: 'Instant' },
            ].map((b, i) => (
              <span key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
                borderRadius: '999px', padding: '0.3rem 0.9rem',
                color: '#818cf8', fontSize: '0.8rem', fontWeight: 600,
              }}>
                {b.icon} {b.label}
              </span>
            ))}
          </div>
          <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>
            Ready to experience next-gen sharing?
          </h2>
          <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '2.5rem', maxWidth: '520px', margin: '0 auto 2.5rem', lineHeight: 1.7 }}>
            Create a free account to generate sharing links, track past transfers, and access your admin tools.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/register" className="btn btn-primary btn-lg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Rocket size={20} /> Get Started Instantly
            </Link>
            <Link href="/login" className="btn btn-secondary btn-lg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Sign In to Dashboard <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}