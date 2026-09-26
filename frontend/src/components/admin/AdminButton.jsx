const AdminButton = ({
  variant = 'secondary',
  size = 'md',
  type = 'button',
  className = '',
  children,
  ...props
}) => (
  <button
    type={type}
    className={`admin-btn admin-btn--${variant} admin-btn--${size}${className ? ` ${className}` : ''}`}
    {...props}
  >
    {children}
  </button>
);

export default AdminButton;
