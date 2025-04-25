import React, { useState } from 'react';
import './SaveFavoriteModal.css';

interface SaveFavoriteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, tag: string | null) => void;
  defaultName?: string;
}

const SaveFavoriteModal: React.FC<SaveFavoriteModalProps> = ({ isOpen, onClose, onSave, defaultName }) => {
  const [name, setName] = useState(defaultName || '');
  const [tag, setTag] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim(), tag.trim() || null);
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
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Tag (optional):
            <input value={tag} onChange={(e) => setTag(e.target.value)} />
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
