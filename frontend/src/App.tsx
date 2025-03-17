import React, { useState } from 'react';
import Login from './components/Login';
import MapComponent from './components/MapComponent'; // MapComponent, mevcut proje harita sayfası

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  return (
    <div className="App">
      {isLoggedIn ? (
        <MapComponent />
      ) : (
        <Login onLogin={() => setIsLoggedIn(true)} />
      )}
    </div>
  );
}

export default App;
