type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
};

const SearchBar: React.FC<SearchBarProps> = ({ value, onChange }) => (
  <input
    className="searchbar"
    type="text"
    placeholder="Zoek nummers..."
    value={value}
    onChange={e => onChange(e.target.value)}
  />
);

export default SearchBar;