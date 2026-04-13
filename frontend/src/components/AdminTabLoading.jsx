/**
 * Shared spinner for admin tab panels while the main list fetch runs.
 * Styles: ../styles/Admin.css (.admin-tab-loading)
 */
const AdminTabLoading = ({ message }) => (
  <div className="admin-tab-loading" role="status" aria-live="polite">
    <div className="admin-tab-loading-spinner" aria-hidden />
    <p>{message}</p>
  </div>
);

export default AdminTabLoading;
