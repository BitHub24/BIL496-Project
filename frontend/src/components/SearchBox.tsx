import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import axios from 'axios';
import './SearchBox.css';
import { 
    SearchBoxProps, 
    SearchBoxRef, 
    SearchResult, 
    GoogleGeocodingResponse, 
    AddressComponent 
} from '../models/Models';

// SearchResult tipini genişletelim 
interface ExtendedSearchResult extends SearchResult {
  name?: string; 
  street?: string;
  street_number?: string;
  district?: string; 
  city?: string; 
  full_address: string; 
}

// Yardımcı fonksiyon
const findComponent = (components: AddressComponent[], type: string): string | undefined => {
    return components.find(comp => comp.types.includes(type))?.long_name;
};

// forwardRef doğrudan kullanıldı, render fonksiyonu ayrılmadı
const SearchBox = forwardRef<SearchBoxRef, SearchBoxProps & { onFocus?: () => void }>((
    { placeholder, onLocationSelect, children, onFocus }, 
    ref
) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ExtendedSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      setShowResults(false);
      return;
    }
    setIsLoading(true);
    try {
      const googleApiKey = localStorage.getItem('googleApiKey');
      if (!googleApiKey) throw new Error('Google API key not found');
      const response = await axios.get<GoogleGeocodingResponse>(
          'https://maps.googleapis.com/maps/api/geocode/json',
          {
              params: { 
                  address: `${searchQuery}, Ankara, Turkey`,
                  key: googleApiKey,
                  bounds: '32.5,39.7|33.2,40.1',
               }
          }
      );
      const searchResults: ExtendedSearchResult[] = response.data.results.map(item => {
           const components = item.address_components;
           const name = findComponent(components, 'establishment') || 
                        findComponent(components, 'point_of_interest') || 
                        findComponent(components, 'premise');
           const street_number = findComponent(components, 'street_number');
           const street = findComponent(components, 'route');
           const district = findComponent(components, 'administrative_area_level_2');
           const city = findComponent(components, 'locality') || findComponent(components, 'administrative_area_level_1');
           const primaryName = name || (street && street_number ? `${street} ${street_number}` : street || item.formatted_address.split(',')[0]);
           return {
               display_name: item.formatted_address,
               lat: item.geometry.location.lat.toString(),
               lon: item.geometry.location.lng.toString(),
               name: primaryName,
               street: street,
               street_number: street_number,
               district: district,
               city: city,
               full_address: item.formatted_address
           };
      });
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
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    if (value.length >= 3) {
      debounceTimeoutRef.current = setTimeout(() => {
        searchAddress(value);
      }, 500); 
    } else {
      setResults([]);
      setShowResults(false);
    }
  };

  const handleFocus = () => {
    if (onFocus) onFocus();
    if (results.length > 0) {
        setShowResults(true);
    }
  };

  const handleResultClick = (item: ExtendedSearchResult) => {
      setQuery(item.name || item.full_address.split(',')[0]); 
      // onLocationSelect'i 3 argümanla çağır, tip hatasını 'as any' ile bastır
      (onLocationSelect as any)(parseFloat(item.lat), parseFloat(item.lon), item.full_address);
      setShowResults(false);
  };

  // JSX basitleştirildi: Sadece liste görünümü
  return (
    <div className="search-box" ref={searchBoxRef}>
      <input
        type="text"
        value={query}
        onChange={handleSearch}
        placeholder={placeholder}
        className="search-input"
        onFocus={handleFocus} 
      />
      {children}
      {isLoading && <div className="loading-indicator">Searching...</div>}
      
      {/* Basit liste görünümü (eski .search-results stilleri kullanılabilir) */}
      {showResults && results.length > 0 && (
        <ul className="search-results"> 
          {results.map((result, index) => (
            <li 
              key={`search-${index}`} 
              className="search-result-item" 
              onClick={() => handleResultClick(result)}
            >
              {result.name || result.full_address} 
              {/* Yıldız butonu kaldırıldı */}
            </li>
          ))}
        </ul>
      )}
      {/* No results mesajı */}
       {showResults && results.length === 0 && query.length >= 3 && !isLoading && (
            <ul className="search-results">
                 <li className="no-results">No results found for "{query}".</li>
            </ul>
       )}
    </div>
  );
}); // forwardRef doğrudan burada biter

export default SearchBox; 