import React, { useState, useEffect } from "react";
import { addDoc, collection, Timestamp } from "firebase/firestore";
import { db } from "./firebase";
import sendToDiscord from "./sendToDiscord";
import { FaInstagram, FaPaperPlane, FaLock } from "react-icons/fa";
import axios from "axios";

export default function ConfessionPage() {
  const [message, setMessage] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [ip, setIp] = useState("");
  const [cooldownError, setCooldownError] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const MAX_CHARS = 3000;

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setCooldownError(false);
    if (!message.trim() || !agreed) return;

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
    if (success !== null || cooldownError) {
      setShowFeedback(true);
      const timer = setTimeout(() => {
        setShowFeedback(false);
        setTimeout(() => {
          setSuccess(null);
          setCooldownError(false);
        }, 500);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, cooldownError]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-black via-gray-900 to-black text-white overflow-hidden relative font-sans">
      {/* Particles background */}
      <div className="absolute inset-0 overflow-hidden z-0">
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white/5 animate-pulse"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              width: `${Math.random() * 10 + 2}px`,
              height: `${Math.random() * 10 + 2}px`,
              animationDuration: `${Math.random() * 10 + 5}s`,
            }}
          />
        ))}
      </div>

      {/* Header */}
      <header className="relative z-10 w-full text-center py-8">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white drop-shadow-lg mb-2">
            American Lycetuff Confessions
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto">
            Share your thoughts anonymously and securely
          </p>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 flex flex-col items-center justify-center px-4 pb-16">
        <div className="w-full max-w-2xl backdrop-blur-sm bg-black/30 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          {/* Form container */}
          <div className="p-6 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Textarea */}
              <div className="relative">
                <textarea
                  id="confession"
                  className="w-full min-h-[180px] p-5 rounded-xl bg-black/30 text-white border border-white/10 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-white transition-all duration-300 resize-none"
                  placeholder="Type your anonymous confession..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                />
                <div className="absolute bottom-3 right-3 text-xs text-gray-400">
                  {charCount}/{MAX_CHARS}
                </div>
              </div>

              {/* Agreement checkbox */}
              <div className="flex items-start gap-3 p-4 bg-black/30 rounded-xl border border-white/5">
                <div className="mt-0.5">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    required
                    className="accent-white scale-125"
                  />
                </div>
                <label htmlFor="terms" className="text-gray-300 text-sm">
                  <p className="font-medium text-white mb-1">
                    Confession Policy
                  </p>
                  <p>
                    I understand that my confession will be stored permanently
                    and cannot be deleted. I confirm it contains no abusive
                    language, hate speech, or personally identifiable
                    information.
                  </p>
                </label>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading || !agreed}
                className={`w-full py-4 rounded-xl font-bold tracking-wide transition-all duration-300 flex items-center justify-center gap-2 ${
                  loading || !agreed
                    ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                    : "bg-white text-black hover:bg-gray-200 hover:shadow-lg"
                }`}
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5 text-black"
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
                    <FaPaperPlane className="text-black" />
                    Send Anonymously
                  </>
                )}
              </button>
            </form>

            {/* Feedback messages */}
            <div className="mt-6 space-y-3">
              {success === true && (
                <div
                  className={`p-4 rounded-xl bg-white/10 border border-white/30 transition-opacity duration-500 ${
                    showFeedback ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <p className="text-white flex items-center gap-2">
                    <svg
                      className="w-5 h-5"
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
                  className={`p-4 rounded-xl bg-white/10 border border-white/30 transition-opacity duration-500 ${
                    showFeedback ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <p className="text-white flex items-center gap-2">
                    <svg
                      className="w-5 h-5"
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
                  className={`p-4 rounded-xl bg-white/10 border border-white/30 transition-opacity duration-500 ${
                    showFeedback ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <p className="text-white flex items-center gap-2">
                    <svg
                      className="w-5 h-5"
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
            </div>
          </div>

          {/* Security footer */}
          <div className="p-4 bg-black/50 border-t border-white/5 flex items-center justify-center gap-2 text-gray-300 text-sm">
            <FaLock className="text-white" />
            <span>Your confession is end-to-end anonymous and secure</span>
          </div>
        </div>

        {/* Instagram links */}
        <div className="mt-8 flex flex-col md:flex-row justify-center gap-6 text-gray-300">
          <a
            href="https://www.instagram.com/americanlycetuff_confession/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 hover:text-white transition"
          >
            <div className="bg-black border border-white/20 p-2 rounded-lg">
              <FaInstagram className="text-white text-xl" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Confession Page</p>
              <p className="font-medium">americanlycetuff_confession</p>
            </div>
          </a>

          <a
            href="https://www.instagram.com/mysterio_notfound/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 hover:text-white transition"
          >
            <div className="bg-black border border-white/20 p-2 rounded-lg">
              <FaInstagram className="text-white text-xl" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Founder</p>
              <p className="font-medium">mysterio_notfound</p>
            </div>
          </a>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full text-center py-6 text-gray-500 text-sm border-t border-white/5 mt-auto">
        <div className="max-w-4xl mx-auto px-4">
          <p>
            © {new Date().getFullYear()} American Lycetuff Confessions. All
            submissions are anonymous and permanent.
          </p>
        </div>
      </footer>
    </div>
  );
}
