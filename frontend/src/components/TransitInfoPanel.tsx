import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './TransitInfoPanel.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBus, 
  faTrain, 
  faSubway, 
  faWalking, 
  faBicycle,
  faCar
} from '@fortawesome/free-solid-svg-icons';

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
  const [panelVisible, setPanelVisible] = useState(false);
  const [sectionsVisible, setSectionsVisible] = useState<number[]>([]);

  useEffect(() => {
    if (isVisible) {
      setPanelVisible(true);
      // Add staggered animations for sections
      const timers = transitInfo?.sections?.map((_: any, index: number) => 
        setTimeout(() => {
          setSectionsVisible(prev => [...prev, index]);
        }, index * 100)
      );
      return () => timers?.forEach(timer => clearTimeout(timer));
    } else {
      setPanelVisible(false);
      setSectionsVisible([]);
    }
  }, [isVisible, transitInfo]);

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

  const getTransportIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'bus':
        return faBus;
      case 'train':
        return faTrain;
      case 'subway':
        return faSubway;
      case 'walking':
        return faWalking;
      case 'bicycling':
        return faBicycle;
      case 'driving':
        return faCar;
      default:
        return faBus;
    }
  };

  return (
    <div className={`transit-info-panel ${panelVisible ? 'visible' : ''}`}>
      <h3>Public Transportation Route</h3>
      <div className="transit-sections">
        {transitInfo.sections.map((section, index) => (
          <div 
            key={index} 
            className={`transit-section ${section.type} ${sectionsVisible.includes(index) ? 'visible' : ''}`}
          >
            <div className="transit-section-header">
              <div className="transit-icon">
                <FontAwesomeIcon icon={getTransportIcon(section.type)} />
              </div>
              <h3 className="transit-section-title">{section.type}</h3>
            </div>
            <div className="transit-section-content">
              {section.type === 'transit' && section.transport ? (
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
              ) : (
                <div className="transit-details">
                  <div className="transit-line">
                    <strong>{section.type === 'pedestrian' ? 'Walk' : section.type}</strong>
                  </div>
                  <div className="transit-duration">{formatDuration(section.duration)}</div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TransitInfoPanel;
