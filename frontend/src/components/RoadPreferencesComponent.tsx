import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './RoadPreferencesComponent.css';

interface RoadSegment {
  id: number;
  osm_id: number;
  name: string;
  road_type: string;
}

interface UserPreference {
  id: number;
  road_segment: number;
  road_name: string;
  preference_type: 'prefer' | 'avoid';
  reason: string;
}

interface PreferenceProfile {
  id: number;
  name: string;
  is_default: boolean;
  description: string;
  prefer_multiplier: number;
  avoid_multiplier: number;
}

const RoadPreferencesComponent: React.FC = () => {
  // State for road search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RoadSegment[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // State for user preferences
  const [preferredRoads, setPreferredRoads] = useState<UserPreference[]>([]);
  const [avoidedRoads, setAvoidedRoads] = useState<UserPreference[]>([]);
  const [selectedRoad, setSelectedRoad] = useState<RoadSegment | null>(null);
  const [preferenceReason, setPreferenceReason] = useState('');
  
  // State for preference profiles
  const [profiles, setProfiles] = useState<PreferenceProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<PreferenceProfile | null>(null);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileDescription, setNewProfileDescription] = useState('');
  const [preferMultiplier, setPreferMultiplier] = useState(0.75);
  const [avoidMultiplier, setAvoidMultiplier] = useState(3.0);
  
  // Fetch user preferences on component mount
  useEffect(() => {
    fetchUserPreferences();
    fetchProfiles();
  }, []);
  
  // Fetch user's preferred and avoided roads
  const fetchUserPreferences = useCallback(async () => {
    const token = localStorage.getItem("token");
    try {
      const preferredResponse = await axios.get(
        `${import.meta.env.VITE_BACKEND_API_URL}/api/routing/preferences/preferred/`,
        {
          headers: { Authorization: `Token ${token}` },
        }
      );
      setPreferredRoads(preferredResponse.data as UserPreference[]);
      
      const avoidedResponse = await axios.get(
        `${import.meta.env.VITE_BACKEND_API_URL}/api/routing/preferences/avoided/`,
        {
          headers: { Authorization: `Token ${token}` },
        }
      );
      setAvoidedRoads(avoidedResponse.data as UserPreference[]);
    } catch (error) {
      console.error('Error fetching user preferences:', error);
    }
  }, []);
  
  // Fetch user's preference profiles
  const fetchProfiles = useCallback(async () => {
    const token = localStorage.getItem("token");
    try {
      const response = await axios.get(`${import.meta.env.VITE_BACKEND_API_URL}/api/routing/profiles/`,
       { headers: { Authorization: `Token ${token}` },
      });
      setProfiles(response.data as PreferenceProfile[]);
      
      // Get default profile
      const defaultResponse = await axios.get(`${import.meta.env.VITE_BACKEND_API_URL}/api/routing/profiles/default/`,
       { headers: { Authorization: `Token ${token}` },
      });
      const defaultProfile = defaultResponse.data as PreferenceProfile | null;
      setSelectedProfile(defaultProfile);
      if (defaultProfile) {
        setPreferMultiplier(defaultProfile.prefer_multiplier);
        setAvoidMultiplier(defaultProfile.avoid_multiplier);
      }
    } catch (error) {
      console.error('Error fetching profiles:', error);
    }
  }, []);
  
  // Search for roads
  const searchRoads = async () => {
    if (searchQuery.length < 3) return;
    
    setIsSearching(true);
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_BACKEND_API_URL}/api/routing/road-segments/search/`,
        { params: { q: searchQuery } }
      );
      setSearchResults(response.data as RoadSegment[]);
    } catch (error) {
      console.error('Error searching roads:', error);
    } finally {
      setIsSearching(false);
    }
  };
  
  // Add road preference
  const addPreference = async (preferenceType: 'prefer' | 'avoid') => {
    if (!selectedRoad) return;
    
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_BACKEND_API_URL}/api/routing/preferences/`,
        {
          road_segment: selectedRoad.id,
          preference_type: preferenceType,
          reason: preferenceReason
        }
      );
      
      // Update local state
      if (preferenceType === 'prefer') {
        setPreferredRoads([...preferredRoads, response.data as UserPreference]);
      } else {
        setAvoidedRoads([...avoidedRoads, response.data as UserPreference]);
      }
      
      // Clear selection
      setSelectedRoad(null);
      setPreferenceReason('');
      setSearchQuery('');
      setSearchResults([]);
    } catch (error) {
      console.error('Error adding preference:', error);
    }
  };
  
  // Remove road preference
  const removePreference = async (preferenceId: number, preferenceType: 'prefer' | 'avoid') => {
    try {
      await axios.delete(
        `${import.meta.env.VITE_BACKEND_API_URL}/api/routing/preferences/${preferenceId}/`
      );
      
      // Update local state
      if (preferenceType === 'prefer') {
        setPreferredRoads(preferredRoads.filter(road => road.id !== preferenceId));
      } else {
        setAvoidedRoads(avoidedRoads.filter(road => road.id !== preferenceId));
      }
    } catch (error) {
      console.error('Error removing preference:', error);
    }
  };
  
  // Create new profile
  const createProfile = async () => {
    if (!newProfileName) return;
    
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_BACKEND_API_URL}/api/routing/profiles/`,
        {
          name: newProfileName,
          description: newProfileDescription,
          prefer_multiplier: preferMultiplier,
          avoid_multiplier: avoidMultiplier,
          is_default: profiles.length === 0 // Make default if first profile
        }
      );
      
      // Update local state
      setProfiles([...profiles, response.data as PreferenceProfile]);
      setSelectedProfile(response.data as PreferenceProfile);
      
      // Clear form
      setNewProfileName('');
      setNewProfileDescription('');
    } catch (error) {
      console.error('Error creating profile:', error);
    }
  };
  
  // Set profile as default
  const setAsDefault = async (profileId: number) => {
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_BACKEND_API_URL}/api/routing/profiles/${profileId}/set_default/`
      );
      
      // Update local state
      const updatedProfiles = profiles.map(profile => ({
        ...profile,
        is_default: profile.id === profileId
      }));
      setProfiles(updatedProfiles);
      setSelectedProfile(response.data as PreferenceProfile);
    } catch (error) {
      console.error('Error setting default profile:', error);
    }
  };
  
  // Update profile multipliers
  const updateProfileMultipliers = async () => {
    if (!selectedProfile) return;
    
    try {
      const response = await axios.patch(
        `${import.meta.env.VITE_BACKEND_API_URL}/api/routing/profiles/${selectedProfile.id}/`,
        {
          prefer_multiplier: preferMultiplier,
          avoid_multiplier: avoidMultiplier
        }
      );
      
      // Update local state
      const updatedProfiles = profiles.map(profile => 
        profile.id === selectedProfile.id ? response.data as PreferenceProfile : profile
      );
      setProfiles(updatedProfiles);
      setSelectedProfile(response.data as PreferenceProfile);
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };
  
  return (
    <div className="road-preferences-container">
      <h2>Road Preferences</h2>
      
      {/* Road Search Section */}
      <div className="search-section">
        <h3>Search for Roads</h3>
        <div className="search-box">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Enter road name (min 3 characters)"
            className="search-input"
          />
          <button 
            onClick={searchRoads} 
            disabled={searchQuery.length < 3 || isSearching}
            className="search-button"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>
        
        {searchResults.length > 0 && (
          <div className="search-results">
            <h4>Search Results</h4>
            <ul className="results-list">
              {searchResults.map(road => (
                <li 
                  key={road.id} 
                  className={selectedRoad?.id === road.id ? 'selected' : ''}
                  onClick={() => setSelectedRoad(road)}
                >
                  <span className="road-name">{road.name}</span>
                  <span className="road-type">{road.road_type}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        {selectedRoad && (
          <div className="preference-form">
            <h4>Add Preference for {selectedRoad.name}</h4>
            <textarea
              value={preferenceReason}
              onChange={(e) => setPreferenceReason(e.target.value)}
              placeholder="Reason for preference (optional)"
              className="preference-reason"
            />
            <div className="preference-buttons">
              <button 
                onClick={() => addPreference('prefer')}
                className="prefer-button"
              >
                Prefer This Road
              </button>
              <button 
                onClick={() => addPreference('avoid')}
                className="avoid-button"
              >
                Avoid This Road
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Current Preferences Section */}
      <div className="current-preferences">
        <div className="preferred-roads">
          <h3>Preferred Roads</h3>
          {preferredRoads.length === 0 ? (
            <p>No preferred roads set</p>
          ) : (
            <ul className="preference-list">
              {preferredRoads.map(pref => (
                <li key={pref.id}>
                  <div className="preference-info">
                    <span className="road-name">{pref.road_name}</span>
                    {pref.reason && <span className="reason">{pref.reason}</span>}
                  </div>
                  <button 
                    onClick={() => removePreference(pref.id, 'prefer')}
                    className="remove-button"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        
        <div className="avoided-roads">
          <h3>Avoided Roads</h3>
          {avoidedRoads.length === 0 ? (
            <p>No avoided roads set</p>
          ) : (
            <ul className="preference-list">
              {avoidedRoads.map(pref => (
                <li key={pref.id}>
                  <div className="preference-info">
                    <span className="road-name">{pref.road_name}</span>
                    {pref.reason && <span className="reason">{pref.reason}</span>}
                  </div>
                  <button 
                    onClick={() => removePreference(pref.id, 'avoid')}
                    className="remove-button"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      
      {/* Preference Profiles Section */}
      <div className="preference-profiles">
        <h3>Preference Profiles</h3>
        
        <div className="profiles-list">
          <h4>Your Profiles</h4>
          {profiles.length === 0 ? (
            <p>No profiles created yet</p>
          ) : (
            <ul>
              {profiles.map(profile => (
                <li 
                  key={profile.id}
                  className={`profile-item ${profile.is_default ? 'default' : ''} ${selectedProfile?.id === profile.id ? 'selected' : ''}`}
                  onClick={() => setSelectedProfile(profile)}
                >
                  <div className="profile-info">
                    <span className="profile-name">{profile.name}</span>
                    {profile.is_default && <span className="default-badge">Default</span>}
                    {profile.description && <p className="profile-description">{profile.description}</p>}
                  </div>
                  {!profile.is_default && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setAsDefault(profile.id);
                      }}
                      className="default-button"
                    >
                      Set as Default
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        
        <div className="profile-settings">
          <h4>Profile Settings</h4>
          {selectedProfile ? (
            <div className="multiplier-settings">
              <h5>{selectedProfile.name}</h5>
              <div className="multiplier-control">
                <label>Preferred Road Multiplier:</label>
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={preferMultiplier}
                  onChange={(e) => setPreferMultiplier(parseFloat(e.target.value))}
                />
                <span>{preferMultiplier.toFixed(2)}x</span>
                <p className="multiplier-description">
                  Lower values make preferred roads more attractive (faster).
                </p>
              </div>
              
              <div className="multiplier-control">
                <label>Avoided Road Multiplier:</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={avoidMultiplier}
                  onChange={(e) => setAvoidMultiplier(parseFloat(e.target.value))}
                />
                <span>{avoidMultiplier.toFixed(2)}x</span>
                <p className="multiplier-description">
                  Higher values make avoided roads less attractive (slower).
                </p>
              </div>
              
              <button 
                onClick={updateProfileMultipliers}
                className="update-button"
              >
                Update Multipliers
              </button>
            </div>
          ) : (
            <p>Select a profile to adjust settings</p>
          )}
        </div>
        
        <div className="new-profile">
          <h4>Create New Profile</h4>
          <div className="profile-form">
            <input
              type="text"
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              placeholder="Profile Name"
              className="profile-input"
            />
            <textarea
              value={newProfileDescription}
              onChange={(e) => setNewProfileDescription(e.target.value)}
              placeholder="Description (optional)"
              className="profile-description-input"
            />
            <button 
              onClick={createProfile}
              disabled={!newProfileName}
              className="create-button"
            >
              Create Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoadPreferencesComponent;
