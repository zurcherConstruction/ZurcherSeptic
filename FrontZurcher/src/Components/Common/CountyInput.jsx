import React, { useState, useEffect, useId } from 'react';
import api from '../../utils/axios';

const FALLBACK_COUNTIES = [
  'Alachua', 'Baker', 'Bay', 'Bradford', 'Brevard',
  'Broward', 'Calhoun', 'Charlotte', 'Citrus', 'Clay',
  'Collier', 'Columbia', 'DeSoto', 'Dixie', 'Duval',
  'Escambia', 'Flagler', 'Franklin', 'Gadsden', 'Gilchrist',
  'Glades', 'Gulf', 'Hamilton', 'Hardee', 'Hendry',
  'Hernando', 'Highlands', 'Hillsborough', 'Holmes', 'Indian River',
  'Jackson', 'Jefferson', 'Lafayette', 'Lake', 'Lee',
  'Leon', 'Levy', 'Liberty', 'Madison', 'Manatee',
  'Marion', 'Martin', 'Miami-Dade', 'Monroe', 'Nassau',
  'Okaloosa', 'Okeechobee', 'Orange', 'Osceola', 'Palm Beach',
  'Pasco', 'Pinellas', 'Polk', 'Putnam', 'Santa Rosa',
  'Sarasota', 'Seminole', 'St. Johns', 'St. Lucie', 'Sumter',
  'Suwannee', 'Taylor', 'Union', 'Volusia', 'Wakulla',
  'Walton', 'Washington',
];

const CountyInput = ({
  name = 'county',
  value,
  onChange,
  placeholder = 'Ej: Lee, Collier, Charlotte...',
  className = '',
  required = false,
  disabled = false,
}) => {
  const uid = useId();
  const listId = `county-list-${uid.replace(/:/g, '')}`;
  const [counties, setCounties] = useState(FALLBACK_COUNTIES);

  useEffect(() => {
    api.get('/permit/counties')
      .then(res => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          const sorted = [...new Set([...res.data, ...FALLBACK_COUNTIES])].sort();
          setCounties(sorted);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <>
      <input
        type="text"
        name={name}
        value={value ?? ''}
        onChange={onChange}
        list={listId}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className={className}
        autoComplete="off"
      />
      <datalist id={listId}>
        {counties.map(c => <option key={c} value={c} />)}
      </datalist>
    </>
  );
};

export default CountyInput;
