import '../../styles/AdminShared.css';

const AdminListItem = ({ image, title, description, meta, actions, capitalize = false }) => (
  <article className="admin-list-item">
    {image ? (
      <img className="admin-list-thumb" src={image} alt="" />
    ) : (
      <span className="admin-list-thumb admin-list-thumb--empty" aria-hidden="true" />
    )}
    <div className="admin-list-content">
      <span className={`admin-list-title${capitalize ? ' is-capitalize' : ''}`} title={title}>
        {title}
      </span>
      {description ? (
        <p className="admin-list-desc" title={description}>
          {description}
        </p>
      ) : null}
      {meta ? <div className="admin-list-meta">{meta}</div> : null}
    </div>
    {actions ? <div className="admin-list-actions">{actions}</div> : null}
  </article>
);

export default AdminListItem;
