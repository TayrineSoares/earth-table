import '../../styles/AdminShared.css';

const AdminListItem = ({
  image,
  title,
  description,
  price,
  category,
  tags,
  meta,
  actions,
  capitalize = false,
}) => (
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
      {(price || category) ? (
        <div className="admin-list-price-line">
          {price ? <span className="admin-list-price">{price}</span> : null}
          {price && category ? (
            <span className="admin-list-price-sep" aria-hidden="true">·</span>
          ) : null}
          {category ? <span className="admin-list-category">{category}</span> : null}
        </div>
      ) : null}
      {tags ? <div className="admin-list-tags">{tags}</div> : null}
      {meta ? <div className="admin-list-meta">{meta}</div> : null}
    </div>
    {actions ? <div className="admin-list-actions">{actions}</div> : null}
  </article>
);

export default AdminListItem;
