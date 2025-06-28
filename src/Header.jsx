import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaHome, FaUserFriends, FaComments, FaUserCircle, FaSignOutAlt } from "react-icons/fa";
import { signOut } from "firebase/auth";
import { auth } from "./firebase";

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showLogout, setShowLogout] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  // Hide header on login/signup
  if (["/login", "/signup"].includes(location.pathname)) return null;

  // Placeholder: In a real app, listen to Firestore for unread/typing status
  useEffect(() => {
    // Simulate unread/typing for demo
    // setHasUnread(true) if there are unread messages or someone is typing
    // setHasUnread(false) otherwise
    // You would replace this with Firestore logic
  }, []);

  const handleLogout = async () => {
    setShowLogout(false);
    await signOut(auth);
    navigate("/login");
  };

  return (
    <>
      <header className="w-full flex items-center justify-between px-4 py-3 bg-black border-b border-white/10 shadow-2xl rounded-b-2xl">
        <div className="flex items-center gap-3">
          <img
            src="/android-chrome-512x512.png"
            alt="Logo"
            className="w-10 h-10"
          />
          <span className="text-xl sm:text-2xl font-extrabold tracking-tight select-none bg-gradient-to-r from-white via-gray-300 to-gray-500 bg-clip-text text-transparent">
            AmericanLycetuff Social
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/home")} className="p-2 rounded-full hover:bg-white/10 transition" title="Home">
            <FaHome className="text-xl text-white" />
          </button>
          <button onClick={() => navigate("/social")} className="p-2 rounded-full hover:bg-white/10 transition" title="Social">
            <FaUserFriends className="text-xl text-white" />
          </button>
          <button onClick={() => navigate("/messaging")} className="relative p-2 rounded-full hover:bg-white/10 transition" title="Messages">
            <FaComments className="text-xl text-white" />
            {hasUnread && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
            )}
          </button>
          <button onClick={() => navigate("/profile")} className="p-2 rounded-full hover:bg-white/10 transition" title="Profile">
            <FaUserCircle className="text-xl text-white" />
          </button>
          <button onClick={() => setShowLogout(true)} className="p-2 rounded-full hover:bg-white/10 transition" title="Logout">
            <FaSignOutAlt className="text-xl text-white" />
          </button>
        </div>
      </header>
      {showLogout && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-white/95 to-gray-200/95 text-black rounded-2xl shadow-2xl p-6 min-w-[280px] flex flex-col items-center border border-black/10">
            <p className="mb-4 text-lg font-semibold">Are you sure you want to logout?</p>
            <div className="flex gap-4">
              <button onClick={handleLogout} className="px-4 py-2 rounded-xl bg-black text-white font-bold hover:bg-gray-900 border border-white/10 transition shadow">Logout</button>
              <button onClick={() => setShowLogout(false)} className="px-4 py-2 rounded-xl bg-gray-200 text-black font-bold hover:bg-gray-300 border border-black/10 transition shadow">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
