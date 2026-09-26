import '../../styles/AdminShared.css';

const FormField = ({ label, hint, htmlFor, children }) => (
  <div className="admin-field">
    {label || hint ? (
      <div className="admin-field-heading">
        {label ? (
          htmlFor ? (
            <label className="admin-field-label" htmlFor={htmlFor}>
              {label}
            </label>
          ) : (
            <span className="admin-field-label">{label}</span>
          )
        ) : null}
        {hint ? (
          <p className="admin-field-hint" id={htmlFor ? `${htmlFor}-hint` : undefined}>
            {hint}
          </p>
        ) : null}
      </div>
    ) : null}
    <div className="admin-field-control">{children}</div>
  </div>
);

export default FormField;
