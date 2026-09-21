import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CircleAlert, LogIn, Mail } from 'lucide-react';
import '../styles/FeedbackDialog.css';

const ICONS = {
  mail: Mail,
  login: LogIn,
  alert: CircleAlert,
};

function DialogAction({ to, className, onClick, children, disabled }) {
  if (to && !disabled) return <Link className={className} to={to}>{children}</Link>;
  return (
    <button type="button" className={className} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

const FeedbackDialog = ({ dialog, onClose }) => {
  const busy = Boolean(dialog?.busy);

  useEffect(() => {
    if (!dialog) return;

    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [dialog, busy, onClose]);

  if (!dialog) return null;

  const Icon = ICONS[dialog.icon] || CircleAlert;

  return (
    <div
      className={`feedback-dialog-overlay${busy ? ' is-busy' : ''}`}
      role="presentation"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className={`feedback-dialog${Array.isArray(dialog.body) ? ' feedback-dialog--stacked' : ''}${dialog.asList ? ' feedback-dialog--list' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-busy={busy}
        aria-labelledby="feedback-dialog-title"
        aria-describedby="feedback-dialog-body"
        onClick={(e) => e.stopPropagation()}
      >
        <Icon className="feedback-dialog-icon" aria-hidden="true" />
        <h2 id="feedback-dialog-title" className="feedback-dialog-title">
          {dialog.title}
        </h2>
        {Array.isArray(dialog.body) && dialog.asList ? (
          <ul id="feedback-dialog-body" className="feedback-dialog-list">
            {dialog.body.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        ) : Array.isArray(dialog.body) ? (
          <div id="feedback-dialog-body" className="feedback-dialog-body-list">
            {dialog.body.map((paragraph, index) => (
              <p key={index} className="feedback-dialog-body">{paragraph}</p>
            ))}
          </div>
        ) : (
          <p id="feedback-dialog-body" className="feedback-dialog-body">
            {dialog.body}
          </p>
        )}
        {dialog.hint && (
          <p className="feedback-dialog-hint">{dialog.hint}</p>
        )}
        <div className="feedback-dialog-actions">
          <DialogAction
            className="feedback-dialog-primary"
            to={dialog.primaryTo}
            disabled={busy}
            onClick={() => {
              if (busy) return;
              if (typeof dialog.onPrimary === 'function') {
                dialog.onPrimary();
                return;
              }
              onClose();
            }}
          >
            {dialog.primaryLabel}
          </DialogAction>
          {dialog.secondaryLabel && (
            <DialogAction
              className="feedback-dialog-secondary"
              to={dialog.secondaryTo}
              disabled={busy}
              onClick={() => {
                if (!busy) onClose();
              }}
            >
              {dialog.secondaryLabel}
            </DialogAction>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeedbackDialog;
