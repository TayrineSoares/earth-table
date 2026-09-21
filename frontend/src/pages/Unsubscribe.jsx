import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Lottie from 'lottie-react';
import FeedbackDialog from '../components/FeedbackDialog';
import loginImage from '../assets/images/accountImage.png';
import loadingAnimation from '../assets/loading.json';
import '../styles/Contact.css';
import '../styles/Unsubscribe.css';

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [status, setStatus] = useState('loading');
  const [dialog, setDialog] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!token) {
        setStatus('error');
        setDialog({
          icon: 'alert',
          title: 'Link missing',
          body: 'This unsubscribe link is missing or incomplete.',
          primaryLabel: 'Got it',
        });
        return;
      }

      try {
        const res = await fetch('/api/email/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setStatus('error');
          setDialog({
            icon: 'alert',
            title: 'Could not unsubscribe',
            body: data.error || 'This unsubscribe link is invalid.',
            primaryLabel: 'Got it',
          });
          return;
        }
        setStatus('ok');
      } catch {
        if (cancelled) return;
        setStatus('error');
        setDialog({
          icon: 'alert',
          title: 'Could not unsubscribe',
          body: 'Something went wrong. Please try again, or email hello@earthtableco.ca.',
          primaryLabel: 'Got it',
        });
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (status === 'loading') {
    return (
      <div
        className="loading-container"
        style={{
          minHeight: '80vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Lottie animationData={loadingAnimation} loop />
      </div>
    );
  }

  return (
    <div className="unsubscribe-page">
      <div className="contact-header-image-container">
        <img className="contact-header-image" src={loginImage} alt="" />
      </div>
      <div className="page-wrapper">
        <h1 className="unsubscribe-title">Email reminders</h1>
        {status === 'ok' ? (
          <>
            <p className="unsubscribe-body">
              You've unsubscribed from pause and meal reminder emails.
            </p>
            <p className="unsubscribe-body">
              You'll still get receipts and notices when something on your plan changes.
            </p>
          </>
        ) : (
          <p className="unsubscribe-body">
            We could not update your email reminders.
          </p>
        )}
        <Link className="unsubscribe-home" to="/">Back to home</Link>
      </div>
      <FeedbackDialog dialog={dialog} onClose={() => setDialog(null)} />
    </div>
  );
};

export default Unsubscribe;
