'use client';
import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useToast } from '../components/Toast';

export default function ContactPage() {
  const [mounted, setMounted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();

  useEffect(() => { setMounted(true); }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate network request (UI only as requested)
    setTimeout(() => {
      setIsSubmitting(false);
      showToast('Message sent successfully! We will get back to you soon.', 'success', 5000);
      e.target.reset();
    }, 1500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />

      <main style={{ flex: 1, paddingTop: '120px', paddingBottom: '80px', paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          
          <div className={`stagger ${mounted ? 'animate-fade-in' : ''}`} style={{ textAlign: 'center', marginBottom: '4rem' }}>
            <h1 className="gradient-hero animate-gradient" style={{
              fontSize: 'calc(2.5rem + 2vw)', fontWeight: 900, letterSpacing: '-0.02em',
              color: 'var(--text-primary)', marginBottom: '1.5rem', WebkitBackgroundClip: 'text',
              backgroundClip: 'text', textFillColor: 'transparent', WebkitTextFillColor: 'transparent'
            }}>
              Get in Touch
            </h1>
            <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
              Have a question, feedback, or need help with a transfer? Drop us a line and our support team will respond as soon as possible.
            </p>
          </div>

          <div className={`stagger ${mounted ? 'animate-fade-up' : ''}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '4rem', alignItems: 'flex-start' }}>
            
            {/* Contact Information */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>Contact Information</h2>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Our team is distributed across the globe to ensure round-the-clock availability for all your file sharing inquiries.
                </p>
              </div>

              <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ fontSize: '1.5rem', background: 'rgba(99,102,241,0.1)', padding: '0.75rem', borderRadius: '0.75rem' }}>📧</div>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Email Support</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>support@p2ptransfer.com</p>
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ fontSize: '1.5rem', background: 'rgba(16,185,129,0.1)', padding: '0.75rem', borderRadius: '0.75rem' }}>🏢</div>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Headquarters</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>123 Innovation Drive<br/>Tech Hub District<br/>San Francisco, CA 94103</p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ fontSize: '1.5rem', background: 'rgba(245,158,11,0.1)', padding: '0.75rem', borderRadius: '0.75rem' }}>🕒</div>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Response Time</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Usually within 24 hours</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="glass-card" style={{ padding: '3rem 2rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1.5rem' }}>Send us a Message</h2>
              
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', marginLeft: '0.25rem' }}>Full Name</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="John Doe"
                    required
                    style={{ padding: '1.25rem 1.5rem', fontSize: '1.1rem', borderRadius: '0.75rem' }}
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', marginLeft: '0.25rem' }}>Email Address</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="john@example.com"
                    required
                    style={{ padding: '1.25rem 1.5rem', fontSize: '1.1rem', borderRadius: '0.75rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', marginLeft: '0.25rem' }}>Subject (Optional)</label>
                  <select className="input" style={{ padding: '1.25rem 1.5rem', fontSize: '1.1rem', borderRadius: '0.75rem', cursor: 'pointer' }}>
                    <option value="general">General Inquiry</option>
                    <option value="support">Technical Support</option>
                    <option value="feedback">Feedback / Suggestion</option>
                    <option value="business">Business Partnership</option>
                  </select>
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', marginLeft: '0.25rem' }}>Your Message</label>
                  <textarea
                    className="input"
                    placeholder="How can we help you?"
                    required
                    rows="5"
                    style={{ padding: '1.25rem 1.5rem', fontSize: '1.1rem', borderRadius: '0.75rem', resize: 'vertical' }}
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="btn btn-primary btn-lg" 
                  style={{ width: '100%', marginTop: '0.5rem', padding: '1.25rem 2rem', fontSize: '1.15rem' }}
                >
                  {isSubmitting ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⚙️</span> Sending...
                    </span>
                  ) : 'Send Message'}
                </button>
              </form>
            </div>

          </div>
        </div>
      </main>

      <Footer />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
