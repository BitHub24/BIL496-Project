import React from "react";
import './NavigationUI.css';

interface NavigationUIProps {
  directions: string[]; // yönler
}

const NavigationUI: React.FC<NavigationUIProps> = ({ directions }) => {
  // Yönlere göre ok simgeleri ve açıklamalar
  const renderArrow = (direction: string) => {
    switch (direction) {
      case "right":
        return (
          <>
            <span className="arrow-icon">→</span>
            <span>Sağa dön</span>
          </>
        );
      case "left":
        return (
          <>
            <span className="arrow-icon">←</span>
            <span>Sola dön</span>
          </>
        );
      case "up":
        return (
          <>
            <span className="arrow-icon">↑</span>
            <span>Dümdüz ilerle</span>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="navigation-container">
      {directions.map((direction, index) => (
        <div className="direction-item" key={index}>
          <div className={`direction-arrow ${direction}`}>
            <div className="speech-bubble">
              {renderArrow(direction)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default NavigationUI;
