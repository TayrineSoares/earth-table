import AdminButton from './AdminButton';
import SearchField from './SearchField';
import '../../styles/AdminShared.css';

const AdminToolbar = ({
  searchValue,
  searchPlaceholder,
  onSearchChange,
  searchLabel = 'Search',
  filters = null,
  filtersBelow = false,
  actionLabel,
  onAction,
  resultLabel = '',
  showSearch = true,
}) => (
  <div className="admin-toolbar-block">
    <div className="admin-toolbar">
      <div className="admin-toolbar-main">
        {showSearch ? (
          <SearchField
            className="admin-search-field--toolbar"
            inputClassName="admin-control admin-toolbar-search"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={onSearchChange}
            aria-label={searchLabel}
          />
        ) : null}
        {!filtersBelow ? filters : null}
      </div>
      {actionLabel && onAction ? (
        <div className="admin-toolbar-action">
          <AdminButton variant="primary" size="md" onClick={onAction}>
            {actionLabel}
          </AdminButton>
        </div>
      ) : null}
    </div>
    {filtersBelow && filters ? (
      <div className="admin-toolbar-filters">{filters}</div>
    ) : null}
    {resultLabel ? <p className="admin-toolbar-count">{resultLabel}</p> : null}
  </div>
);

export default AdminToolbar;
