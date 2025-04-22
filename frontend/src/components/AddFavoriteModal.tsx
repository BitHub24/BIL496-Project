import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { FavoriteLocation, PointOfInterest } from '../models/Models';
import './AddFavoriteModal.css';

interface AddFavoriteModalProps {
  point?: PointOfInterest;
  isOpen: boolean;
  onClose: () => void;
  onSave: (favorite: FavoriteLocation) => void;
  token?: string | null;
}

const AddFavoriteModal: React.FC<AddFavoriteModalProps> = ({ 
  point, 
  isOpen, 
  onClose, 
  onSave,
  token
}) => {
  const [name, setName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // İlk açılışta nokta bilgilerine göre isim alanını doldur
  useEffect(() => {
    if (point) {
      setName(point.name);
    }
  }, [point]);

  // ESC tuşuna basıldığında modal'ı kapat
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  // Modal dışına tıklandığında kapat
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Favori kaydetme işlemi - Artık API çağrısı yapmıyoruz, direkt parent'a bildirim veriyoruz
  const handleSave = () => {
    if (!point) return;
    
    if (!name.trim()) {
      toast.error('Lütfen favori için bir isim girin');
      return;
    }

    setIsSaving(true);

    try {
      // Parent bileşene favori bilgilerini gönder
      const favorite: FavoriteLocation = {
        id: Date.now().toString(), // Geçici ID, API'de zaten değişecek
        name: name,
        address: point.address || '',
        lat: point.lat,
        lng: point.lng
      };
      
      // Parent bileşendeki onSave fonksiyonunu çağır
      onSave(favorite);
      setIsSaving(false);
      onClose();
    } catch (error) {
      console.error('Error saving favorite:', error);
      toast.error('Favori kaydedilirken bir hata oluştu');
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content">
        <div className="modal-header">
          <h3>Favorilere Ekle</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          {point && (
            <>
              <div className="location-info">
                <p><strong>{point.name}</strong></p>
                {point.address && <p>{point.address}</p>}
                {point.phone && <p>Telefon: {point.phone}</p>}
              </div>
              
              <div className="form-group">
                <label htmlFor="favorite-name">Favori İsmi:</label>
                <input 
                  id="favorite-name"
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Favori için bir isim girin"
                  autoFocus
                />
              </div>
            </>
          )}
        </div>
        
        <div className="modal-footer">
          <button 
            className="cancel-button" 
            onClick={onClose}
            disabled={isSaving}
          >
            İptal
          </button>
          <button 
            className="save-button" 
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
          >
            {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddFavoriteModal; 