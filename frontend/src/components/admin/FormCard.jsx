import { forwardRef } from 'react';
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
      <h2 className="admin-form-title">
        <span>{title}</span>
        {titleNote ? <span className="admin-form-title-note">· {titleNote}</span> : null}
      </h2>
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
