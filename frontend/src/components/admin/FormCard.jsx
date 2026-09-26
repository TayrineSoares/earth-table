import { forwardRef } from 'react';
import { X } from 'lucide-react';
import AdminButton from './AdminButton';
import '../../styles/AdminShared.css';

const FormCard = forwardRef(function FormCard({
  title,
  titleNote,
  onSubmit,
  onCancel,
  submitLabel,
  submitDisabled = false,
  children,
}, ref) {
  return (
    <form ref={ref} className="admin-form-card" onSubmit={onSubmit}>
      <div className="admin-form-header">
        <h2 className="admin-form-title">
          <span>{title}</span>
          {titleNote ? <span className="admin-form-title-note">· {titleNote}</span> : null}
        </h2>
        <button
          type="button"
          className="admin-form-close"
          onClick={onCancel}
          disabled={submitDisabled}
          aria-label="Close form"
        >
          <X size={20} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>
      {children}
      <div className="admin-form-actions">
        <AdminButton type="submit" variant="primary" size="md" disabled={submitDisabled}>
          {submitLabel}
        </AdminButton>
        <AdminButton type="button" variant="secondary" size="md" onClick={onCancel} disabled={submitDisabled}>
          Cancel
        </AdminButton>
      </div>
    </form>
  );
});

export default FormCard;
