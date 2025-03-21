import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import axios from 'axios';
import './SearchBox.css';

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
}

interface GoogleGeocodingResponse {
  results: {
    formatted_address: string;
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
  }[];
  status: string;
}

interface SearchBoxProps {
  placeholder: string;
  onLocationSelect: (lat: number, lng: number) => void;
}

export interface SearchBoxRef {
  setQuery: (query: string) => void;
}

const SearchBox = forwardRef<SearchBoxRef, SearchBoxProps>(({ placeholder, onLocationSelect }, ref) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    setQuery: (newQuery: string) => {
      setQuery(newQuery);
      setResults([]);
      setShowResults(false);
    }
  }));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchAddress = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }
  
    setIsLoading(true);
    try {
      // Retrieve the Google API key from local storage
      const googleApiKey = localStorage.getItem('googleApiKey');
      if (!googleApiKey) {
        throw new Error('Google API key not found in local storage');
      }
  
      const response = await axios.get<GoogleGeocodingResponse>('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          address: `${searchQuery}, Ankara, Turkey`,
          key: googleApiKey,
          bounds: '32.5,39.7|33.2,40.1', // Ankara bounds
        }
      });
  
      // Convert lat and lng to strings
      const searchResults: SearchResult[] = response.data.results.map(item => ({
        display_name: item.formatted_address,
        lat: item.geometry.location.lat.toString(), // Convert to string
        lon: item.geometry.location.lng.toString() // Convert to string
      }));
  
      setResults(searchResults);
      setShowResults(true);
    } catch (error) {
      console.error('Error searching address:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    if (value.length >= 3) {
      searchAddress(value);
    } else {
      setResults([]);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    setQuery(result.display_name.split(',')[0]); // Show only the first part of the address
    onLocationSelect(parseFloat(result.lat), parseFloat(result.lon));
    setShowResults(false);
  };

  return (
    <div className="search-box" ref={searchBoxRef}>
      <input
        type="text"
        value={query}
        onChange={handleSearch}
        placeholder={placeholder}
        className="search-input"
      />
      {isLoading && <div className="loading-indicator">Searching...</div>}
      {showResults && results.length > 0 && (
        <ul className="search-results">
          {results.map((result, index) => (
            <li
              key={index}
              onClick={() => handleResultClick(result)}
              className="search-result-item"
            >
              {result.display_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

export default SearchBox; 