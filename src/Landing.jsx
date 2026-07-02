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

  const actions = [
    {
      label: "Send a Confession",
      icon: FaPaperPlane,
      onClick: () => navigate("/confess"),
      primary: true,
    },
    {
      label: "Terms & Conditions",
      icon: FaLock,
      onClick: () => navigate("/terms"),
    },
    {
      label: "Report a Confession",
      icon: FaExclamationTriangle,
      onClick: () => navigate("/report"),
    },
  ];

  return (
    <div className="relative min-h-screen w-full bg-gradient-to-br from-black via-gray-950 to-black flex flex-col items-center justify-center px-4 overflow-hidden">
      {/* Ambient gloom — soft drifting blobs + vignette, same language as the rest of the site */}
      <div className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 sm:w-96 sm:h-96 bg-gradient-to-br from-gray-700 via-gray-900 to-black rounded-full opacity-25 blur-3xl animate-pulse" />
      <div
        className="pointer-events-none absolute -bottom-24 -right-24 w-72 h-72 sm:w-96 sm:h-96 bg-gradient-to-tr from-gray-700 via-gray-900 to-black rounded-full opacity-25 blur-3xl animate-pulse"
        style={{ animationDelay: "1.5s" }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)]" />

      {/* Faint grain/noise for texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative z-10 max-w-md w-full mx-auto p-8 sm:p-10 rounded-3xl bg-gradient-to-br from-gray-900/80 via-black/90 to-gray-800/80 border border-white/10 shadow-2xl backdrop-blur-xl flex flex-col items-center gap-8 animate-[fadeIn_0.6s_ease]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gray-800 to-black border border-white/10 flex items-center justify-center shadow-inner">
            <FaLock className="text-gray-300 text-xl" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-500 bg-clip-text text-transparent text-center drop-shadow-lg">
            American Lycetuff Confessions
          </h1>
          <p className="text-gray-500 text-center text-sm sm:text-base max-w-xs">
            A quiet place to say what you can't say out loud. Everything here
            stays anonymous.
          </p>
        </div>

        <div className="flex flex-col gap-4 w-full">
          {actions.map(({ label, icon: Icon, onClick, primary }) => (
            <button
              key={label}
              onClick={onClick}
              className={`group relative flex items-center gap-4 w-full py-4 px-5 rounded-2xl font-semibold text-left shadow-lg border transition-all duration-300 hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-white/30 ${
                primary
                  ? "bg-gradient-to-br from-gray-100 via-white to-gray-200 text-black border-white/80 hover:shadow-[0_0_30px_rgba(255,255,255,0.15)]"
                  : "bg-gradient-to-br from-gray-900/80 via-black/80 to-gray-900/80 text-gray-200 border-white/10 hover:border-white/25 hover:bg-gray-900"
              }`}
            >
              <span
                className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 transition-transform duration-300 group-hover:scale-110 ${
                  primary
                    ? "bg-black/10 text-black"
                    : "bg-white/5 text-white border border-white/10"
                }`}
              >
                <Icon className="text-lg" />
              </span>
              <span
                className={`text-base sm:text-lg ${primary ? "font-extrabold" : "font-semibold"}`}
              >
                {label}
              </span>
              <span
                className={`ml-auto text-lg transition-transform duration-300 group-hover:translate-x-1 ${
                  primary ? "text-black/40" : "text-gray-600"
                }`}
              >
                &rarr;
              </span>
            </button>
          ))}
        </div>
      </div>

      <footer className="relative z-10 mt-8 text-gray-600 text-xs text-center px-4">
        &copy; {new Date().getFullYear()} American Lycetuff Confessions. All
        rights reserved.
      </footer>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
