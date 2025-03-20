import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import MapComponent from "./components/MapComponent";
import './App.css';
import Login from "./components/LoginComponent";

const App = () => {
  return (
    <BrowserRouter>
      <div className="App">
        <main>
          <Routes>
            <Route path="/" element={<Login/>} />
            <Route path="/map" element={<MapComponent/>} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
};

export default App;