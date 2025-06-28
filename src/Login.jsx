import React, { useState } from "react";
import { auth } from "./firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import schoolLogo from "/android-chrome-192x192.png";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setChecking(true);

    const emailPattern = /^[a-zA-Z0-9._%+-]+@lycetuffians\.com$/;
    if (!emailPattern.test(email)) {
      setError(
        "Please enter a valid email in the format: name@lycetuffians.com"
      );
      setChecking(false);
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/home");
    } catch (err) {
      setError("Invalid email or password.");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-black via-gray-900 to-black text-white overflow-x-hidden font-sans flex flex-col items-center justify-center px-2">
      <div className="relative w-full max-w-xl mx-auto mt-6 mb-10">
        {/* School Logo */}
        <div className="flex justify-center mb-4">
          <img
            src={schoolLogo}
            alt="American Lycetuff Logo"
            className="h-20 w-auto sm:h-24 object-contain"
            style={{ maxWidth: "180px" }}
          />
        </div>
        <div className="relative z-10 rounded-2xl sm:rounded-3xl shadow-2xl border border-white/10 bg-gradient-to-br from-gray-900/80 via-black/90 to-gray-800/80 backdrop-blur-2xl overflow-hidden">
          <header className="w-full text-center py-7 px-3 sm:py-10 sm:px-6 bg-gradient-to-br from-black/80 via-gray-900/80 to-gray-800/80 border-b border-white/10">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent drop-shadow-lg mb-2">
              Welcome Back
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto text-base sm:text-lg">
              Sign in to your Lycetuff Social account
            </p>
          </header>

          <form
            onSubmit={handleLogin}
            className="p-4 sm:p-8 md:p-12 space-y-6 sm:space-y-8"
          >
            <div>
              <label className="block mb-1 font-semibold">Email:</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg p-3 bg-black border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-gray-400"
                placeholder="name@lycetuffians.com"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="block mb-1 font-semibold">Password:</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg p-3 bg-black border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-gray-400"
                placeholder="Your password"
                autoComplete="current-password"
              />
            </div>
            {error && (
              <div className="p-3 rounded-lg bg-gradient-to-r from-black via-gray-900 to-black border border-red-400/30 text-red-200 font-semibold text-sm transition-opacity duration-500">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={checking}
              className="w-full py-3 rounded-xl font-bold tracking-wide transition-all duration-300 flex items-center justify-center gap-2 shadow-lg border border-white/10 bg-gradient-to-br from-black via-gray-900 to-black text-white hover:scale-105 hover:shadow-2xl hover:border-white/30 active:scale-95 disabled:opacity-60"
            >
              {checking ? "Signing in..." : "Login"}
            </button>
            <div className="text-center mt-4">
              <span className="text-gray-400 text-sm">
                Don&apos;t have an account?{" "}
                <a
                  href="/signup"
                  className="text-blue-400 font-semibold underline hover:text-blue-200 transition"
                >
                  Sign Up
                </a>
              </span>
            </div>
          </form>
        </div>
      </div>
      <footer className="relative z-10 w-full text-center py-4 sm:py-6 text-gray-500 text-xs sm:text-sm border-t border-white/5 mt-auto px-2">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} American Lycetuff Social.</p>
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-2 py-1 text-transparent bg-clip-text bg-gradient-to-r from-gray-400 via-gray-300 to-gray-500 font-semibold text-xs underline hover:text-gray-300 hover:border-white/30 transition"
            style={{ marginLeft: 2, marginRight: 2 }}
          >
            Terms and Conditions
          </a>
        </div>
      </footer>
    </div>
  );
};

export default Login;
