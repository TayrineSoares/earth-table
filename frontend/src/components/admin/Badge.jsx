const Badge = ({ tone = 'neutral', children }) => (
  <span className={`admin-badge admin-badge--${tone}`}>{children}</span>
);

export default Badge;
