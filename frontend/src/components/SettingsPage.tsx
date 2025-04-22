import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import './SettingsPage.css';
import HamburgerMenu from './HamburgerMenu';

interface RoadSegment {
  id: number;
  osm_id: number;
  name: string;
  road_type: string;
}

interface RoadPreference {
  id: number;
  road_segment: number;
  road_name: string;
  preference_type: 'prefer' | 'avoid';
  reason: string;
  destination_address: string;
  travel_mode: string;
  distance: number | null;
  duration: number | null;
  traveled_at: string;
  source_lat?: number;
  source_lng?: number;
  destination_lat?: number;
  destination_lng?: number;
}

interface PreferenceProfile {
  id: number;
  name: string;
  is_default: boolean;
  description: string;
  prefer_multiplier: number;
  avoid_multiplier: number;
}

interface FavoriteLocation {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  tag?: string | null;
  created_at: string;
  updated_at: string;
}

interface UserProfileData {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  user_profile: {
    phone_number: string | null;
    profile_picture: string | null;
  }
}

interface SettingsPageProps {
  isLoggedIn: boolean;
  onLogout: () => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ isLoggedIn, onLogout }) => {
  // User profile state (address kaldırıldı)
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');

  // Şifre state'leri
  const [currentPassword, setCurrentPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');

  // Road preferences state
  const [preferredRoads, setPreferredRoads] = useState<RoadPreference[]>([]);
  const [avoidedRoads, setAvoidedRoads] = useState<RoadPreference[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedRoad, setSelectedRoad] = useState<any | null>(null);
  const [preferenceReason, setPreferenceReason] = useState<string>('');

  // Preference profiles state
  const [profiles, setProfiles] = useState<PreferenceProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<PreferenceProfile | null>(null);
  const [newProfileName, setNewProfileName] = useState<string>('');
  const [newProfileDescription, setNewProfileDescription] = useState<string>('');
  const [preferMultiplier, setPreferMultiplier] = useState<number>(0.75);
  const [avoidMultiplier, setAvoidMultiplier] = useState<number>(3.0);

  // Saved locations state (SavedLocation -> FavoriteLocation)
  const [favoriteLocations, setFavoriteLocations] = useState<FavoriteLocation[]>([]);

  // Active tab state
  const [activeTab, setActiveTab] = useState<string>('profile');
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);

  // Fetch user data (address state update kaldırıldı)
  const fetchUserProfile = useCallback(async () => {
    const token = localStorage.getItem("token");
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_REACT_APP_BACKEND_API_URL}/api/users/profile/`,
        {
          headers: { Authorization: `Token ${token}` },
        }
      );
      console.log('[API Response] User Data:', response.data);
      
      if (response.data) {
        const userData = response.data;
        setUsername(userData.username);
        setEmail(userData.email);
        setFirstName(userData.first_name || ''); // Boş gelirse '' ata
        setLastName(userData.last_name || '');   // Boş gelirse '' ata
        setPhoneNumber(userData.user_profile?.phone_number || ''); // Opsiyonel zincirleme ve boş kontrolü
        console.log('[State Update] Profile data set.');
      } else {
        console.error('API response format is incorrect or missing data');
        toast.error('Failed to parse user profile data');
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      toast.error('Failed to load user profile');
    }
  }, []);

  // Fetch road preferences
  const fetchPreferences = useCallback(async () => {
    const token = localStorage.getItem("token");
    try {
      const preferredResponse = await axios.get(
        `${import.meta.env.VITE_REACT_APP_BACKEND_API_URL}/api/routing/preferences/preferred/`,
        {
          headers: { Authorization: `Token ${token}` },
        }
      );
      setPreferredRoads(preferredResponse.data as RoadPreference[]);

      const avoidedResponse = await axios.get(
        `${import.meta.env.VITE_REACT_APP_BACKEND_API_URL}/api/routing/preferences/avoided/`,
        {
          headers: { Authorization: `Token ${token}` },
        }
      );
      setAvoidedRoads(avoidedResponse.data as RoadPreference[]);
    } catch (error) {
      console.error('Error fetching road preferences:', error);
      toast.error('Failed to load road preferences');
    }
  }, []);

  // Fetch preference profiles
  const fetchProfiles = useCallback(async () => {
    const token = localStorage.getItem("token");
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_REACT_APP_BACKEND_API_URL}/api/routing/profiles/`,
        { headers: { Authorization: `Token ${token}` } }
      );
      setProfiles(response.data as PreferenceProfile[]);

      // Get default profile
      const defaultResponse = await axios.get(
        `${import.meta.env.VITE_REACT_APP_BACKEND_API_URL}/api/routing/profiles/default/`,
        { headers: { Authorization: `Token ${token}` } }
      );
      const defaultProfile = defaultResponse.data as PreferenceProfile | null;
      setSelectedProfile(defaultProfile);
      if (defaultProfile) {
        setPreferMultiplier(defaultProfile.prefer_multiplier);
        setAvoidMultiplier(defaultProfile.avoid_multiplier);
      }
    } catch (error) {
      console.error('Error fetching profiles:', error);
      toast.error('Failed to load preference profiles');
    }
  }, []);

  // Fetch saved locations (URL ve state güncellendi -> FavoriteLocation)
  const fetchFavorites = useCallback(async () => {
    const token = localStorage.getItem("token");
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_REACT_APP_BACKEND_API_URL}/api/users/favorites/`,
        { headers: { Authorization: `Token ${token}` } }
      );
      setFavoriteLocations(response.data as FavoriteLocation[]);
    } catch (error) {
      console.error('Error fetching favorite locations:', error);
      toast.error('Failed to load favorite locations');
    }
  }, []);

  // Update password
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) return;
    const headers = { Authorization: `Token ${token}` };

    try {
      await axios.post(`${import.meta.env.VITE_REACT_APP_BACKEND_API_URL}/api/users/change-password/`, 
        {
          current_password: currentPassword,
          new_password: newPassword
        },
        { headers } // Pass headers
      );
      
      toast.success('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Error updating password:', error);
      toast.error('Failed to update password');
    }
  };

  // Search for roads
  const handleSearchChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value;
    setSearchQuery(query);
    if (query.length > 2) {
      try {
        const response = await axios.get(
          `${import.meta.env.VITE_REACT_APP_BACKEND_API_URL}/api/routing/road-segments/search/`,
          {
            params: { query },
            headers: { Authorization: `Token ${localStorage.getItem("token")}` },
          }
        );
        setSearchResults(response.data as RoadSegment[]);
      } catch (error) {
        console.error('Error searching roads:', error);
        toast.error('Failed to search for roads');
      }
    }
  };

  // Separate function for button click
  const handleSearchClick = async () => {
    if (searchQuery.length < 3) {
      toast.error('Please enter at least 3 characters');
      return;
    }
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_REACT_APP_BACKEND_API_URL}/api/routing/road-segments/search/`,
        {
          params: { query: searchQuery }, // Use searchQuery directly
          headers: { Authorization: `Token ${localStorage.getItem("token")}` },
        }
      );
      setSearchResults(response.data as RoadSegment[]);
    } catch (error) {
      console.error('Error searching roads:', error);
      toast.error('Failed to search for roads');
    }
  };

  // Add road preference - Ensure type is 'preferred' | 'avoided'
  const handleAddPreference = async (roadSegmentId: number, type: "preferred" | "avoided") => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const headers = { Authorization: `Token ${token}` };

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_REACT_APP_BACKEND_API_URL}/api/routing/preferences/`,
        {
          road_segment: roadSegmentId,
          preference_type: type,
          reason: preferenceReason
        },
        { headers } // Pass headers
      );

      // Update local state
      if (type === 'preferred') {
        setPreferredRoads([...preferredRoads, response.data as RoadPreference]);
      } else {
        setAvoidedRoads([...avoidedRoads, response.data as RoadPreference]);
      }

      setPreferenceReason("");
      setSelectedRoad(null);
      setSearchResults([]);
      
      toast.success(`Road added to ${type} roads`);
    } catch (error) {
      console.error('Error adding preference:', error);
      toast.error('Failed to add road preference');
    }
  };

  // Remove road preference
  const handleDeletePreference = async (preferenceId: number) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const headers = { Authorization: `Token ${token}` };
    try {
      await axios.delete(
        `${import.meta.env.VITE_REACT_APP_BACKEND_API_URL}/api/routing/preferences/${preferenceId}/`,
        { headers } // Pass headers
      );

      // Update local state
      const updatedPreferredRoads = preferredRoads.filter(road => road.id !== preferenceId);
      const updatedAvoidedRoads = avoidedRoads.filter(road => road.id !== preferenceId);
      setPreferredRoads(updatedPreferredRoads);
      setAvoidedRoads(updatedAvoidedRoads);
      
      toast.success('Road preference removed');
    } catch (error) {
      console.error('Error removing preference:', error);
      toast.error('Failed to remove road preference');
    }
  };

  // Create new profile
  const handleSaveProfile = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const headers = { Authorization: `Token ${token}` };

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_REACT_APP_BACKEND_API_URL}/api/routing/profiles/`,
        {
          name: newProfileName,
          description: newProfileDescription,
          prefer_multiplier: preferMultiplier,
          avoid_multiplier: avoidMultiplier,
          is_default: profiles.length === 0 // Make default if first profile
        },
        { headers } // Pass headers
      );

      // Update local state
      setProfiles([...profiles, response.data as PreferenceProfile]);
      setSelectedProfile(response.data as PreferenceProfile);

      // Clear form
      setNewProfileName('');
      setNewProfileDescription('');
      
      toast.success('Profile created successfully');
    } catch (error) {
      console.error('Error creating profile:', error);
      toast.error('Failed to create profile');
    }
  };

  // Set profile as default
  const handleSetDefaultProfile = async (profileId: number) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const headers = { Authorization: `Token ${token}` };
    try {
      const response = await axios.post(
        `${import.meta.env.VITE_REACT_APP_BACKEND_API_URL}/api/routing/profiles/${profileId}/set_default/`,
        {}, // Empty data for POST often needed
        { headers } // Pass headers
      );

      // Update local state
      const updatedProfiles = profiles.map(profile => ({
        ...profile,
        is_default: profile.id === profileId
      }));
      setProfiles(updatedProfiles);
      setSelectedProfile(response.data as PreferenceProfile);
      
      toast.success('Default profile updated');
    } catch (error) {
      console.error('Error setting default profile:', error);
      toast.error('Failed to update default profile');
    }
  };

  // Update profile multipliers
  const handleUpdateProfileMultipliers = async () => {
    if (!selectedProfile) {
      toast.error('Please select a profile first');
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) return;
    const headers = { Authorization: `Token ${token}` };

    try {
      const response = await axios.patch(
        `${import.meta.env.VITE_REACT_APP_BACKEND_API_URL}/api/routing/profiles/${selectedProfile.id}/`,
        {
          prefer_multiplier: preferMultiplier,
          avoid_multiplier: avoidMultiplier
        },
        { headers } // Pass headers
      );

      // Update local state
      const updatedProfiles = profiles.map(profile => 
        profile.id === selectedProfile.id ? response.data as PreferenceProfile : profile
      );
      setProfiles(updatedProfiles);
      setSelectedProfile(response.data as PreferenceProfile);
      
      toast.success('Profile multipliers updated');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile multipliers');
    }
  };

  // Delete saved location
  const handleDeleteFavorite = async (locationId: number) => {
    const token = localStorage.getItem("token");
    if (!token) return;
    const headers = { Authorization: `Token ${token}` };

    try {
      await axios.delete(
        `${import.meta.env.VITE_REACT_APP_BACKEND_API_URL}/api/users/favorites/${locationId}/`,
        { headers }
      );
      setFavoriteLocations(favoriteLocations.filter(loc => loc.id !== locationId));
      toast.success('Favorite location deleted successfully!');
    } catch (error) {
      console.error('Error deleting favorite location:', error);
      toast.error('Failed to delete favorite location');
    }
  };

  // Format duration from seconds to readable format
  const formatDuration = (seconds: number | null): string => {
    if (seconds === null) return 'Unknown';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  // Render öncesi loglama
  console.log('[Render Check] Username:', username, 'Email:', email);

  // Yeni toggle fonksiyonu
  const toggleHamburgerMenu = () => {
    setIsHamburgerOpen(!isHamburgerOpen);
  };

  // Yeni Profil Güncelleme Fonksiyonu
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        toast.error('Authentication error. Please log in.');
        return;
      }
      const headers = { Authorization: `Token ${token}` };
      const profileData = {
        first_name: firstName,
        last_name: lastName,
        user_profile: {
          phone_number: phoneNumber || null,
        },
      };

      // Username ve Email update için ayrı kontrol (backend UserSerializer'a göre)
      const userData: { [key: string]: any } = {};
      // Eğer backend username/email güncellemesine izin veriyorsa (UserSerializer'da required=False ise)
      // userData.username = username;
      // userData.email = email;

      // Hem User hem UserProfile güncellemesi için UserDetailView'a (PUT/PATCH /api/users/user/)
      const response = await axios.patch(
        `${import.meta.env.VITE_REACT_APP_BACKEND_API_URL}/api/users/user/`,
        { ...userData, user_profile: profileData.user_profile, first_name: firstName, last_name: lastName }, // User ve UserProfile verilerini birleştir
        { headers }
      );

      console.log('[API Response] Profile Update:', response.data);
      toast.success('Profile updated successfully!');

      // State'i güncelleyebiliriz (opsiyonel, sayfa yenilemesi de işe yarar)
      // setFirstName(response.data.first_name || '');
      // setLastName(response.data.last_name || '');
      // setPhoneNumber(response.data.user_profile?.phone_number || '');

    } catch (error: any) {
      console.error('Error updating profile:', error);
      const errorMsg = error.response?.data?.detail || error.response?.data?.error || 'Failed to update profile';
      toast.error(`Profile update failed: ${errorMsg}`);
    }
  };

  return (
    <div className="settings-container">
      <div className="settings-top-right">
        <HamburgerMenu 
          isLoggedIn={isLoggedIn} 
          onLogout={onLogout} 
          isOpen={isHamburgerOpen} 
          onToggle={toggleHamburgerMenu} 
          openDirection="down"
        />
      </div>
      
      <h1>Settings</h1>
      
      <div className="settings-tabs">
        <button 
          className={`tab-button ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          Profile
        </button>
        <button 
          className={`tab-button ${activeTab === 'road-preferences' ? 'active' : ''}`}
          onClick={() => setActiveTab('road-preferences')}
        >
          Road Preferences
        </button>
        <button 
          className={`tab-button ${activeTab === 'saved-locations' ? 'active' : ''}`}
          onClick={() => setActiveTab('saved-locations')}
        >
          Favorite Locations
        </button>
      </div>
      
      <div className="settings-content">
        {activeTab === 'profile' && (
          <div className="settings-section">
            <h2>User Profile</h2>
            
            {/* Profil Bilgileri Formu */}
            <form onSubmit={handleProfileUpdate} className="profile-form">
              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  readOnly
                  className="readonly-input"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="firstName">First Name</label>
                <input
                  type="text"
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="lastName">Last Name</label>
                <input
                  type="text"
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="phoneNumber">Phone Number</label>
                <input
                  type="tel"
                  id="phoneNumber"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>
              
              <button type="submit" className="save-profile-button">
                Save Profile
              </button>
            </form>
            
            {/* Şifre Değiştirme Bölümü Ayrı */}
            <div className="password-section">
              <h3>Change Password</h3>
              <form onSubmit={handleUpdatePassword} className="password-form">
                <div className="form-group">
                  <label htmlFor="current-password">Current Password</label>
                  <input
                    type="password"
                    id="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="new-password">New Password</label>
                  <input
                    type="password"
                    id="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="confirm-password">Confirm New Password</label>
                  <input
                    type="password"
                    id="confirm-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                
                <button type="submit" className="update-password-button">
                  Update Password
                </button>
              </form>
            </div>
          </div>
        )}
        
        {activeTab === 'road-preferences' && (
          <div className="settings-section">
            <h2>Road Preferences</h2>
            
            <div className="search-section">
              <h3>Search for Roads</h3>
              <div className="search-box">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder="Enter road name (min 3 characters)"
                  className="search-input"
                />
                <button 
                  onClick={handleSearchClick}
                  disabled={searchQuery.length < 3}
                  className="search-button"
                >
                  Search
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
                      onClick={() => handleAddPreference(selectedRoad.id, 'preferred')}
                      className="prefer-button"
                    >
                      Prefer This Road
                    </button>
                    <button 
                      onClick={() => handleAddPreference(selectedRoad.id, 'avoided')}
                      className="avoid-button"
                    >
                      Avoid This Road
                    </button>
                  </div>
                </div>
              )}
            </div>
            
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
                          onClick={() => handleDeletePreference(pref.id)}
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
                          onClick={() => handleDeletePreference(pref.id)}
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
                              handleSetDefaultProfile(profile.id);
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
                      onClick={handleUpdateProfileMultipliers}
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
                    onClick={handleSaveProfile}
                    disabled={!newProfileName}
                    className="create-button"
                  >
                    Create Profile
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'saved-locations' && (
          <div className="settings-section">
            <h2>Favorite Locations</h2>
            
            {favoriteLocations.length === 0 ? (
              <p>You don't have any favorite locations yet.</p>
            ) : (
              <ul className="locations-list">
                {favoriteLocations.map(location => (
                  <li key={location.id} className={`location-item ${location.tag}`}>
                    <div className="location-info">
                      <h3>{location.name}</h3>
                      <p className="location-address">{location.address}</p>
                      <p className="location-tag">{location.tag || 'No tag'}</p>
                    </div>
                    <div className="location-actions">
                      <button 
                        onClick={() => {
                          // Navigate to map with this location
                          window.location.href = `/map?lat=${location.latitude}&lng=${location.longitude}&name=${encodeURIComponent(location.name)}`;
                        }}
                        className="use-location-btn"
                      >
                        Use
                      </button>
                      <button 
                        onClick={() => handleDeleteFavorite(location.id)}
                        className="delete-location-btn"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
