import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  addDoc,
  collection,
  Timestamp,
  doc as firestoreDoc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";
import sendToDiscord from "./sendToDiscord";
import {
  FaInstagram,
  FaPaperPlane,
  FaLock,
  FaBan,
  FaCheckCircle,
  FaExclamationTriangle,
  FaClock,
  FaUserCircle,
  FaEyeSlash,
  FaSun,
  FaMoon,
} from "react-icons/fa";
import axios from "axios";
import { UAParser } from "ua-parser-js";
import { HexColorPicker } from "react-colorful";
import { Filter } from "bad-words";

const MAX_WORDS = 1000;
// Hard ceiling on raw character count — purely a safety net against pasting
// one giant blob of text with no spaces (which would otherwise count as a
// single "word"), not the primary limit users interact with.
const SOFT_CHAR_CAP = 8000;
const THEME_STORAGE_KEY = "confessionTheme";
const MAX_USERNAME_LENGTH = 30;
// Instagram-style handle: letters, numbers, periods, underscores.
const USERNAME_PATTERN = /^[a-zA-Z0-9._]{1,30}$/;

// ---------------------------------------------------------------------------
// Profanity filter — built once, reused on every keystroke/submit instead of
// re-instantiating the base filter and re-compiling the regex list each time.
// ---------------------------------------------------------------------------
const baseFilter = new Filter();

const CUSTOM_PROFANITY_PATTERNS = [
  // English
  "f\\s*u\\s*c\\s*k",
  "s\\s*h\\s*i\\s*t",
  "b\\s*i\\s*t\\s*c\\s*h",
  "a\\s*s\\s*s",
  "a\\s*s\\s*h\\s*o\\s*l\\s*e",
  "b\\s*a\\s*s\\s*t\\s*a\\s*r\\s*d",
  "c\\s*u\\s*n\\s*t",
  "d\\s*i\\s*c\\s*k",
  "p\\s*u\\s*s\\s*y",
  "w\\s*h\\s*o\\s*r\\s*e",
  "s\\s*l\\s*u\\s*t",
  "n\\s*i\\s*g\\s*g\\s*a",
  "n\\s*i\\s*g\\s*g\\s*e\\s*r",
  // Roman Urdu / Hindi
  "g\\s*a\\s*n\\s*d",
  "l\\s*o\\s*d\\s*a",
  "l\\s*u\\s*n\\s*d",
  "c\\s*h\\s*u\\s*t\\s*i\\s*y\\s*a",
  "b\\s*h\\s*e\\s*n\\s*c\\s*h\\s*o\\s*d",
  "m\\s*a\\s*d\\s*a\\s*r\\s*c\\s*h\\s*o\\s*d",
  "r\\s*a\\s*n\\s*d\\s*i",
  "r\\s*a\\s*n\\s*d\\s*y",
  "k\\s*a\\s*m\\s*i\\s*n\\s*i",
  // Unicode / homoglyphs
  "ѕех",
  "ｓｅｘ",
  "fυck",
  "𝒇𝒖𝒄𝒌",
].map((p) => new RegExp(p, "i"));

const DIRECT_PROFANITY_WORDS = new Set([
  "fuck",
  "shit",
  "bitch",
  "ass",
  "asshole",
  "bastard",
  "cunt",
  "dick",
  "pussy",
  "whore",
  "slut",
  "nigger",
  "nigga",
  "gand",
  "gaand",
  "loda",
  "lora",
  "lund",
  "chod",
  "choda",
  "chodna",
  "chutiya",
  "bsdk",
  "bhenchod",
  "behnchod",
  "mc",
  "madarchod",
  "randi",
  "ghasti",
  "bhosdike",
  "bhosadi",
  "penchod",
  "maa ki chut",
  "maa ka bhosda",
  "behen ke laude",
  "laundiya",
  "chinal",
  "khanki",
  "randi baz",
  "kamini",
  "kutiya",
  "kutti",
  "saali",
  "harami",
  "haraamzada",
  "kameena",
  "suar",
  "suar ki aulad",
  "gandu",
  "chodu",
]);

const LEET_MAP = { 1: "i", 3: "e", 4: "a", 5: "s", 0: "o", "@": "a", $: "s" };

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9@$\s]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/(.)\1{2,}/g, "$1") // fuuuuuck -> fuck
    .replace(/[0-9@$]/g, (char) => LEET_MAP[char] || char);
}

function containsProfanity(text) {
  if (!text) return false;
  const normalized = normalizeText(text);

  if (baseFilter.isProfane(normalized)) return true;
  if (CUSTOM_PROFANITY_PATTERNS.some((regex) => regex.test(normalized))) {
    return true;
  }

  const words = normalized.split(/\s+/);
  return words.some((word) => DIRECT_PROFANITY_WORDS.has(word));
}

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

/** Unified toast — replaces four near-identical copy/pasted status blocks. */
function Toast({ tone, icon, children, visible, dark = true }) {
  const toneStyles = dark
    ? {
        success:
          "from-green-700/20 via-green-900/30 to-black/10 border-green-400/30 text-green-200",
        error:
          "from-red-700/20 via-red-900/30 to-black/10 border-red-400/30 text-red-200",
        warning:
          "from-yellow-700/20 via-yellow-900/30 to-black/10 border-yellow-400/30 text-yellow-200",
      }
    : {
        success:
          "from-green-100 via-green-50 to-white border-green-400/50 text-green-800",
        error:
          "from-red-100 via-red-50 to-white border-red-400/50 text-red-800",
        warning:
          "from-amber-100 via-amber-50 to-white border-amber-400/50 text-amber-800",
      };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`p-3 sm:p-4 rounded-lg sm:rounded-xl bg-gradient-to-r border transition-all duration-500 ${
        toneStyles[tone]
      } ${visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1 pointer-events-none"}`}
    >
      <p className="flex items-center gap-2 font-semibold text-xs sm:text-base">
        {icon}
        {children}
      </p>
    </div>
  );
}

function WordCounter({ current, max, dark }) {
  const remaining = max - current;
  const low = remaining <= max * 0.1;
  const pct = Math.min(100, (current / max) * 100);

  return (
    <div className="absolute bottom-3 right-4 sm:bottom-4 sm:right-6 flex items-center gap-2">
      <div
        className={`hidden sm:block w-16 h-1 rounded-full overflow-hidden ${
          dark ? "bg-white/10" : "bg-black/10"
        }`}
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            low ? "bg-amber-400" : dark ? "bg-white/50" : "bg-slate-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div
        className={`text-xs font-mono px-2 py-1 rounded border shadow-sm whitespace-nowrap ${
          low
            ? "text-amber-400 border-amber-400/30 bg-amber-400/10"
            : dark
              ? "text-gray-300 border-white/10 bg-gray-900/70"
              : "text-slate-600 border-black/10 bg-white/80"
        }`}
      >
        {remaining} words left
      </div>
    </div>
  );
}

export default function ConfessionPage() {
  // Theme: dark by default, persisted across visits.
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "dark";
    return localStorage.getItem(THEME_STORAGE_KEY) || "dark";
  });
  const isDark = theme === "dark";

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const [message, setMessage] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [ip, setIp] = useState("");
  const [cooldownError, setCooldownError] = useState(false);
  const [profanityError, setProfanityError] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState("");
  const [customColorEnabled, setCustomColorEnabled] = useState(false);
  const [customColor, setCustomColor] = useState("#ffffff");
  const [isBanned, setIsBanned] = useState(false);
  const [banReason, setBanReason] = useState("");

  // Username / identity reveal
  const [showIdentity, setShowIdentity] = useState(false);
  const [username, setUsername] = useState("");
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [usernameTouched, setUsernameTouched] = useState(false);

  const [formError, setFormError] = useState("");
  const usernameInputRef = useRef(null);

  const wordCount = useMemo(() => {
    const trimmed = message.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [message]);

  // Word-limited textarea input: once the confession reaches MAX_WORDS words,
  // further typing is trimmed back down instead of silently overflowing.
  const handleMessageChange = useCallback((e) => {
    const value = e.target.value;
    const trimmed = value.trim();
    const words = trimmed ? trimmed.split(/\s+/) : [];
    if (words.length > MAX_WORDS) {
      setMessage(words.slice(0, MAX_WORDS).join(" "));
    } else {
      setMessage(value);
    }
  }, []);

  // Sanitize username as the user types: strip spaces/@ and disallowed chars,
  // cap length. This keeps the field always valid instead of erroring on submit.
  const handleUsernameChange = useCallback((e) => {
    const raw = e.target.value;
    const cleaned = raw
      .replace(/^@+/, "")
      .replace(/\s/g, "")
      .replace(/[^a-zA-Z0-9._]/g, "")
      .slice(0, MAX_USERNAME_LENGTH);
    setUsername(cleaned);
    setUsernameTouched(true);
  }, []);

  const usernameIsValid = !showIdentity || USERNAME_PATTERN.test(username);
  const usernameError =
    showIdentity && usernameTouched && username.length === 0
      ? "Enter a username or turn this off."
      : showIdentity && usernameTouched && !usernameIsValid
        ? "Letters, numbers, periods and underscores only."
        : "";

  useEffect(() => {
    if (showIdentity) {
      // Focus the field the moment the option is revealed.
      requestAnimationFrame(() => usernameInputRef.current?.focus());
    } else {
      setUsername("");
      setIdentityConfirmed(false);
      setUsernameTouched(false);
    }
  }, [showIdentity]);

  useEffect(() => {
    const fetchIp = async () => {
      try {
        const res = await axios.get("https://api.ipify.org?format=json");
        setIp(res.data.ip);
      } catch (error) {
        console.error("Failed to fetch IP:", error);
      }
    };
    fetchIp();
  }, []);

  useEffect(() => {
    const parser = new UAParser();
    const result = parser.getResult();
    const deviceInfoString = `
      OS: ${result.os.name || "Unknown"} ${result.os.version || ""}
      | Browser: ${result.browser.name || "Unknown"} ${result.browser.version || ""}
      | Device Type: ${result.device.type || "Desktop"}
      | Device Brand: ${result.device.vendor || "Unknown"}
      | Device Model: ${result.device.model || "Unknown"}
    `
      .replace(/\s+/g, " ")
      .trim();
    setDeviceInfo(deviceInfoString);
  }, []);

  // Live ban check
  useEffect(() => {
    if (!ip) return;
    const banDocRef = firestoreDoc(db, "bannedIps", ip);
    const unsubscribe = onSnapshot(banDocRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().banned) {
        setIsBanned(true);
        setBanReason(docSnap.data().reason || "");
      } else {
        setIsBanned(false);
        setBanReason("");
      }
    });
    return () => unsubscribe();
  }, [ip]);

  const resetForm = useCallback(() => {
    setMessage("");
    setAgreed(false);
    setCustomColorEnabled(false);
    setCustomColor("#ffffff");
    setShowIdentity(false);
    setUsername("");
    setIdentityConfirmed(false);
    setUsernameTouched(false);
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setCooldownError(false);
      setProfanityError(false);
      setFormError("");

      if (!message.trim()) {
        setFormError("Please enter your confession.");
        return;
      }
      if (!agreed) {
        setFormError("You must accept the Terms and Conditions.");
        return;
      }
      if (showIdentity) {
        if (!username.trim() || !USERNAME_PATTERN.test(username)) {
          setFormError("Please enter a valid username.");
          setUsernameTouched(true);
          return;
        }
        if (!identityConfirmed) {
          setFormError("Please confirm your username is accurate.");
          return;
        }
      }

      if (containsProfanity(message)) {
        setProfanityError(true);
        return;
      }

      const lastSentTime = localStorage.getItem("lastConfessionTime");
      const now = Date.now();
      if (lastSentTime && now - parseInt(lastSentTime, 10) < 60 * 1000) {
        setCooldownError(true);
        return;
      }

      setLoading(true);
      try {
        await addDoc(collection(db, "messages"), {
          message,
          createdAt: Timestamp.now(),
          status: "not-opened",
          ipAddress: ip,
          deviceInfo,
          customColor: customColorEnabled ? customColor : null,
          // Field names kept as instagramUsername/identityConfirmed for
          // backward compatibility with the Admin dashboard.
          instagramUsername: showIdentity ? username.trim() : null,
          identityConfirmed: showIdentity ? identityConfirmed : false,
        });
        await sendToDiscord(message);
        localStorage.setItem("lastConfessionTime", now.toString());
        setSuccess(true);
        resetForm();
      } catch (err) {
        console.error("Error:", err);
        setSuccess(false);
      } finally {
        setLoading(false);
      }
    },
    [
      message,
      agreed,
      showIdentity,
      username,
      identityConfirmed,
      ip,
      deviceInfo,
      customColorEnabled,
      customColor,
      resetForm,
    ],
  );

  useEffect(() => {
    if (success !== null || cooldownError || profanityError) {
      setShowFeedback(true);
      const timer = setTimeout(() => {
        setShowFeedback(false);
        setTimeout(() => {
          setSuccess(null);
          setCooldownError(false);
          setProfanityError(false);
        }, 500);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, cooldownError, profanityError]);

  const canSubmit = useMemo(() => {
    if (loading || !agreed || !message.trim()) return false;
    if (showIdentity && (!usernameIsValid || !username || !identityConfirmed)) {
      return false;
    }
    return true;
  }, [
    loading,
    agreed,
    message,
    showIdentity,
    usernameIsValid,
    username,
    identityConfirmed,
  ]);

  const themeToggle = (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`fixed top-4 right-4 z-50 flex items-center gap-2 pl-3 pr-3.5 py-2.5 rounded-full border shadow-lg backdrop-blur-md transition-all duration-300 hover:scale-105 active:scale-95 ${
        isDark
          ? "bg-white/10 border-white/15 text-white hover:bg-white/20"
          : "bg-black/5 border-black/10 text-slate-800 hover:bg-black/10 shadow-slate-300/50"
      }`}
    >
      {isDark ? (
        <FaSun className="text-amber-300 text-sm" />
      ) : (
        <FaMoon className="text-indigo-500 text-sm" />
      )}
      <span className="hidden sm:inline text-xs font-semibold tracking-wide">
        {isDark ? "Light mode" : "Dark mode"}
      </span>
    </button>
  );

  if (isBanned) {
    return (
      <div
        className={`min-h-screen w-full flex items-center justify-center transition-colors duration-500 ${
          isDark
            ? "bg-gradient-to-br from-black via-gray-900 to-black"
            : "bg-gradient-to-br from-slate-100 via-white to-slate-200"
        }`}
      >
        {themeToggle}
        <div className="max-w-md w-full mx-auto p-8 rounded-2xl bg-gradient-to-br from-gray-900/90 via-black/90 to-gray-800/90 border border-red-500/30 shadow-2xl flex flex-col items-center">
          <FaBan className="text-red-400 text-5xl mb-4" />
          <h2 className="text-2xl font-bold text-red-300 mb-2">
            Access Restricted
          </h2>
          <p className="text-gray-300 text-center mb-2">
            Your ability to submit confessions has been suspended.
            <br />
            {banReason && (
              <span className="block mt-3 text-red-200 font-semibold">
                <span className="text-red-300">Reason:</span> {banReason}
                <br />
                <span className="block mt-2 text-gray-300 font-normal">
                  If you believe this action was taken in error, please contact
                  our team on{" "}
                  <a
                    href="https://www.instagram.com/americanlycetuff_confession/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-300 underline hover:text-blue-400 transition"
                  >
                    (@americanlycetuff_confession)
                  </a>
                  .
                </span>
              </span>
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen w-full overflow-x-hidden font-sans flex flex-col transition-colors duration-500 ${
        isDark
          ? "bg-gradient-to-br from-black via-gray-900 to-black text-white"
          : "bg-gradient-to-br from-slate-100 via-white to-slate-200 text-slate-900"
      }`}
    >
      {themeToggle}

      <div className="flex-1 w-full flex flex-col items-center justify-center px-2 sm:px-4 py-10">
        <div className="relative w-full max-w-2xl mx-auto">
          {/* Floating Blobs */}
          <div
            className={`absolute -top-20 -left-20 w-40 h-40 sm:w-60 sm:h-60 rounded-full opacity-30 blur-2xl z-0 animate-pulse bg-gradient-to-br ${
              isDark
                ? "from-gray-700 via-gray-900 to-black"
                : "from-indigo-200 via-sky-100 to-white"
            }`}
          />
          <div
            className={`absolute -bottom-20 -right-20 w-40 h-40 sm:w-60 sm:h-60 rounded-full opacity-30 blur-2xl z-0 animate-pulse bg-gradient-to-tr ${
              isDark
                ? "from-gray-700 via-gray-900 to-black"
                : "from-purple-200 via-pink-100 to-white"
            }`}
          />

          <div
            className={`relative z-10 rounded-2xl sm:rounded-3xl shadow-2xl border backdrop-blur-2xl overflow-hidden ${
              isDark
                ? "border-white/10 bg-gradient-to-br from-gray-900/80 via-black/90 to-gray-800/80"
                : "border-black/10 bg-white/90"
            }`}
          >
            {/* Header */}
            <header
              className={`w-full text-center py-7 px-3 sm:py-10 sm:px-6 border-b ${
                isDark
                  ? "bg-gradient-to-br from-black/80 via-gray-900/80 to-gray-800/80 border-white/10"
                  : "bg-gradient-to-br from-slate-50 via-white to-slate-100 border-black/10"
              }`}
            >
              <h1
                className={`text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent drop-shadow-lg mb-2 bg-gradient-to-r ${
                  isDark
                    ? "from-white via-gray-200 to-gray-400"
                    : "from-slate-900 via-slate-700 to-slate-500"
                }`}
              >
                American Lycetuff Confessions
              </h1>
              <p
                className={`max-w-xl mx-auto text-base sm:text-lg ${
                  isDark ? "text-gray-400" : "text-slate-600"
                }`}
              >
                Share your thoughts anonymously and respectfully.
              </p>
            </header>

            {/* Form */}
            <form
              onSubmit={handleSubmit}
              className="p-4 sm:p-8 md:p-12 space-y-6 sm:space-y-8"
              noValidate
            >
              {/* Textarea */}
              <div className="relative group">
                <label htmlFor="confession" className="sr-only">
                  Your confession
                </label>
                <textarea
                  id="confession"
                  className={`w-full min-h-[140px] sm:min-h-[200px] p-4 sm:p-6 rounded-xl sm:rounded-2xl border shadow-md focus:outline-none focus:ring-2 transition-all duration-300 resize-none text-base sm:text-lg ${
                    isDark
                      ? "bg-gradient-to-br from-gray-800 via-gray-700 to-gray-800 text-white border-white/10 placeholder-gray-400 focus:ring-white/20 focus:shadow-[0_0_0_2px_rgba(255,255,255,0.15)] group-hover:border-white/20"
                      : "bg-white text-slate-900 border-black/10 placeholder-slate-400 focus:ring-slate-400/40 group-hover:border-black/20"
                  }`}
                  placeholder="Type your anonymous confession..."
                  value={message}
                  onChange={handleMessageChange}
                  required
                  maxLength={SOFT_CHAR_CAP}
                />
                <WordCounter
                  current={wordCount}
                  max={MAX_WORDS}
                  dark={isDark}
                />
              </div>

              {/* Custom Color */}
              <div
                className={`flex items-start gap-3 mb-2 p-3 rounded-xl border shadow transition-all duration-300 ${
                  isDark
                    ? "bg-gradient-to-br from-black/60 via-gray-900/70 to-gray-800/60 border-white/10 hover:border-white/30 hover:shadow-lg"
                    : "bg-slate-50 border-black/10 hover:border-black/20 hover:shadow-lg"
                }`}
              >
                <input
                  type="checkbox"
                  id="customColor"
                  checked={customColorEnabled}
                  onChange={(e) => setCustomColorEnabled(e.target.checked)}
                  className={`scale-110 sm:scale-125 mt-1 transition-all duration-200 ${
                    isDark ? "accent-white" : "accent-slate-700"
                  }`}
                />
                <label
                  htmlFor="customColor"
                  className={`text-xs sm:text-sm cursor-pointer ${
                    isDark ? "text-gray-300" : "text-slate-600"
                  }`}
                >
                  <span
                    className={`block font-semibold mb-1 tracking-wide ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    Custom Color
                  </span>
                  <span
                    className={
                      isDark ? "block text-gray-400" : "block text-slate-500"
                    }
                  >
                    Choose a custom color for your confession (optional)
                  </span>
                </label>
              </div>

              {customColorEnabled && (
                <div className="w-full flex flex-col items-center justify-center my-4 animate-[fadeIn_0.3s_ease]">
                  <div
                    className={`rounded-2xl border p-5 shadow-xl flex flex-col items-center ${
                      isDark
                        ? "border-white/10 bg-gradient-to-br from-gray-900 via-black to-gray-800"
                        : "border-black/10 bg-white"
                    }`}
                    style={{ width: "100%", maxWidth: 260 }}
                  >
                    <HexColorPicker
                      color={customColor}
                      onChange={setCustomColor}
                      style={{
                        width: "100%",
                        maxWidth: 220,
                        aspectRatio: "1/1",
                        borderRadius: "1rem",
                        boxShadow: "0 2px 16px 0 #0006",
                      }}
                    />
                    <div className="mt-4 flex items-center gap-2">
                      <span
                        className="inline-block w-7 h-7 rounded-lg border border-white/20 shadow"
                        style={{ background: customColor }}
                      />
                      <input
                        type="text"
                        value={customColor}
                        onChange={(e) => setCustomColor(e.target.value)}
                        className={`border rounded px-2 py-1 text-xs font-mono w-24 focus:outline-none focus:ring-2 focus:ring-blue-400 transition ${
                          isDark
                            ? "bg-gray-900 border-white/10 text-white"
                            : "bg-white border-black/10 text-slate-900"
                        }`}
                        maxLength={7}
                      />
                    </div>
                    <div
                      className={`mt-1 text-xs text-center w-full ${
                        isDark ? "text-gray-400" : "text-slate-500"
                      }`}
                    >
                      Selected color
                    </div>
                  </div>
                </div>
              )}

              {/* Username / Identity reveal */}
              <div
                className={`flex items-start gap-3 mb-2 p-4 rounded-xl border-2 shadow-lg transition-all duration-300 ${
                  isDark
                    ? "bg-gradient-to-br from-gray-900/90 via-black/80 to-gray-800/80 border-red-400/25 hover:border-red-400/50"
                    : "bg-red-50 border-red-300/60 hover:border-red-400"
                }`}
              >
                <input
                  type="checkbox"
                  id="showIdentity"
                  checked={showIdentity}
                  onChange={(e) => setShowIdentity(e.target.checked)}
                  className="accent-red-500 scale-125 mt-1 transition-all duration-200"
                />

                <label
                  htmlFor="showIdentity"
                  className={`text-sm cursor-pointer flex-1 ${
                    isDark ? "text-gray-300" : "text-slate-600"
                  }`}
                >
                  <span
                    className={`flex items-center gap-2 font-bold text-base mb-2 ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    {showIdentity ? (
                      <FaUserCircle className="text-red-400" />
                    ) : (
                      <FaEyeSlash className="text-red-400" />
                    )}
                    Show My Username{" "}
                    <span className="text-red-500">(Optional)</span>
                  </span>

                  <div
                    className={`rounded-lg border p-3 ${
                      isDark
                        ? "border-red-400/20 bg-red-500/10"
                        : "border-red-300/50 bg-red-100/60"
                    }`}
                  >
                    <p
                      className={`font-semibold ${isDark ? "text-white" : "text-slate-900"}`}
                    >
                      Only enable this if you want your username to appear with
                      your confession.
                    </p>

                    <p
                      className={`mt-2 leading-relaxed ${
                        isDark ? "text-gray-300" : "text-slate-600"
                      }`}
                    >
                      Leaving this <strong>OFF</strong> keeps your confession
                      completely anonymous. Turn it <strong>ON</strong> only if
                      you want everyone to know the confession was posted by
                      your account.
                    </p>
                  </div>
                </label>
              </div>
              {showIdentity && (
                <div
                  className={`flex flex-col gap-3 mt-2 mb-2 p-4 rounded-xl border shadow animate-[fadeIn_0.25s_ease] ${
                    isDark
                      ? "bg-gradient-to-br from-black/60 via-gray-900/70 to-gray-800/60 border-white/10"
                      : "bg-slate-50 border-black/10"
                  }`}
                >
                  <div>
                    <label
                      htmlFor="username"
                      className={`block text-xs mb-1 ${
                        isDark ? "text-gray-400" : "text-slate-500"
                      }`}
                    >
                      Your username
                    </label>
                    <div className="relative">
                      <span
                        className={`absolute left-3 top-1/2 -translate-y-1/2 text-sm font-mono select-none ${
                          isDark ? "text-gray-500" : "text-slate-400"
                        }`}
                      >
                        @
                      </span>
                      <input
                        ref={usernameInputRef}
                        id="username"
                        type="text"
                        inputMode="text"
                        placeholder="yourusername"
                        value={username}
                        onChange={handleUsernameChange}
                        onBlur={() => setUsernameTouched(true)}
                        className={`border rounded-lg pl-7 pr-3 py-2 text-sm font-mono w-full focus:outline-none focus:ring-2 transition ${
                          usernameError
                            ? "border-red-400/50 focus:ring-red-400/40"
                            : isDark
                              ? "border-white/10 focus:ring-blue-400/60"
                              : "border-black/10 focus:ring-blue-400/40"
                        } ${isDark ? "bg-gray-900 text-white" : "bg-white text-slate-900"}`}
                        maxLength={MAX_USERNAME_LENGTH}
                        aria-invalid={!!usernameError}
                        aria-describedby="username-hint"
                      />
                    </div>
                    <div
                      id="username-hint"
                      className="mt-1 flex items-center justify-between text-[11px]"
                    >
                      <span
                        className={
                          usernameError
                            ? "text-red-400"
                            : isDark
                              ? "text-gray-500"
                              : "text-slate-500"
                        }
                      >
                        {usernameError ||
                          "Letters, numbers, periods and underscores."}
                      </span>
                      <span
                        className={`font-mono ${isDark ? "text-gray-500" : "text-slate-500"}`}
                      >
                        {username.length}/{MAX_USERNAME_LENGTH}
                      </span>
                    </div>
                  </div>

                  {/* Live preview of how it'll appear in Admin / on the post */}
                  {username && usernameIsValid && (
                    <div
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${
                        isDark
                          ? "bg-black/40 border-white/5 text-gray-400"
                          : "bg-white border-black/10 text-slate-500"
                      }`}
                    >
                      <span
                        className={isDark ? "text-gray-500" : "text-slate-400"}
                      >
                        Preview:
                      </span>
                      <span
                        className={`font-medium ${
                          isDark ? "text-gray-200" : "text-slate-700"
                        }`}
                      >
                        Sent by @{username}
                      </span>
                    </div>
                  )}

                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={identityConfirmed}
                      onChange={(e) => setIdentityConfirmed(e.target.checked)}
                      className={`scale-110 mt-0.5 transition-all duration-200 ${
                        isDark ? "accent-white" : "accent-slate-700"
                      }`}
                    />
                    <span
                      className={`text-xs ${isDark ? "text-gray-300" : "text-slate-600"}`}
                    >
                      I confirm this username is accurate and I want it shown
                      publicly with my confession.
                    </span>
                  </label>
                </div>
              )}

              {/* Agreement checkbox */}
              <div
                className={`flex items-start gap-3 sm:gap-4 p-3 sm:p-5 rounded-xl sm:rounded-2xl border shadow group transition-all duration-300 ${
                  isDark
                    ? "bg-gradient-to-br from-black/60 via-gray-900/70 to-gray-800/60 border-white/10 hover:border-white/30 hover:shadow-lg"
                    : "bg-slate-50 border-black/10 hover:border-black/20 hover:shadow-lg"
                }`}
              >
                <input
                  type="checkbox"
                  id="terms"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  required
                  className={`scale-110 sm:scale-125 mt-1 transition-all duration-200 ${
                    isDark ? "accent-white" : "accent-slate-700"
                  }`}
                />
                <label
                  htmlFor="terms"
                  className={`text-xs sm:text-sm cursor-pointer ${
                    isDark ? "text-gray-300" : "text-slate-600"
                  }`}
                >
                  <p
                    className={`font-semibold mb-1 tracking-wide ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    Important Disclaimer
                  </p>
                  <p>
                    By checking this box, you accept our{" "}
                    <a
                      href="/terms"
                      className={
                        isDark
                          ? "text-gray-400 underline hover:text-gray-300 transition"
                          : "text-slate-500 underline hover:text-slate-700 transition"
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Terms and Conditions
                    </a>
                    .
                  </p>
                </label>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={!canSubmit}
                className={`w-full py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold tracking-wide transition-all duration-300 flex items-center justify-center gap-2 shadow-lg border hover:scale-105 hover:shadow-2xl active:scale-95 ${
                  isDark
                    ? "border-white/10 bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white hover:border-white/30 hover:from-gray-800 hover:via-gray-900 hover:to-black"
                    : "border-black/10 bg-gradient-to-br from-slate-800 via-slate-900 to-black text-white hover:border-black/30 hover:from-slate-700 hover:via-slate-800 hover:to-slate-900"
                } ${
                  !canSubmit
                    ? "opacity-60 cursor-not-allowed hover:scale-100"
                    : ""
                }`}
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Sending...
                  </>
                ) : (
                  <>
                    <FaPaperPlane className="text-white drop-shadow" />
                    <span className="drop-shadow">
                      Send {showIdentity ? "" : "Anonymously"}
                    </span>
                  </>
                )}
              </button>
            </form>

            {/* Feedback */}
            <div className="px-4 sm:px-8 md:px-12 pb-6 sm:pb-8 space-y-2 sm:space-y-3">
              {formError && (
                <div
                  className={`p-3 rounded-lg border font-semibold text-sm text-center mb-2 ${
                    isDark
                      ? "bg-red-900/80 border-red-400/30 text-red-200"
                      : "bg-red-100 border-red-300 text-red-700"
                  }`}
                >
                  {formError}
                </div>
              )}
              {success === true && (
                <Toast
                  tone="success"
                  visible={showFeedback}
                  dark={isDark}
                  icon={<FaCheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />}
                >
                  Confession sent
                  {showIdentity && identityConfirmed ? "" : " anonymously"}!
                </Toast>
              )}
              {success === false && (
                <Toast
                  tone="error"
                  visible={showFeedback}
                  dark={isDark}
                  icon={
                    <FaExclamationTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
                  }
                >
                  Failed to send message. Please try again.
                </Toast>
              )}
              {cooldownError && (
                <Toast
                  tone="warning"
                  visible={showFeedback}
                  dark={isDark}
                  icon={<FaClock className="w-4 h-4 sm:w-5 sm:h-5" />}
                >
                  Please wait 1 minute before sending another confession.
                </Toast>
              )}
              {profanityError && (
                <Toast
                  tone="error"
                  visible={showFeedback}
                  dark={isDark}
                  icon={
                    <FaExclamationTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
                  }
                >
                  Your confession contains inappropriate language. Please remove
                  it.
                </Toast>
              )}
            </div>

            {/* Security footer */}
            <div
              className={`p-3 sm:p-4 border-t flex items-center justify-center gap-2 text-xs sm:text-sm shadow-inner ${
                isDark
                  ? "bg-gradient-to-br from-black/70 via-gray-900/80 to-gray-800/70 border-white/10 text-gray-300"
                  : "bg-slate-50 border-black/10 text-slate-600"
              }`}
            >
              <FaLock className={isDark ? "text-white" : "text-slate-700"} />
              <span>
                {showIdentity
                  ? "Your confession is transmitted securely."
                  : "Your confession is end-to-end anonymous and secure"}
              </span>
            </div>
          </div>
        </div>

        {/* Instagram links */}
        <div className="mt-8 mb-4 flex flex-col md:flex-row justify-center gap-5 sm:gap-8 z-10 w-full px-2">
          <div className="flex flex-col md:flex-row justify-center items-center gap-5 sm:gap-8 w-full">
            <a
              href="https://www.instagram.com/americanlycetuff_confession/"
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl border shadow-lg hover:scale-105 hover:shadow-2xl transition-all duration-300 group w-full max-w-xs min-w-[260px] justify-center ${
                isDark
                  ? "bg-gradient-to-br from-black/70 via-gray-900/80 to-gray-800/70 border-white/10 hover:border-white/30"
                  : "bg-white border-black/10 hover:border-black/30"
              }`}
              style={{ minWidth: 260 }}
            >
              <div
                className={`p-2 sm:p-3 rounded-lg sm:rounded-xl shadow border transition ${
                  isDark
                    ? "bg-black border-white/20 group-hover:border-white/40"
                    : "bg-slate-900 border-black/20 group-hover:border-black/40"
                }`}
              >
                <FaInstagram className="text-white text-xl sm:text-2xl group-hover:scale-110 transition" />
              </div>
              <div className="flex flex-col min-w-0">
                <p
                  className={`text-xs transition whitespace-nowrap ${
                    isDark
                      ? "text-gray-500 group-hover:text-white"
                      : "text-slate-400 group-hover:text-slate-900"
                  }`}
                >
                  Confession Page
                </p>
                <p
                  className={`font-medium transition whitespace-nowrap ${
                    isDark
                      ? "text-white group-hover:text-gray-200"
                      : "text-slate-900 group-hover:text-slate-700"
                  }`}
                >
                  americanlycetuff_confession
                </p>
              </div>
            </a>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer
        className={`relative z-10 w-full text-center py-4 sm:py-6 text-xs sm:text-sm border-t mt-auto px-2 ${
          isDark
            ? "text-gray-500 border-white/5"
            : "text-slate-500 border-black/10"
        }`}
      >
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-2">
          <p>
            © {new Date().getFullYear()} American Lycetuff Confessions.
            Everything Is Anonymous.
          </p>
          <span className="hidden sm:inline opacity-50">•</span>
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-block px-2 py-1 font-semibold text-xs underline transition ${
              isDark
                ? "text-gray-400 hover:text-gray-200"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Terms and Conditions
          </a>
        </div>
      </footer>
    </div>
  );
}
