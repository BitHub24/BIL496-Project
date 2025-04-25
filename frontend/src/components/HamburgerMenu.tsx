import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './HamburgerMenu.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars } from '@fortawesome/free-solid-svg-icons';

interface HamburgerMenuProps {
  isLoggedIn: boolean;
  onLogout: () => void;
  isOpen: boolean;
  onToggle: () => void;
  openDirection: 'up' | 'down';
}

const HamburgerMenu: React.FC<HamburgerMenuProps> = ({ isLoggedIn, onLogout, isOpen, onToggle, openDirection }) => {
  const navigate = useNavigate();

  const handleLogoutClick = () => {
    localStorage.removeItem('token');
    onLogout();
    onToggle();
    navigate('/');
  };

  const handleLinkClick = () => {
    onToggle();
  };

  return (
    <div className="hamburger-menu-container">
      <button onClick={onToggle} className="hamburger-button">
        <FontAwesomeIcon icon={faBars} />
      </button>
      {isOpen && (
        <div className={`menu-items ${openDirection === 'up' ? 'open-up' : 'open-down'}`}>
          {isLoggedIn ? (
            <>
              <Link to="/map" className="menu-item" onClick={handleLinkClick}>Map</Link>
              <Link to="/settings" className="menu-item" onClick={handleLinkClick}>Settings</Link>
              <button onClick={handleLogoutClick} className="menu-item logout-button">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/" className="menu-item" onClick={handleLinkClick}>Login</Link>
              <Link to="/register" className="menu-item" onClick={handleLinkClick}>Register</Link>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default HamburgerMenu; 