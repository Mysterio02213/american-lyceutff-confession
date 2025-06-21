import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./Home";
import Admin from "./Admin";
import Reports from "./Reports";
import Terms from "./Terms";
import Landing from "./Landing";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} /> {/* Landing page as root */}
        <Route path="/confess" element={<Home />} /> {/* Send confession */}
        <Route path="/admin-mysterio-lahorelahore" element={<Admin />} />
        <Route path="/report" element={<Reports />} />
        <Route path="/terms" element={<Terms />} />
      </Routes>
    </Router>
  );
}

export default App;
