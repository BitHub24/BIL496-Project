import React, { useState } from 'react';
import './SaveFavoriteModal.css';

interface SaveFavoriteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, tag: string | null) => void;
  defaultName?: string;
}

// Predefined tags
const PREDEFINED_TAGS = [
  { value: 'home', label: '🏠 Home' },
  { value: 'work', label: '💼 Work' },
  { value: 'school', label: '🎓 School' },
  { value: 'favorite', label: '⭐ Favorite' },
  { value: 'shopping', label: '🛍️ Shopping' },
  { value: 'restaurant', label: '🍽️ Restaurant' },
  { value: 'gym', label: '💪 Gym' },
  { value: 'other', label: '📍 Other' }
];

const SaveFavoriteModal: React.FC<SaveFavoriteModalProps> = ({ isOpen, onClose, onSave, defaultName }) => {
  const [name, setName] = useState(defaultName || '');
  const [tag, setTag] = useState(PREDEFINED_TAGS[0].value); // Select first tag as default

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim(), tag || null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Save Favorite Location</h2>
        <form onSubmit={handleSubmit}>
          <label>
            Name:
            <input 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="Enter location name"
              required 
            />
          </label>
          <label>
            Tag:
            <select 
              value={tag} 
              onChange={(e) => setTag(e.target.value)}
              className="tag-select"
            >
              {PREDEFINED_TAGS.map((tagOption) => (
                <option key={tagOption.value} value={tagOption.value}>
                  {tagOption.label}
                </option>
              ))}
            </select>
          </label>
          <div className="modal-buttons">
            <button type="submit">Save</button>
            <button type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SaveFavoriteModal;
