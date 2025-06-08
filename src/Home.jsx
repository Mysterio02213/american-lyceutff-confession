import React, { useState, useEffect } from "react";
import { addDoc, collection, Timestamp } from "firebase/firestore";
import { db } from "./firebase";
import sendToDiscord from "./sendToDiscord";
import { FaInstagram, FaPaperPlane, FaLock } from "react-icons/fa";
import axios from "axios";
import { UAParser } from "ua-parser-js";

export default function ConfessionPage() {
  const [message, setMessage] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [ip, setIp] = useState("");
  const [cooldownError, setCooldownError] = useState(false);
  const [profanityError, setProfanityError] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [deviceInfo, setDeviceInfo] = useState("");
  const MAX_CHARS = 1200;

  useEffect(() => {
    setCharCount(message.length);
  }, [message]);

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
    | Browser: ${result.browser.name || "Unknown"} ${
      result.browser.version || ""
    }
    | Device Type: ${result.device.type || "Desktop"}
    | Device Brand: ${result.device.vendor || "Unknown"}
    | Device Model: ${result.device.model || "Unknown"}
  `
      .replace(/\s+/g, " ")
      .trim(); // Compact the string

    setDeviceInfo(deviceInfoString);
  }, []);

  // Advanced profanity detection with common bypass patterns
  const containsProfanity = (text) => {
    if (!text) return false;

    // Normalize text for better matching
    const normalizedText = text
      .toLowerCase()
      .replace(/[^a-z0-9]/g, " ") // Remove special characters
      .replace(/\s+/g, " ") // Collapse multiple spaces
      .replace(/(.)\1{2,}/g, "$1") // Reduce repeated characters (e.g. fuuuuuck -> fuck)
      .replace(/[0-9]/g, (char) => {
        // Leetspeak conversion
        const leetMap = {
          1: "i",
          3: "e",
          4: "a",
          5: "s",
          0: "o",
          "@": "a",
          $: "s",
        };
        return leetMap[char] || char;
      });

    // Comprehensive profanity list with common variations
    const profanityPatterns = [
      "bsdk",
      "chutiya",
      "behnchod",
      "penchod",
      "ghasti",
      "randi",
      "fuck",
      "shit",
      "asshole",
      "bitch",
      "cunt",
      "nigger",
      "nigga",
      "whore",
      "slut",
      "pussy",
      "dick",
      "cock",
      "piss",
      "crap",
      "fag",
      "faggot",
      "retard",
      "damn",
      "bastard",
      "motherfucker",
      "mf",
      "screw",
      "twat",
      "wanker",
      "bollocks",
      "arse",
      "arsehole",
      "bloody",
      "bugger",
      "cow",
      "cracker",
      "chink",
      "gook",
      "kike",
      "spic",
      "wetback",
      "f u c k",
      "s h i t",
      "a s s",
      "b i t c h",
      "d i c k",
      "p u s s y",
    ];

    // Check for profanity patterns
    return profanityPatterns.some(
      (term) =>
        normalizedText.includes(term) ||
        normalizedText.includes(term.split("").join(" ")) // Check spaced versions
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCooldownError(false);
    setProfanityError(false);

    if (!message.trim() || !agreed) return;

    // Check for profanity
    if (containsProfanity(message)) {
      setProfanityError(true);
      return;
    }

    const lastSentTime = localStorage.getItem("lastConfessionTime");
    const now = Date.now();

    if (lastSentTime && now - parseInt(lastSentTime) < 60 * 1000) {
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
        deviceInfo, // <-- Add this line
      });
      await sendToDiscord(message);
      localStorage.setItem("lastConfessionTime", now.toString());
      setSuccess(true);
      setMessage("");
      setAgreed(false);
    } catch (err) {
      console.error("Error:", err);
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-black via-gray-900 to-black text-white overflow-x-hidden font-sans flex flex-col items-center justify-center">
      {/* Modern Glassmorphism Card */}
      <div className="relative w-full max-w-2xl mx-auto mt-6 mb-10 px-2 sm:px-4">
        {/* Floating Blobs */}
        <div className="absolute -top-20 -left-20 w-40 h-40 sm:w-60 sm:h-60 bg-gradient-to-br from-gray-700 via-gray-900 to-black rounded-full opacity-30 blur-2xl z-0 animate-pulse" />
        <div className="absolute -bottom-20 -right-20 w-40 h-40 sm:w-60 sm:h-60 bg-gradient-to-tr from-gray-700 via-gray-900 to-black rounded-full opacity-30 blur-2xl z-0 animate-pulse" />

        <div className="relative z-10 rounded-2xl sm:rounded-3xl shadow-2xl border border-white/10 bg-gradient-to-br from-gray-900/80 via-black/90 to-gray-800/80 backdrop-blur-2xl overflow-hidden">
          {/* Header */}
          <header className="w-full text-center py-7 px-3 sm:py-10 sm:px-6 bg-gradient-to-br from-black/80 via-gray-900/80 to-gray-800/80 border-b border-white/10">
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent drop-shadow-lg mb-2">
              American Lycetuff Confessions
            </h1>
            <p className="text-gray-400 max-w-xl mx-auto text-base sm:text-lg">
              Share your thoughts anonymously and respectfully.
            </p>
          </header>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="p-4 sm:p-8 md:p-12 space-y-6 sm:space-y-8"
          >
            {/* Textarea */}
            <div className="relative group">
              <textarea
                id="confession"
                className="w-full min-h-[120px] sm:min-h-[180px] p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-gradient-to-br from-gray-800 via-gray-700 to-gray-800 text-white border border-white/10 shadow-md focus:shadow-[0_0_0_2px_rgba(255,255,255,0.15)] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all duration-300 resize-none group-hover:border-white/20 text-base sm:text-lg"
                placeholder="Type your anonymous confession..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                maxLength={MAX_CHARS}
              />
              <div
                className={`absolute bottom-3 right-4 sm:bottom-4 sm:right-6 text-xs font-mono px-2 py-1 rounded bg-gray-900/70 border border-white/10 shadow-sm ${
                  MAX_CHARS - charCount <= MAX_CHARS * 0.1
                    ? "text-amber-300 border-amber-300/30"
                    : "text-gray-300"
                }`}
              >
                {MAX_CHARS - charCount}
              </div>
            </div>

            {/* Agreement checkbox */}
            <div className="flex items-start gap-3 sm:gap-4 p-3 sm:p-5 bg-gradient-to-br from-black/60 via-gray-900/70 to-gray-800/60 rounded-xl sm:rounded-2xl border border-white/10 shadow group transition-all duration-300 hover:border-white/30 hover:shadow-lg">
              <input
                type="checkbox"
                id="terms"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                required
                className="accent-white scale-110 sm:scale-125 mt-1 transition-all duration-200"
              />
              <label
                htmlFor="terms"
                className="text-gray-300 text-xs sm:text-sm cursor-pointer"
              >
                <p className="font-semibold text-white mb-1 tracking-wide">
                  Important Disclaimer
                </p>
                <p>
                  By submitting this confession, I understand that it cannot be
                  edited or deleted once posted. I agree not to include any
                  abusive language, hate speech, false rumors, or personally
                  identifiable information. Confessions that violate these
                  guidelines may be reported by users and reviewed for removal.
                  Repeated violations may lead to a permanent ban from this
                  platform.
                </p>
              </label>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading || !agreed}
              className={`w-full py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold tracking-wide transition-all duration-300 flex items-center justify-center gap-2 shadow-lg border border-white/10 bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white hover:scale-105 hover:shadow-2xl hover:border-white/30 hover:bg-gradient-to-br hover:from-gray-800 hover:via-gray-900 hover:to-black active:scale-95 ${
                loading || !agreed ? "opacity-60 cursor-not-allowed" : ""
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
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Sending...
                </>
              ) : (
                <>
                  <FaPaperPlane className="text-white drop-shadow" />
                  <span className="drop-shadow">Send Anonymously</span>
                </>
              )}
            </button>
          </form>

          {/* Feedback messages */}
          <div className="px-4 sm:px-8 md:px-12 pb-6 sm:pb-8 space-y-2 sm:space-y-3">
            {success === true && (
              <div
                className={`p-3 sm:p-4 rounded-lg sm:rounded-xl bg-gradient-to-r from-green-700/20 via-green-900/30 to-black/10 border border-green-400/30 transition-opacity duration-500 ${
                  showFeedback ? "opacity-100" : "opacity-0"
                }`}
              >
                <p className="text-green-200 flex items-center gap-2 font-semibold text-xs sm:text-base">
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                  Message sent anonymously!
                </p>
              </div>
            )}
            {success === false && (
              <div
                className={`p-3 sm:p-4 rounded-lg sm:rounded-xl bg-gradient-to-r from-red-700/20 via-red-900/30 to-black/10 border border-red-400/30 transition-opacity duration-500 ${
                  showFeedback ? "opacity-100" : "opacity-0"
                }`}
              >
                <p className="text-red-200 flex items-center gap-2 font-semibold text-xs sm:text-base">
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                  Failed to send message. Please try again.
                </p>
              </div>
            )}
            {cooldownError && (
              <div
                className={`p-3 sm:p-4 rounded-lg sm:rounded-xl bg-gradient-to-r from-yellow-700/20 via-yellow-900/30 to-black/10 border border-yellow-400/30 transition-opacity duration-500 ${
                  showFeedback ? "opacity-100" : "opacity-0"
                }`}
              >
                <p className="text-yellow-200 flex items-center gap-2 font-semibold text-xs sm:text-base">
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                  Please wait 1 minute before sending another confession
                </p>
              </div>
            )}
            {profanityError && (
              <div
                className={`p-3 sm:p-4 rounded-lg sm:rounded-xl bg-gradient-to-r from-red-700/20 via-red-900/30 to-black/10 border border-red-400/30 transition-opacity duration-500 ${
                  showFeedback ? "opacity-100" : "opacity-0"
                }`}
              >
                <p className="text-red-200 flex items-center gap-2 font-semibold text-xs sm:text-base">
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    ></path>
                  </svg>
                  Your confession contains inappropriate language. Please remove
                  it.
                </p>
              </div>
            )}
          </div>

          {/* Security footer */}
          <div className="p-3 sm:p-4 bg-gradient-to-br from-black/70 via-gray-900/80 to-gray-800/70 border-t border-white/10 flex items-center justify-center gap-2 text-gray-300 text-xs sm:text-sm shadow-inner">
            <FaLock className="text-white" />
            <span>Your confession is end-to-end anonymous and secure</span>
          </div>
        </div>
      </div>

      {/* Instagram links */}
      <div className="mt-8 mb-4 flex flex-col md:flex-row justify-center gap-5 sm:gap-8 text-gray-300 z-10 w-full px-2">
        <div className="flex flex-col md:flex-row justify-center items-center gap-5 sm:gap-8 w-full">
          <a
            href="https://www.instagram.com/americanlycetuff_confession/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-black/70 via-gray-900/80 to-gray-800/70 border border-white/10 shadow-lg hover:scale-105 hover:shadow-2xl hover:border-white/30 transition-all duration-300 group w-full max-w-xs min-w-[260px] justify-center"
            style={{ minWidth: 260 }}
          >
            <div className="bg-black border border-white/20 p-2 sm:p-3 rounded-lg sm:rounded-xl shadow group-hover:border-white/40 transition">
              <FaInstagram className="text-white text-xl sm:text-2xl group-hover:scale-110 group-hover:text-gray-200 transition" />
            </div>
            <div className="flex flex-col min-w-0">
              <p className="text-xs text-gray-500 group-hover:text-white transition whitespace-nowrap">
                Confession Page
              </p>
              <p className="font-medium text-white group-hover:text-gray-200 transition whitespace-nowrap">
                americanlycetuff_confession
              </p>
            </div>
          </a>

          <a
            href="https://www.instagram.com/mysterio_notfound/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl bg-gradient-to-br from-black/70 via-gray-900/80 to-gray-800/70 border border-white/10 shadow-lg hover:scale-105 hover:shadow-2xl hover:border-white/30 transition-all duration-300 group w-full max-w-xs min-w-[260px] justify-center"
            style={{ minWidth: 260 }}
          >
            <div className="bg-black border border-white/20 p-2 sm:p-3 rounded-lg sm:rounded-xl shadow group-hover:border-white/40 transition">
              <FaInstagram className="text-white text-xl sm:text-2xl group-hover:scale-110 group-hover:text-gray-200 transition" />
            </div>
            <div className="flex flex-col min-w-0">
              <p className="text-xs text-gray-500 group-hover:text-white transition whitespace-nowrap">
                Founder
              </p>
              <p className="font-medium text-white group-hover:text-gray-200 transition whitespace-nowrap">
                mysterio_notfound
              </p>
            </div>
          </a>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 w-full text-center py-4 sm:py-6 text-gray-500 text-xs sm:text-sm border-t border-white/5 mt-auto px-2">
        <div className="max-w-4xl mx-auto">
          <p>
            © {new Date().getFullYear()} American Lycetuff Confessions.
            Everything Is Anonymous.
          </p>
        </div>
      </footer>
    </div>
  );
}
