import React from 'react';
import { FavoriteLocation } from '../models/Models';
import './FavoritesBox.css';
import { toast } from 'sonner';

interface FavoritesBoxProps {
  favorites: FavoriteLocation[];
  onSelectFavorite: (favorite: FavoriteLocation) => void;
  onRemoveFavorite?: (id: string) => void;
}

const FavoritesBox: React.FC<FavoritesBoxProps> = ({ 
  favorites, 
  onSelectFavorite,
  onRemoveFavorite
}) => {
  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Tıklama olayının parent elementlere (li) geçmesini engelle
    
    if (onRemoveFavorite) {
      onRemoveFavorite(id);
    } else {
      toast.error('Silme fonksiyonu bulunamadı!');
    }
  };

  return (
    <div className="favorites-container">
      <div className="favorites-header">
        <h4>Favoriler</h4>
      </div>
      
      <div className="favorites-list-container">
        {favorites.length === 0 ? (
          <div className="no-favorites">Favori konum bulunamadı</div>
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
                {onRemoveFavorite && (
                  <button 
                    className="favorite-delete-btn"
                    onClick={(e) => handleDelete(e, favorite.id)}
                    title="Sil"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                      <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                      <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                    </svg>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default FavoritesBox; 