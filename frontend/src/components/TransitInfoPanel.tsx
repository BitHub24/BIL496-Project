import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './TransitInfoPanel.css';

interface TransitSection {
  type: string;
  duration: number;
  distance: number;
  transport?: {
    mode: string;
    name: string;
    line: string;
    headsign: string;
  };
  departure?: {
    time: string;
    place: string;
  };
  arrival?: {
    time: string;
    place: string;
  };
}

interface TransitInfoPanelProps {
  transitInfo?: {
    sections: TransitSection[];
  };
  isVisible: boolean;
}

const TransitInfoPanel: React.FC<TransitInfoPanelProps> = ({ transitInfo, isVisible }) => {
  if (!isVisible || !transitInfo || !transitInfo.sections || transitInfo.sections.length === 0) {
    return null;
  }

  // Format time from ISO string
  const formatTime = (timeString: string): string => {
    if (!timeString) return '';
    try {
      const date = new Date(timeString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return timeString;
    }
  };

  // Format duration in minutes
  const formatDuration = (seconds: number): string => {
    const minutes = Math.round(seconds / 60);
    return `${minutes} min`;
  };

  // Get icon for transport mode
  const getTransportIcon = (mode: string): JSX.Element => {
    switch (mode) {
      case 'bus':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
            <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z" />
          </svg>
        );
      case 'subway':
      case 'train':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
            <path d="M12 2c-4.42 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-6H6V6h5v5zm5.5 6c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6h-5V6h5v5z" />
          </svg>
        );
      case 'walking':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
            <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7" />
          </svg>
        );
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
          </svg>
        );
    }
  };

  return (
    <div className="transit-info-panel">
      <h3>Public Transportation Route</h3>
      <div className="transit-sections">
        {transitInfo.sections.map((section, index) => (
          <div key={index} className={`transit-section ${section.type}`}>
            {section.type === 'transit' && section.transport ? (
              <div className="transit-section-content">
                <div className="transit-icon">
                  {getTransportIcon(section.transport.mode)}
                </div>
                <div className="transit-details">
                  <div className="transit-line">
                    <strong>{section.transport.line || section.transport.name}</strong>
                    {section.transport.headsign && ` → ${section.transport.headsign}`}
                  </div>
                  {section.departure && section.arrival && (
                    <div className="transit-stops">
                      <div className="transit-departure">
                        <span className="transit-time">{formatTime(section.departure.time)}</span>
                        <span className="transit-place">{section.departure.place}</span>
                      </div>
                      <div className="transit-duration">{formatDuration(section.duration)}</div>
                      <div className="transit-arrival">
                        <span className="transit-time">{formatTime(section.arrival.time)}</span>
                        <span className="transit-place">{section.arrival.place}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="transit-section-content">
                <div className="transit-icon">
                  {getTransportIcon(section.type)}
                </div>
                <div className="transit-details">
                  <div className="transit-line">
                    <strong>{section.type === 'pedestrian' ? 'Walk' : section.type}</strong>
                  </div>
                  <div className="transit-duration">{formatDuration(section.duration)}</div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TransitInfoPanel;
