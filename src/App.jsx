import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Confession from "./Confession";
import Admin from "./Admin";
import Reports from "./Reports";
import Terms from "./Terms";
import Landing from "./Landing";
import SignUp from "./SignUp";
import Login from "./Login";
import Home from "./Home"; // Import the new Home page
import Post from "./Post";
import Profile from "./Profile";
import EditProfile from "./EditProfile";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} /> {/* Landing page as root */}
        <Route path="/confess" element={<Confession />} />{" "}
        {/* Send confession */}
        <Route path="/admin-mysterio-lahorelahore" element={<Admin />} />
        <Route path="/report" element={<Reports />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/signup" element={<SignUp />} /> {/* Sign Up route */}
        <Route path="/login" element={<Login />} /> {/* Login route */}
        <Route path="/home" element={<Home />} /> {/* Protected Home page */}
        <Route path="/post" element={<Post />} /> {/* Plus button redirect */}
        <Route path="/profile" element={<Profile />} />
        <Route path="/edit-profile" element={<EditProfile />} />
      </Routes>
    </Router>
  );
}

export default App;
