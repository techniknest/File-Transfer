'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function FAQPage() {
  const [mounted, setMounted] = useState(false);
  const [openIndex, setOpenIndex] = useState(null);
  
  useEffect(() => { setMounted(true); }, []);

  const faqs = [
    { q: 'Is P2P Transfer really free?', a: 'Yes! P2P Transfer is completely free to use. No hidden fees, no subscriptions, no limits on the number of transfers.' },
    { q: 'How large can the files be?', a: 'There is no file size limit! You can transfer files of any size — from a few KB up to hundreds of GB. The only limit is your browser\'s memory.' },
    { q: 'Is my data secure?', a: 'Absolutely. Your files are transferred directly between devices using WebRTC end-to-end encryption. No data is ever stored on our servers.' },
    { q: 'Does the receiver need an account to download?', a: 'No, the receiver just needs the transfer link. Only the sender needs an account to initiate the transfer.' },
    { q: 'What happens if the connection drops?', a: 'Because the transfer relies on a live peer-to-peer connection, if either party disconnects, the transfer stops. However, the session remains active for 24 hours, so you can rejoin and try again.' },
    { q: 'Can I send multiple files at once?', a: 'Yes! You can select multiple files or even drag and drop them. They will all be sent through a single transfer link simultaneously.' },
    { q: 'Does it work on mobile devices?', a: 'Yes! P2P Transfer works on any device with a modern browser — phone, tablet, or desktop.' },
    { q: 'How long is the transfer link valid?', a: 'The transfer room remains available in the lobby for 24 hours. The files are only available while the sender keeps their browser tab open.' },
    { q: 'Will my ISP throttle the transfer?', a: 'Usually no. Because the data goes directly between peers, speeds are dictated by the sender\'s upload speed and the receiver\'s download speed.' },
    { q: 'Why do I need to keep the tab open?', a: 'Since your device is acting as the server hosting the files, if you close the tab, the connection is lost and the receiver can no longer download the files.' },
    { q: 'Do you offer a desktop app?', a: 'Currently, we are 100% web-based. This ensures you never have to install any bulky software or plugins.' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />

      <main style={{ flex: 1, paddingTop: '120px', paddingBottom: '80px', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          
          <div className={`stagger ${mounted ? 'animate-fade-in' : ''}`} style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <h1 className="gradient-hero animate-gradient" style={{
              fontSize: 'calc(2.5rem + 2vw)', fontWeight: 900, letterSpacing: '-0.02em',
              color: 'var(--text-primary)', marginBottom: '1.5rem', WebkitBackgroundClip: 'text',
              backgroundClip: 'text', textFillColor: 'transparent', WebkitTextFillColor: 'transparent'
            }}>
              Frequently Asked Questions
            </h1>
            <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>
              Everything you need to know about P2P Transfer
            </p>
          </div>

          <div className={mounted ? 'animate-fade-up' : ''} style={{ animationDelay: '150ms', display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '5rem' }}>
            {faqs.map((faq, i) => (
              <div 
                key={i} 
                className="glass-card" 
                style={{ 
                  overflow: 'hidden', 
                  transition: 'all 0.3s ease',
                  borderColor: openIndex === i ? 'rgba(99,102,241,0.5)' : 'var(--border-default)',
                  boxShadow: openIndex === i ? 'var(--shadow-glow)' : 'var(--shadow-card)'
                }}
              >
                <button
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                  style={{
                    width: '100%', padding: '1.5rem', textAlign: 'left', display: 'flex',
                    alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'var(--text-primary)', fontWeight: 600, fontSize: '1.1rem'
                  }}
                >
                  <span>{faq.q}</span>
                  <span style={{ 
                    color: openIndex === i ? '#818cf8' : 'var(--text-secondary)',
                    transform: openIndex === i ? 'rotate(45deg)' : 'rotate(0)',
                    transition: 'transform 0.3s ease, color 0.3s ease',
                    fontSize: '1.5rem', lineHeight: 1
                  }}>
                    +
                  </span>
                </button>
                
                <div style={{
                  maxHeight: openIndex === i ? '300px' : '0',
                  opacity: openIndex === i ? 1 : 0,
                  overflow: 'hidden',
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  padding: openIndex === i ? '0 1.5rem 1.5rem 1.5rem' : '0 1.5rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                  fontSize: '0.95rem'
                }}>
                  <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                    {faq.a}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className={`glass-card ${mounted ? 'animate-fade-up' : ''}`} style={{ animationDelay: '300ms', padding: '4rem 2rem', textAlign: 'center', background: 'linear-gradient(135deg, rgba(99,102,241,0.05), rgba(139,92,246,0.1))' }}>
            <h2 style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>Still have questions?</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginBottom: '2rem' }}>Try it yourself — it's free and takes seconds.</p>
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