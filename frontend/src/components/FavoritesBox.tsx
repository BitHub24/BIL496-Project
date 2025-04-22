import React from 'react';
import { FavoriteLocation } from '../models/Models';
import './FavoritesBox.css';

interface FavoritesBoxProps {
  favorites: FavoriteLocation[];
  onSelectFavorite: (favorite: FavoriteLocation) => void;
}

const FavoritesBox: React.FC<FavoritesBoxProps> = ({ 
  favorites, 
  onSelectFavorite
}) => {
  return (
    <div className="favorites-container">
      <div className="favorites-header">
        <h4>Favorites</h4>
      </div>
      
      <div className="favorites-list-container">
        {favorites.length === 0 ? (
          <div className="no-favorites">No favorite locations found</div>
        ) : (
          <ul className="favorites-list">
            {favorites.map((favorite) => (
              <li 
                key={favorite.id} 
                className="favorite-item"
                onClick={() => onSelectFavorite(favorite)}
                title={favorite.address}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/>
                </svg>
                <span className="favorite-name">{favorite.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default FavoritesBox; 