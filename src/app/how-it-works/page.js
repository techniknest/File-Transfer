'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import {
  Upload, Link as LinkIcon, Download, Globe, Lock, Radio,
  ArrowRight, Rocket, ChevronRight, Wifi, Server, Database,
  MonitorSmartphone, CheckCircle, Clock, Zap
} from 'lucide-react';

const SENDER_STEPS = [
  {
    num: '01', icon: <Upload size={32} />, title: 'Select Your Files',
    detail: [
      'Log in to your account and navigate to the Dashboard.',
      'Click "Send Files" to open the file selection view.',
      'Click the drop zone or drag & drop one or multiple files of any type.',
      'Your selected files appear in a list with names and sizes.',
    ],
    color: '#6366f1',
  },
  {
    num: '02', icon: <LinkIcon size={32} />, title: 'Generate Transfer Link',
    detail: [
      'Once all files are selected, click "Generate Transfer Link".',
      'A unique room ID is created and a secure Socket.io room is opened.',
      'The transfer link is displayed — copy it with one click.',
      'Optionally add more files using the "Add More Files" button.',
    ],
    color: '#8b5cf6',
  },
  {
    num: '03', icon: <Zap size={32} />, title: 'Wait & Transfer',
    detail: [
      'A spinner shows "Waiting for receiver to join…".',
      'Share the link via any channel: chat, email, QR code.',
      'When receiver joins, WebRTC negotiation happens automatically.',
      'File streaming begins — do not close your tab until complete.',
    ],
    color: '#10b981',
  },
];

const RECEIVER_STEPS = [
  {
    num: 'A', icon: <Globe size={32} />, title: 'Open the Link',
    detail: [
      'Open the transfer link in any modern browser.',
      'No login or registration required.',
      'The room code is automatically extracted from the URL.',
    ],
    color: '#06b6d4',
  },
  {
    num: 'B', icon: <Download size={32} />, title: 'Click Start Receiving',
    detail: [
      'Click the large "Start Receiving" button.',
      'The browser connects to the signaling server.',
      'WebRTC peer connection is established with the sender.',
    ],
    color: '#10b981',
  },
  {
    num: 'C', icon: <CheckCircle size={32} />, title: 'Live Download',
    detail: [
      'Each file begins downloading the moment the sender sends it.',
      'Live progress bar shows speed, ETA, and file name.',
      'Each file auto-saves to your downloads when fully received.',
      'Completion screen shows all received files with save buttons.',
    ],
    color: '#22c55e',
  },
];

const TECH = [
  {
    icon: <Globe size={36} />, title: 'WebRTC DataChannels',
    desc: 'WebRTC provides browser-native P2P communication. DataChannels carry binary file chunks directly between peers with no relay needed in most networks.',
    color: '#6366f1',
  },
  {
    icon: <Lock size={36} />, title: 'DTLS/SRTP Encryption',
    desc: 'All WebRTC DataChannels are encrypted with DTLS by default. Data cannot be intercepted in transit — even our servers cannot read it.',
    color: '#8b5cf6',
  },
  {
    icon: <Radio size={36} />, title: 'STUN / TURN Servers',
    desc: 'STUN servers help discover public IPs. TURN servers relay traffic when direct P2P is blocked by strict NATs or firewalls, ensuring transfers always succeed.',
    color: '#06b6d4',
  },
  {
    icon: <Server size={36} />, title: 'Socket.io Signaling',
    desc: 'Lightweight Socket.io websocket events handle room creation, offer/answer exchange, and ICE candidate signaling — no file data ever passes through.',
    color: '#10b981',
  },
  {
    icon: <Database size={36} />, title: 'MongoDB Atlas',
    desc: 'Transfer metadata (room IDs, file names, sizes) is stored in MongoDB Atlas for admin audit trails. File contents are never stored.',
    color: '#f59e0b',
  },
  {
    icon: <MonitorSmartphone size={36} />, title: 'Browser Native',
    desc: 'Runs entirely in the browser using standard Web APIs — FileReader, Blob, URL.createObjectURL. No plugins, no downloads, no native app required.',
    color: '#ef4444',
  },
];

export default function HowItWorksPage() {
  const [mounted, setMounted] = useState(false);
  const [activeRole, setActiveRole] = useState('sender');
  useEffect(() => { setMounted(true); }, []);

  const steps = activeRole === 'sender' ? SENDER_STEPS : RECEIVER_STEPS;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Navbar />

      <main style={{ flex: 1, paddingTop: '120px', paddingBottom: '80px', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>

          {/* ── Hero ── */}
          <div className={mounted ? 'animate-fade-in' : ''} style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: '999px', padding: '0.4rem 1rem',
              color: '#818cf8', fontSize: '0.8rem', fontWeight: 600, marginBottom: '1.5rem',
            }}>
              <Zap size={14} /> Simple · Fast · Encrypted
            </div>
            <h1 className="gradient-hero animate-gradient" style={{
              fontSize: 'clamp(2rem, 4vw, 3.2rem)', fontWeight: 900, letterSpacing: '-0.02em',
              marginBottom: '1.25rem', WebkitBackgroundClip: 'text',
              backgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              How It Works
            </h1>
            <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
              A step-by-step visual guide for both sender and receiver — no cloud, no upload, just direct P2P.
            </p>
          </div>

          {/* ── Role Toggle ── */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '3rem' }}>
            <div style={{
              display: 'flex', background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)', borderRadius: '0.875rem',
              padding: '0.25rem', gap: '0.25rem',
            }}>
              {[
                { key: 'sender', label: 'I am Sending', icon: <Upload size={16} /> },
                { key: 'receiver', label: 'I am Receiving', icon: <Download size={16} /> },
              ].map(r => (
                <button
                  key={r.key}
                  onClick={() => setActiveRole(r.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.625rem 1.25rem', borderRadius: '0.625rem',
                    border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
                    transition: 'all 0.2s',
                    background: activeRole === r.key
                      ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                      : 'transparent',
                    color: activeRole === r.key ? 'white' : 'var(--text-secondary)',
                    boxShadow: activeRole === r.key ? '0 4px 12px rgba(99,102,241,0.35)' : 'none',
                  }}
                >
                  {r.icon} {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Steps Timeline ── */}
          <div className={mounted ? 'animate-fade-up' : ''} style={{ marginBottom: '6rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {steps.map((s, i) => (
                <div key={`${activeRole}-${i}`} style={{ display: 'flex', gap: '1.5rem', position: 'relative' }}>
                  {/* Timeline connector */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{
                      width: '56px', height: '56px', borderRadius: '50%',
                      background: `linear-gradient(135deg, ${s.color}, ${s.color}bb)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', boxShadow: `0 4px 20px ${s.color}50`,
                      flexShrink: 0, position: 'relative', zIndex: 1,
                    }}>
                      {s.icon}
                    </div>
                    {i < steps.length - 1 && (
                      <div style={{
                        width: '2px', flex: 1, minHeight: '2rem',
                        background: `linear-gradient(180deg, ${s.color}60, ${steps[i + 1].color}30)`,
                        margin: '0.5rem 0',
                      }} />
                    )}
                  </div>

                  {/* Content */}
                  <div className="glass-card card-hover" style={{ flex: 1, padding: '1.75rem', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                      <span style={{
                        fontSize: '2rem', fontWeight: 900,
                        color: `${s.color}30`, lineHeight: 1, userSelect: 'none',
                      }}>{s.num}</span>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{s.title}</h3>
                    </div>
                    <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {s.detail.map((d, j) => (
                        <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                          <ChevronRight size={16} style={{ color: s.color, flexShrink: 0, marginTop: '0.15rem' }} />
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Technology ── */}
          <div className={mounted ? 'animate-fade-up' : ''} style={{ animationDelay: '200ms', marginBottom: '5rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
              <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                The Technology Behind It
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
                Open standards powering every P2P transfer
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
              {TECH.map((t, i) => (
                <div key={i} className="card card-hover" style={{ padding: '1.75rem' }}>
                  <div style={{
                    width: '52px', height: '52px', borderRadius: '14px',
                    background: `linear-gradient(135deg, ${t.color}25, ${t.color}10)`,
                    border: `1px solid ${t.color}35`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: t.color, marginBottom: '1rem',
                    boxShadow: `0 4px 16px ${t.color}20`,
                  }}>
                    {t.icon}
                  </div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{t.title}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>{t.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── CTA ── */}
          <div className={`glass-card ${mounted ? 'animate-fade-up' : ''}`}
            style={{
              animationDelay: '400ms', padding: '4rem 2rem', textAlign: 'center',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(139,92,246,0.1))',
            }}>
            <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>
              Ready to Try It?
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '2.5rem', maxWidth: '400px', margin: '0 auto 2.5rem' }}>
              Start transferring files in seconds — completely free, no cloud.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/register" className="btn btn-primary btn-lg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Rocket size={20} /> Get Started Free
              </Link>
              <Link href="/faq" className="btn btn-secondary btn-lg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                View FAQ <ArrowRight size={18} />
              </Link>
            </div>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}