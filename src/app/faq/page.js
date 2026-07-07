'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { ChevronDown, HelpCircle, ArrowRight, Rocket, MessageCircle } from 'lucide-react';

const faqs = [
  {
    q: 'Is P2P Transfer really free?',
    a: 'Yes — P2P Transfer is completely free to use. No hidden fees, no subscriptions, no transfer limits. The sender needs a free account; the receiver needs nothing but a browser.',
  },
  {
    q: 'How large can the files be?',
    a: 'There is no file size limit imposed by our service. You can transfer files of any size — from a few KB up to hundreds of GB. The only practical constraint is your browser\'s available RAM for very large files.',
  },
  {
    q: 'Is my data secure during transfer?',
    a: 'Absolutely. Files are transferred using WebRTC DataChannels which use DTLS (Datagram Transport Layer Security) and SRTP encryption by default. No data is stored on our servers at any point.',
  },
  {
    q: 'Does the receiver need an account to download?',
    a: 'No — the receiver just needs the transfer link. They open it in any modern browser and click "Start Receiving." No login, no registration, no app install.',
  },
  {
    q: 'What happens if the internet connection drops?',
    a: 'Since transfer relies on a live P2P connection, if either party disconnects, the transfer pauses. The session room remains available, so the receiver can reconnect and the sender can attempt to resend.',
  },
  {
    q: 'Can I send multiple files at once?',
    a: 'Yes! Select multiple files at once using your file picker or drag & drop a batch into the drop zone. All files are queued into one session and sent sequentially through a single transfer link.',
  },
  {
    q: 'Can I add more files after generating the link?',
    a: 'Yes — while your transfer session is in the "waiting" state (before the receiver joins), you can click "Add More Files" in the transfer modal to append additional files to the same session.',
  },
  {
    q: 'Does it work on mobile devices?',
    a: 'Yes! P2P Transfer works on any device with a modern browser — iPhone, Android, tablet, or desktop. Chrome, Firefox, Edge, and Safari are all supported.',
  },
  {
    q: 'How long is the transfer link valid?',
    a: 'The transfer room remains active as long as the sender keeps their browser tab open. The session is tied to the sender\'s live connection, not a time limit.',
  },
  {
    q: 'Will my ISP throttle the transfer speed?',
    a: 'Generally no. Since data travels directly between peers via WebRTC, speeds are governed by both parties\' ISP capacities — typically much faster than upload-then-download cloud services.',
  },
  {
    q: 'Why do I need to keep my tab open as the sender?',
    a: 'Your device acts as the source server. If you close the tab, the P2P connection closes and the receiver can no longer receive data. Keep the tab open until the transfer completes.',
  },
  {
    q: 'Do you store any file metadata or transfer logs?',
    a: 'We store only minimal metadata (file names, sizes, room ID) for transfer records — never actual file contents. This metadata is used only for the admin dashboard and analytics.',
  },
];

export default function FAQPage() {
  const [mounted, setMounted] = useState(false);
  const [openIndex, setOpenIndex] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => { setMounted(true); }, []);

  const filtered = faqs.filter(f =>
    f.q.toLowerCase().includes(search.toLowerCase()) ||
    f.a.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Navbar />

      <main style={{ flex: 1, paddingTop: '120px', paddingBottom: '80px', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
        <div style={{ maxWidth: '820px', margin: '0 auto' }}>

          {/* ── Header ── */}
          <div className={mounted ? 'animate-fade-in' : ''} style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
              background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: '999px', padding: '0.4rem 1rem',
              color: '#818cf8', fontSize: '0.8rem', fontWeight: 600, marginBottom: '1.5rem',
            }}>
              <HelpCircle size={14} /> {faqs.length} questions answered
            </div>
            <h1 className="gradient-hero animate-gradient" style={{
              fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 900, letterSpacing: '-0.02em',
              marginBottom: '1.25rem', WebkitBackgroundClip: 'text',
              backgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              Frequently Asked Questions
            </h1>
            <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              Everything you need to know about P2P Transfer
            </p>

            {/* Search */}
            <div style={{ position: 'relative', maxWidth: '440px', margin: '0 auto' }}>
              <HelpCircle size={18} style={{
                position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }} />
              <input
                type="text"
                placeholder="Search questions..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'var(--bg-input)', border: '1px solid var(--border-default)',
                  borderRadius: '0.875rem', padding: '0.75rem 1rem 0.75rem 2.75rem',
                  color: 'var(--text-primary)', fontSize: '0.9rem', outline: 'none',
                  transition: 'border 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.6)'}
                onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
              />
            </div>
          </div>

          {/* ── Accordion ── */}
          <div className={mounted ? 'animate-fade-up' : ''} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '5rem' }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                <MessageCircle size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
                <p>No questions match &ldquo;{search}&rdquo;</p>
              </div>
            ) : filtered.map((faq, i) => {
              const isOpen = openIndex === i;
              return (
                <div
                  key={i}
                  className="glass-card"
                  style={{
                    overflow: 'hidden',
                    transition: 'all 0.25s ease',
                    borderColor: isOpen ? 'rgba(99,102,241,0.45)' : 'var(--border-default)',
                    boxShadow: isOpen ? 'var(--shadow-glow)' : 'var(--shadow-card)',
                  }}
                >
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    style={{
                      width: '100%', padding: '1.375rem 1.5rem',
                      textAlign: 'left', display: 'flex',
                      alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: 'var(--text-primary)', fontWeight: 600, fontSize: '1rem',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{
                        width: '24px', height: '24px', borderRadius: '6px',
                        background: isOpen ? 'rgba(99,102,241,0.2)' : 'var(--bg-glass)',
                        border: `1px solid ${isOpen ? 'rgba(99,102,241,0.4)' : 'var(--border-default)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, transition: 'all 0.2s',
                      }}>
                        <span style={{
                          fontSize: '0.65rem', fontWeight: 800,
                          color: isOpen ? '#818cf8' : 'var(--text-muted)',
                        }}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                      </span>
                      {faq.q}
                    </span>
                    <ChevronDown
                      size={20}
                      style={{
                        color: isOpen ? '#818cf8' : 'var(--text-secondary)',
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.3s ease, color 0.2s',
                        flexShrink: 0,
                      }}
                    />
                  </button>

                  <div style={{
                    maxHeight: isOpen ? '400px' : '0',
                    opacity: isOpen ? 1 : 0,
                    overflow: 'hidden',
                    transition: 'max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
                    padding: isOpen ? '0 1.5rem 1.5rem' : '0 1.5rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.7,
                    fontSize: '0.95rem',
                  }}>
                    <div style={{ paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
                      {faq.a}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── CTA ── */}
          <div className={`glass-card ${mounted ? 'animate-fade-up' : ''}`}
            style={{
              animationDelay: '300ms', padding: '4rem 2rem', textAlign: 'center',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(139,92,246,0.1))',
            }}>
            <MessageCircle size={48} style={{ color: '#818cf8', margin: '0 auto 1rem' }} />
            <h2 style={{ fontSize: 'clamp(1.6rem, 3vw, 2rem)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              Still have questions?
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '2rem' }}>
              Try it yourself — it&apos;s free and takes seconds to start.
            </p>
            <Link href="/register" className="btn btn-primary btn-lg" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <Rocket size={18} /> Get Started Free
            </Link>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
}