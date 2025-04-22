import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { SearchBoxProps, SearchBoxRef, SearchResult } from '../models/Models';
import './SearchBox.css';

const SearchBox = forwardRef<SearchBoxRef, SearchBoxProps>(({ placeholder, onLocationSelect, children }, ref) => {
  const [query, setQueryState] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';

  useImperativeHandle(ref, () => ({
    setQuery: (newQuery: string) => {
      setQueryState(newQuery);
      setResults([]);
      setShowResults(false);
    }
  }));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (resultsRef.current && !resultsRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchAddress = async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    
    try {
      // Check if Google API key is available
      if (!GOOGLE_API_KEY) {
        console.error('Google API key is missing. Add VITE_GOOGLE_API_KEY to your .env file.');
        return;
      }

      // Call Google Geocoding API for search results
      const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query + ', Ankara, Turkey')}&key=${GOOGLE_API_KEY}&bounds=32.5,39.7|33.2,40.1`);
      const data = await response.json();
      
      // Convert lat and lng to strings
      const searchResults: SearchResult[] = data.results.map((item: any) => ({
        display_name: item.formatted_address,
        lat: item.geometry.location.lat.toString(),
        lon: item.geometry.location.lng.toString()
      }));

      setResults(searchResults);
      setShowResults(true);
    } catch (error) {
      console.error('Error searching addresses:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQueryState(value);
    if (value.length >= 3) {
      searchAddress(value);
    } else {
      setResults([]);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    setQueryState(result.display_name.split(',')[0]); // Show only the first part of the address
    onLocationSelect(parseFloat(result.lat), parseFloat(result.lon));
    setShowResults(false);
  };

  return (
    <div className="search-box" ref={resultsRef}>
      <input
        type="text"
        value={query}
        onChange={handleSearch}
        placeholder={placeholder}
        className="search-input"
        ref={inputRef}
      />
      {children}
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