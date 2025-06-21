import React from "react";
import {
  FaPaperPlane,
  FaFileAlt,
  FaExclamationTriangle,
  FaLock,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-black via-gray-900 to-black flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full mx-auto p-8 rounded-2xl bg-gradient-to-br from-gray-900/90 via-black/90 to-gray-800/90 border border-gray-700 shadow-2xl flex flex-col items-center gap-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-2 text-center drop-shadow-lg">
          American Lycetuff Confessions
        </h1>
        <p className="text-gray-400 text-center mb-4">
          Welcome! Please choose an option below to continue.
        </p>
        <div className="flex flex-col gap-5 w-full">
          <button
            onClick={() => navigate("/confess")}
            className="flex items-center justify-center gap-3 w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-br from-gray-800 via-gray-900 to-black text-white shadow-lg border border-gray-500 hover:scale-105 hover:bg-gray-900 transition-all focus:outline-none"
            style={{ fontWeight: 800, fontSize: "1.25rem" }}
          >
            <FaPaperPlane className="text-white text-2xl" />
            Send a Confession
          </button>
          <button
            onClick={() => navigate("/terms")}
            className="flex items-center justify-center gap-3 w-full py-3 rounded-xl font-semibold text-base bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white shadow border border-gray-600 hover:bg-gray-800 hover:scale-105 transition-all focus:outline-none"
          >
            <FaLock className="text-white text-xl" />
            Terms & Conditions
          </button>
          <button
            onClick={() => navigate("/report")}
            className="flex items-center justify-center gap-3 w-full py-3 rounded-xl font-semibold text-base bg-gradient-to-br from-gray-800 via-gray-900 to-black text-white shadow border border-gray-700 hover:bg-gray-900 hover:scale-105 transition-all focus:outline-none"
          >
            <FaExclamationTriangle className="text-white text-xl" />
            Report a Confession
          </button>
        </div>
      </div>
      <footer className="mt-8 text-gray-500 text-xs text-center">
        &copy; {new Date().getFullYear()} American Lycetuff Confessions. All
        rights reserved.
      </footer>
    </div>
  );
}
