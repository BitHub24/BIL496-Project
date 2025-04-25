import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import './TransportModeSelector.css';

interface TransportModeSelectorProps {
  onModeChange: (mode: string) => void;
  selectedMode: string;
  onToggle: () => void;
}

const TransportModeSelector: React.FC<TransportModeSelectorProps> = ({ 
  onModeChange, 
  selectedMode, 
  onToggle 
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Add a small delay to ensure the component is mounted before showing
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const handleModeChange = (mode: string) => {
    // If selecting transit mode, check if the API is available
    if (mode === 'transit') {
      // Make a test call to check if the transit API is working
      checkTransitApiAvailability().then(available => {
        if (available) {
          onModeChange(mode);
          onToggle();
        } else {
          toast.error('Public transportation data is currently unavailable. Please try again later.');
        }
      });
    } else {
      onModeChange(mode);
      onToggle();
    }
  };

  // Function to check if transit API is available
  const checkTransitApiAvailability = async (): Promise<boolean> => {
    try {
      // Use a small timeout to avoid long waits
      // const controller = new AbortController();
      // const timeoutId = setTimeout(() => controller.abort(), 3000);

      let apiUrl;
      if (selectedMode === "transit") {
        apiUrl = `${import.meta.env.VITE_BACKEND_API_URL}/api/directions/transit/`;
      } else {
        apiUrl = `${import.meta.env.VITE_BACKEND_API_URL}/api/directions/route/`;
      }

      // Make a test request to the transit API
      const response = await axios.post(
        apiUrl,
        {
          start: { lat: 39.9334, lng: 32.8597 }, // Ankara center
          end: { lat: 39.9334, lng: 32.8697 }    // Nearby point
        },
        {
          headers: {
            'Authorization': `Token ${localStorage.getItem('token')}`
          },
          // signal: controller.signal
        }
      );

      // clearTimeout(timeoutId);
      return response.status === 200;
    } catch (error) {
      console.error('Transit API check failed:', error);
      return false;
    }
  };

  return (
    <div className={`transport-mode-selector ${isVisible ? 'visible' : ''}`}>
      <div className="mode-options">
        <button 
          className={`mode-button ${selectedMode === 'driving' ? 'active' : ''}`}
          onClick={() => handleModeChange('driving')}
          title="Driving"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
            <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
          </svg>
          <span>Driving</span>
        </button>
        
        <button 
          className={`mode-button ${selectedMode === 'transit' ? 'active' : ''}`}
          onClick={() => handleModeChange('transit')}
          title="Public Transit"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
            <path d="M12 2c-4.42 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-6H6V6h5v5zm5.5 6c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6h-5V6h5v5z"/>
          </svg>
          <span>Transit</span>
        </button>
        
        <button 
          className={`mode-button ${selectedMode === 'walking' ? 'active' : ''}`}
          onClick={() => handleModeChange('walking')}
          title="Walking"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
            <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7"/>
          </svg>
          <span>Walking</span>
        </button>
        
        <button 
          className={`mode-button ${selectedMode === 'cycling' ? 'active' : ''}`}
          onClick={() => handleModeChange('cycling')}
          title="Cycling"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
            <path d="M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-10l2.4-2.4.8.8c1.3 1.3 3 2.1 5.1 2.1V9c-1.5 0-2.7-.6-3.6-1.5l-1.9-1.9c-.5-.4-1-.6-1.6-.6s-1.1.2-1.4.6L7.8 8.4c-.4.4-.6.9-.6 1.4 0 .6.2 1.1.6 1.4L11 14v5h2v-6.2l-2.2-2.3zM19 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z"/>
          </svg>
          <span>Cycling</span>
        </button>
      </div>
    </div>
  );
};

export default TransportModeSelector;
