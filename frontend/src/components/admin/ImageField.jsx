import { useRef } from 'react';
import AdminButton from './AdminButton';
import FormField from './FormField';

const ImageField = ({
  id,
  value,
  onChange,
  onFile,
  required = false,
}) => {
  const fileRef = useRef(null);

  return (
    <FormField label="Image" htmlFor={id}>
      {value ? <img className="admin-image-preview" src={value} alt="" /> : null}
      <input
        id={id}
        className="admin-control"
        type="text"
        name="image_url"
        value={value}
        placeholder="Image URL"
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
      <div className="admin-image-divider" aria-hidden="true">
        <span>or</span>
      </div>
      <AdminButton
        type="button"
        variant="secondary"
        size="md"
        onClick={() => fileRef.current?.click()}
      >
        Upload image
      </AdminButton>
      <input
        ref={fileRef}
        className="admin-file-input"
        type="file"
        accept="image/*"
        tabIndex={-1}
        aria-hidden="true"
        onChange={onFile}
      />
    </FormField>
  );
};

export default ImageField;
