import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CircleAlert, LogIn, Mail } from 'lucide-react';
import '../styles/FeedbackDialog.css';

const ICONS = {
  mail: Mail,
  login: LogIn,
  alert: CircleAlert,
};

function DialogAction({ to, className, onClick, children }) {
  if (to) return <Link className={className} to={to}>{children}</Link>;
  return (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  );
}

const FeedbackDialog = ({ dialog, onClose }) => {
  useEffect(() => {
    if (!dialog) return;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [dialog, onClose]);

  if (!dialog) return null;

  const Icon = ICONS[dialog.icon] || CircleAlert;

  return (
    <div
      className="feedback-dialog-overlay"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="feedback-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-dialog-title"
        aria-describedby="feedback-dialog-body"
        onClick={(e) => e.stopPropagation()}
      >
        <Icon className="feedback-dialog-icon" aria-hidden="true" />
        <h2 id="feedback-dialog-title" className="feedback-dialog-title">
          {dialog.title}
        </h2>
        <p id="feedback-dialog-body" className="feedback-dialog-body">
          {dialog.body}
        </p>
        {dialog.hint && (
          <p className="feedback-dialog-hint">{dialog.hint}</p>
        )}
        <div className="feedback-dialog-actions">
          <DialogAction
            className="feedback-dialog-primary"
            to={dialog.primaryTo}
            onClick={onClose}
          >
            {dialog.primaryLabel}
          </DialogAction>
          {dialog.secondaryLabel && (
            <DialogAction
              className="feedback-dialog-secondary"
              to={dialog.secondaryTo}
              onClick={onClose}
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
