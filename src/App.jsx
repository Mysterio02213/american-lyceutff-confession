import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./Home";
import Admin from "./Admin";
import Reports from "./Reports"; // <-- Add this import

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin-mysterio-lahorelahore" element={<Admin />} />
        <Route path="/report" element={<Reports />} />{" "}
        {/* <-- Add this route */}
      </Routes>
    </Router>
  );
}

export default App;
