import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Confession from "./Confession";
import Admin from "./Admin";
import Reports from "./Reports";
import Terms from "./Terms";
import Landing from "./Landing";
import SignUp from "./SignUp";
import Login from "./Login";
import Home from "./Home";
import Post from "./Post";
import Profile from "./Profile";
import EditProfile from "./EditProfile";
import Social from "./Social";
import Messaging from "./Messaging";
import Header from "./Header";
import ProfileView from "./ProfileView";
import { auth } from "./firebase";

// Simple dev-only private route wrapper
const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === "development";
const PrivateRoute = ({ children }) => {
  if (isDev) return children;
  // In production, block access and show 404
  return <Navigate to="/404" replace />;
};

// Simple 404 page
const NotFound = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white">
    <h1 className="text-5xl font-bold mb-4">404</h1>
    <p className="text-xl">Page Not Found</p>
  </div>
);

function App() {
  return (
    <Router>
      <Header />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/confess" element={<Confession />} />
        <Route path="/admin-mysterio-lahorelahore" element={<Admin />} />
        <Route path="/report" element={<Reports />} />
        <Route path="/terms" element={<Terms />} />
        {/* Private/dev-only routes */}
        <Route
          path="/signup"
          element={
            <PrivateRoute>
              <SignUp />
            </PrivateRoute>
          }
        />
        <Route
          path="/login"
          element={
            <PrivateRoute>
              <Login />
            </PrivateRoute>
          }
        />
        <Route
          path="/home"
          element={
            <PrivateRoute>
              <Home />
            </PrivateRoute>
          }
        />
        <Route
          path="/post"
          element={
            <PrivateRoute>
              <Post />
            </PrivateRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <PrivateRoute>
              <Profile />
            </PrivateRoute>
          }
        />
        <Route
          path="/edit-profile"
          element={
            <PrivateRoute>
              <EditProfile />
            </PrivateRoute>
          }
        />
        <Route
          path="/social"
          element={
            <PrivateRoute>
              <Social />
            </PrivateRoute>
          }
        />
        <Route
          path="/messaging"
          element={
            <PrivateRoute>
              <Messaging />
            </PrivateRoute>
          }
        />
        <Route
          path="/profile/:userId"
          element={
            <PrivateRoute>
              <ProfileView />
            </PrivateRoute>
          }
        />
        {/* 404 route */}
        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
