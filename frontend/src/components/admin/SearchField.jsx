import { Search } from 'lucide-react';

const SearchField = ({
  className = '',
  inputClassName = '',
  ...inputProps
}) => (
  <div className={`admin-search-field${className ? ` ${className}` : ''}`}>
    <Search className="admin-search-icon" size={16} strokeWidth={2} aria-hidden="true" />
    <input
      type="text"
      className={`admin-search-input${inputClassName ? ` ${inputClassName}` : ''}`}
      {...inputProps}
    />
  </div>
);

export default SearchField;
