'use client';
import { useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Mail, Send, CheckCircle, MessageSquare } from 'lucide-react';
import { showToast } from '../components/Toast';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Failed to submit', 'error');
      } else {
        setSubmitted(true);
        showToast('Message sent successfully!', 'success');
      }
    } catch (err) {
      showToast('Error sending message. Please try again later.', 'error');
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-base)' }}>
      <Navbar />

      <main style={{ flex: 1, padding: '120px 1.5rem 80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: '600px' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>
              Contact Us
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem' }}>
              Have questions or found an issue? Send us a message and we'll get back to you.
            </p>
          </div>

          <div className="glass-card animate-fade-up" style={{ padding: '2.5rem', position: 'relative', border: '1px solid var(--border-glass)' }}>
            {submitted ? (
              <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                <CheckCircle size={64} color="#10b981" style={{ margin: '0 auto 1.5rem', display: 'block' }} />
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>
                  Message Received!
                </h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                  Thank you for reaching out. Our support team will review your message shortly.
                </p>
                <button onClick={() => { setSubmitted(false); setForm({ name: '', email: '', subject: '', message: '' }); }} className="btn btn-secondary">
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    className="input"
                    placeholder="Your Name"
                    value={form.name}
                    onChange={e => setForm({...form, name: e.target.value})}
                    style={{ padding: '1rem 1.25rem', borderRadius: '0.75rem' }}
                  />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    className="input"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={e => setForm({...form, email: e.target.value})}
                    style={{ padding: '1rem 1.25rem', borderRadius: '0.75rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>
                    Subject
                  </label>
                  <input
                    type="text"
                    required
                    className="input"
                    placeholder="What is this regarding?"
                    value={form.subject}
                    onChange={e => setForm({...form, subject: e.target.value})}
                    style={{ padding: '1rem 1.25rem', borderRadius: '0.75rem' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.6rem' }}>
                    Message
                  </label>
                  <textarea
                    required
                    className="input"
                    rows={5}
                    placeholder="Describe your issue or inquiry..."
                    value={form.message}
                    onChange={e => setForm({...form, message: e.target.value})}
                    style={{ padding: '1rem 1.25rem', borderRadius: '0.75rem', resize: 'vertical' }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ padding: '1rem', fontSize: '1.1rem', fontWeight: 700, marginTop: '1rem', borderRadius: '0.75rem' }}
                >
                  {loading ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                      <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />
                      Sending...
                    </span>
                  ) : (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                      <Send size={18} /> Send Message
                    </span>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      <Footer />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
