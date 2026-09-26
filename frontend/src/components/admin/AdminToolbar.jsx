import AdminButton from './AdminButton';
import '../../styles/AdminShared.css';

const AdminToolbar = ({
  searchValue,
  searchPlaceholder,
  onSearchChange,
  searchLabel = 'Search',
  filters = null,
  actionLabel,
  onAction,
  resultLabel = '',
}) => (
  <div className="admin-toolbar-block">
    <div className="admin-toolbar">
      <div className="admin-toolbar-main">
        <input
          type="text"
          className="admin-control admin-toolbar-search"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={onSearchChange}
          aria-label={searchLabel}
        />
        {filters}
      </div>
      <div className="admin-toolbar-action">
        <AdminButton variant="primary" size="md" onClick={onAction}>
          {actionLabel}
        </AdminButton>
      </div>
    </div>
    {resultLabel ? <p className="admin-toolbar-count">{resultLabel}</p> : null}
  </div>
);

export default AdminToolbar;
