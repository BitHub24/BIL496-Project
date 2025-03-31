import React from "react";
import './NavigationUI.css';

interface NavigationUIProps {
  directions: string[];
}

const NavigationUI: React.FC<NavigationUIProps> = ({ directions }) => {
  // Yönlere göre resimleri render et
  const renderImage = (direction: string) => {
    switch (direction) {
      case "right":
        return <img src="/images/right-arrow.png" alt="Right Arrow" className="arrow-image" />;
      case "left":
        return <img src="/images/left-arrow.png" alt="Left Arrow" className="arrow-image" />;
      case "up":
        return <img src="/images/up-arrow.png" alt="Up Arrow" className="arrow-image" />;
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
              {renderImage(direction)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default NavigationUI;
