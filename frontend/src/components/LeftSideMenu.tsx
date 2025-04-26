import React from 'react';
import './LeftSideMenu.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTaxi, faWifi, faBicycle, faPills } from '@fortawesome/free-solid-svg-icons';

interface LeftSideMenuProps {
  isLoadingTaxis: boolean;
  showWifi: boolean;
  loadingWifi: boolean;
  showBicycle: boolean;
  loadingBicycle: boolean;
  loadingPharmacies: boolean;
  showPharmacies: boolean;
  onTaxiClick: () => void;
  onWifiClick: () => void;
  onBicycleClick: () => void;
  onPharmacyClick: () => void;
  isTransportExpanded: boolean;
  className?: string;
}

const LeftSideMenu: React.FC<LeftSideMenuProps> = ({
  isLoadingTaxis,
  showWifi,
  loadingWifi,
  showBicycle,
  loadingBicycle,
  loadingPharmacies,
  showPharmacies,
  onTaxiClick,
  onWifiClick,
  onBicycleClick,
  onPharmacyClick,
  isTransportExpanded,
  className = ''
}) => {
  return (
    <div className={`left-side-menu ${className} ${isTransportExpanded ? 'transport-expanded' : ''}`}>
      <button 
        onClick={onTaxiClick} 
        className={`left-menu-item ${isLoadingTaxis ? 'loading' : ''}`} 
        title="Find Nearby Taxis" 
        disabled={isLoadingTaxis}
      >
        <FontAwesomeIcon icon={faTaxi} className="icon-left-menu" />
        <span className="menu-label">Find Taxis</span>
      </button>
      <button 
        onClick={onWifiClick} 
        className={`left-menu-item ${showWifi ? 'active' : ''} ${loadingWifi ? 'loading' : ''}`} 
        title="Toggle WiFi Hotspots" 
        disabled={loadingWifi}
      >
        <FontAwesomeIcon icon={faWifi} className="icon-left-menu" style={{color: 'rgb(0, 11, 212)'}} />
        <span className="menu-label">WiFi Points</span>
      </button>
      <button 
        onClick={onBicycleClick} 
        className={`left-menu-item ${showBicycle ? 'active' : ''} ${loadingBicycle ? 'loading' : ''}`} 
        title="Toggle Bicycle Stations" 
        disabled={loadingBicycle}
      >
        <FontAwesomeIcon icon={faBicycle} className="icon-left-menu" style={{color: 'rgb(63, 63, 63)'}} />
        <span className="menu-label">Bicycle Stations</span>
      </button>
      <button 
        onClick={onPharmacyClick} 
        className={`left-menu-item ${showPharmacies ? 'active' : ''} ${loadingPharmacies ? 'loading' : ''}`} 
        title="Toggle Duty Pharmacies" 
      >
        <FontAwesomeIcon icon={faPills} className="icon-left-menu" style={{color: 'rgb(199, 14, 14)'}} />
        <span className="menu-label">Duty Pharmacies</span>
      </button>
    </div>
  );
};

export default LeftSideMenu; 