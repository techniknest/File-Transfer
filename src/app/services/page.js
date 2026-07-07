'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import {
  Upload, FileVideo, FileText, Database, ArrowRight, Rocket,
  Check, X, Zap, Lock, CloudOff, Globe, Package, Clock,
  Shield, Users, DollarSign, Star
} from 'lucide-react';

const USE_CASES = [
  {
    icon: <FileVideo size={36} />, title: 'Large Video Files',
    desc: 'Send 4K footage, raw recordings, or full movie files to collaborators instantly. No compression, no quality loss.',
    examples: ['Video productions', 'Raw footage to editors', '4K film delivery', 'YouTube raw uploads'],
    color: '#8b5cf6',
  },
  {
    icon: <FileText size={36} />, title: 'Documents & Data',
    desc: 'Confidential contracts, spreadsheets, legal PDFs — transferred privately without ever touching a cloud server.',
    examples: ['Legal contracts', 'Financial reports', 'Medical records', 'Research datasets'],
    color: '#6366f1',
  },
  {
    icon: <Database size={36} />, title: 'Backups & Archives',
    desc: 'Transfer full database dumps, system backups, or ZIP archives of entire projects without size restrictions.',
    examples: ['Database exports', 'Project archives', 'System image backups', 'Git repo bundles'],
    color: '#06b6d4',
  },
];

const COMPARISON = [
  { feature: 'File Size Limit', p2p: 'None', gdrive: '5 TB (paid)', wetransfer: '2 GB (free)' },
  { feature: 'Storage on Server', p2p: false, gdrive: true, wetransfer: true },
  { feature: 'Login to Receive', p2p: false, gdrive: true, wetransfer: false },
  { feature: 'End-to-End Encrypted', p2p: true, gdrive: false, wetransfer: false },
  { feature: 'Speed (no throttle)', p2p: true, gdrive: false, wetransfer: false },
  { feature: 'Free Forever', p2p: true, gdrive: false, wetransfer: false },
  { feature: 'No Cloud Upload', p2p: true, gdrive: false, wetransfer: false },
  { feature: 'Works in Browser', p2p: true, gdrive: true, wetransfer: true },
  { feature: 'Multi-file Batch', p2p: true, gdrive: true, wetransfer: true },
  { feature: 'Add Files Mid-Transfer', p2p: true, gdrive: false, wetransfer: false },
];

function CellValue({ value }) {
  if (value === true) return <Check size={18} style={{ color: '#10b981', margin: '0 auto' }} />;
  if (value === false) return <X size={18} style={{ color: '#ef4444', margin: '0 auto' }} />;
  return <span style={{ fontWeight: 600, color: '#818cf8' }}>{value}</span>;
}

export default function ServicesPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Navbar />

      <main style={{ flex: 1, paddingTop: '120px', paddingBottom: '80px', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
        <div style={{ maxWidth: '1060px', margin: '0 auto' }}>

          {/* ── Hero ── */}
          <div className={mounted ? 'animate-fade-in' : ''} style={{ textAlign: 'center', marginBottom: '5rem' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: '999px', padding: '0.4rem 1rem',
              color: '#818cf8', fontSize: '0.8rem', fontWeight: 600, marginBottom: '1.5rem',
            }}>
              <Package size={14} /> What We Offer
            </div>
            <h1 className="gradient-hero animate-gradient" style={{
              fontSize: 'clamp(2.2rem, 4vw, 3.5rem)', fontWeight: 900, letterSpacing: '-0.02em',
              marginBottom: '1.25rem', WebkitBackgroundClip: 'text',
              backgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              P2P Transfer Services
            </h1>
            <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', maxWidth: '640px', margin: '0 auto', lineHeight: 1.7 }}>
              Direct, encrypted, browser-native file transfers. No cloud middleman. No size limits. No cost.
            </p>
          </div>

          {/* ── What We Offer ── */}
          <section style={{ marginBottom: '5rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center', marginBottom: '0.75rem' }}>
              What P2P Transfer Offers
            </h2>
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '3rem' }}>
              One service, built around your privacy and speed
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
              {[
                { icon: <Upload size={24} />, title: 'Send Files', desc: 'Select files, generate a secure link, share it.', color: '#6366f1' },
                { icon: <Lock size={24} />, title: 'Encrypted Channel', desc: 'DTLS/SRTP encryption on every WebRTC channel.', color: '#8b5cf6' },
                { icon: <Zap size={24} />, title: 'Full ISP Speed', desc: 'Transfer at your maximum upload/download speed.', color: '#10b981' },
                { icon: <CloudOff size={24} />, title: 'No Cloud Storage', desc: 'Data never lands on our servers.', color: '#06b6d4' },
                { icon: <Globe size={24} />, title: 'No Login to Receive', desc: 'Share with anyone — no account needed.', color: '#f59e0b' },
                { icon: <Package size={24} />, title: 'Unlimited File Size', desc: 'Any file type, any size, no restrictions.', color: '#ef4444' },
              ].map((item, i) => (
                <div key={i} className="card card-hover" style={{ padding: '1.5rem' }}>
                  <div style={{
                    width: '46px', height: '46px', borderRadius: '12px',
                    background: `${item.color}20`, border: `1px solid ${item.color}35`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: item.color, marginBottom: '0.875rem',
                  }}>
                    {item.icon}
                  </div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>{item.title}</h3>
                  <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Use Cases ── */}
          <section style={{ marginBottom: '5rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center', marginBottom: '0.75rem' }}>
              Use Cases
            </h2>
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '3rem' }}>
              Built for professionals who need reliable, private file delivery
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '1.5rem' }}>
              {USE_CASES.map((uc, i) => (
                <div key={i} className="glass-card card-hover" style={{ padding: '2rem', position: 'relative', overflow: 'hidden' }}>
                  <div style={{
                    position: 'absolute', top: '-20px', right: '-20px',
                    width: '100px', height: '100px', borderRadius: '50%',
                    background: `${uc.color}10`,
                    filter: 'blur(20px)',
                  }} />
                  <div style={{
                    width: '58px', height: '58px', borderRadius: '16px',
                    background: `linear-gradient(135deg, ${uc.color}30, ${uc.color}15)`,
                    border: `1px solid ${uc.color}40`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: uc.color, marginBottom: '1.25rem',
                    boxShadow: `0 4px 16px ${uc.color}25`,
                  }}>
                    {uc.icon}
                  </div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.6rem' }}>{uc.title}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>{uc.desc}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {uc.examples.map((ex, j) => (
                      <span key={j} style={{
                        background: `${uc.color}15`, border: `1px solid ${uc.color}30`,
                        borderRadius: '999px', padding: '0.2rem 0.625rem',
                        color: uc.color, fontSize: '0.75rem', fontWeight: 600,
                      }}>{ex}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Comparison Table ── */}
          <section style={{ marginBottom: '5rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center', marginBottom: '0.75rem' }}>
              How We Compare
            </h2>
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '3rem' }}>
              See why P2P Transfer wins on privacy, speed, and cost
            </p>

            <div style={{ overflowX: 'auto', borderRadius: '1.25rem', border: '1px solid var(--border-default)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)' }}>
                    <th style={{ padding: '1rem 1.5rem', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Feature
                    </th>
                    {[
                      { label: 'P2P Transfer', highlight: true, color: '#6366f1' },
                      { label: 'Google Drive', color: '#4285f4' },
                      { label: 'WeTransfer', color: '#0095ee' },
                    ].map((h, i) => (
                      <th key={i} style={{
                        padding: '1rem 1.5rem', textAlign: 'center',
                        color: h.highlight ? '#818cf8' : 'var(--text-secondary)',
                        fontSize: '0.875rem', fontWeight: 700,
                        background: h.highlight ? 'rgba(99,102,241,0.06)' : undefined,
                      }}>
                        {h.highlight && (
                          <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
                          }}>
                            <Star size={14} style={{ fill: '#818cf8', color: '#818cf8' }} />
                            {h.label}
                          </div>
                        )}
                        {!h.highlight && h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row, i) => (
                    <tr key={i} style={{
                      borderBottom: i < COMPARISON.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      background: i % 2 === 0 ? 'var(--bg-glass)' : 'transparent',
                    }}>
                      <td style={{ padding: '0.875rem 1.5rem', color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: 500 }}>
                        {row.feature}
                      </td>
                      <td style={{ padding: '0.875rem 1.5rem', textAlign: 'center', background: 'rgba(99,102,241,0.04)' }}>
                        <CellValue value={row.p2p} />
                      </td>
                      <td style={{ padding: '0.875rem 1.5rem', textAlign: 'center' }}>
                        <CellValue value={row.gdrive} />
                      </td>
                      <td style={{ padding: '0.875rem 1.5rem', textAlign: 'center' }}>
                        <CellValue value={row.wetransfer} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Pricing ── */}
          <section style={{ marginBottom: '5rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center', marginBottom: '0.75rem' }}>
              Pricing
            </h2>
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '3rem' }}>
              No tiers, no paywalls, no asterisks
            </p>

            <div style={{ maxWidth: '480px', margin: '0 auto' }}>
              <div className="glass-card" style={{
                padding: '3rem 2.5rem', textAlign: 'center',
                border: '1px solid rgba(99,102,241,0.35)',
                background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.12))',
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', top: '-30px', right: '-30px',
                  width: '180px', height: '180px', borderRadius: '50%',
                  background: 'rgba(99,102,241,0.12)', filter: 'blur(30px)',
                }} />
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                  background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
                  borderRadius: '999px', padding: '0.3rem 0.875rem',
                  color: '#10b981', fontSize: '0.8rem', fontWeight: 700, marginBottom: '1.5rem',
                }}>
                  <Star size={12} style={{ fill: '#10b981', color: '#10b981' }} /> Most Popular
                </div>
                <div style={{ fontSize: '4rem', fontWeight: 900, color: '#818cf8', lineHeight: 1, marginBottom: '0.25rem' }}>
                  $0
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '2rem' }}>
                  per month — forever
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left', marginBottom: '2.5rem' }}>
                  {[
                    'Unlimited file transfers',
                    'No file size limit',
                    'No storage on servers',
                    'End-to-end encryption',
                    'Transfer history in dashboard',
                    'Admin dashboard for organizations',
                    'Multi-file batch sending',
                    'Add files mid-transfer',
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <Check size={16} style={{ color: '#10b981', flexShrink: 0 }} />
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{item}</span>
                    </div>
                  ))}
                </div>
                <Link href="/register" className="btn btn-primary btn-lg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%' }}>
                  <Rocket size={20} /> Get Started Free
                </Link>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '1rem' }}>
                  No credit card required
                </p>
              </div>
            </div>
          </section>

          {/* ── CTA ── */}
          <div className={`glass-card ${mounted ? 'animate-fade-up' : ''}`}
            style={{
              padding: '3.5rem 2rem', textAlign: 'center',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(139,92,246,0.1))',
            }}>
            <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              Start Transferring Today
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              Create an account in seconds. No credit card, no fine print.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/register" className="btn btn-primary btn-lg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Rocket size={18} /> Create Free Account
              </Link>
              <Link href="/how-it-works" className="btn btn-secondary btn-lg" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                How It Works <ArrowRight size={18} />
              </Link>
            </div>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}
