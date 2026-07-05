import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  memo,
} from "react";
import {
  addDoc,
  collection,
  Timestamp,
  doc as firestoreDoc,
  onSnapshot,
  setDoc,
  deleteDoc,
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
  FaImage,
  FaTimesCircle,
  FaPalette,
} from "react-icons/fa";
import axios from "axios";
import { UAParser } from "ua-parser-js";
import { HexColorPicker } from "react-colorful";
import { Filter } from "bad-words";

const MAX_WORDS = 1000;
const SOFT_CHAR_CAP = 8000;
const THEME_STORAGE_KEY = "confessionTheme";
const DRAFT_STORAGE_KEY = "confessionDraft";
const MAX_USERNAME_LENGTH = 30;
const USERNAME_PATTERN = /^[a-zA-Z0-9._]{1,30}$/;

const IMGBB_API_KEY = import.meta.env.VITE_IMGBB_API_KEY;
const MAX_IMAGE_MB = 32;
const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;
const MAX_IMAGES = 3;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

async function uploadImageToImgbb(file) {
  if (!IMGBB_API_KEY) {
    throw new Error(
      "Image hosting isn't configured. Set VITE_IMGBB_API_KEY to enable image uploads.",
    );
  }
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("Could not read the selected image."));
    reader.readAsDataURL(file);
  });
  const formData = new FormData();
  formData.append("key", IMGBB_API_KEY);
  formData.append("image", base64);
  const res = await axios.post("https://api.imgbb.com/1/upload", formData);
  const data = res.data?.data;
  if (!data?.url) {
    throw new Error("Image upload failed. Please try again.");
  }
  return { url: data.url, deleteUrl: data.delete_url || null };
}

const baseFilter = new Filter();

const CUSTOM_PROFANITY_PATTERNS = [
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
  "g\\s*a\\s*n\\s*d",
  "l\\s*o\\s*d\\s*a",
  "l\\s*u\\s*n\\s*d",
  "c\\s*h\\s*u\\s*t\\s*i\\s*y\\s*a",
  "b\\s*h\\s*e\\s*n\\s*c\\s*h\\s*o\\s*d",
  "m\\s*a\\s*d\\s*a\\s*r\\s*c\\s*h\\s*o\\s*d",
  "r\\s*a\\s*n\\s*d\\s*i",
  "r\\s*a\\s*n\\s*d\\s*y",
  "k\\s*a\\s*m\\s*i\\s*n\\s*i",
  "ѕех",
  "ｓｅｘ",
  "fυck",
  "𝒇𝒖𝒄𝒌",
].map((p) => new RegExp(p, "i"));

const DIRECT_PROFANITY_WORDS = new Set([
  "fuck", "shit", "bitch", "ass", "asshole", "bastard", "cunt", "dick",
  "pussy", "whore", "slut", "nigger", "nigga",
  "gand", "gaand", "loda", "lora", "lund", "chod", "choda", "chodna",
  "chutiya", "bsdk", "bhenchod", "behnchod", "mc", "madarchod", "randi",
  "ghasti", "bhosdike", "bhosadi", "penchod",
  "maa ki chut", "maa ka bhosda", "behen ke laude", "laundiya", "chinal",
  "khanki", "randi baz", "kamini", "kutiya", "kutti", "saali", "harami",
  "haraamzada", "kameena", "suar", "suar ki aulad", "gandu", "chodu",
]);

const LEET_MAP = { 1: "i", 3: "e", 4: "a", 5: "s", 0: "o", "@": "a", $: "s" };

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9@$\s]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/(.)\1{2,}/g, "$1")
    .replace(/[0-9@$]/g, (char) => LEET_MAP[char] || char);
}

function containsProfanity(text) {
  if (!text) return false;
  const normalized = normalizeText(text);
  if (baseFilter.isProfane(normalized)) return true;
  if (CUSTOM_PROFANITY_PATTERNS.some((regex) => regex.test(normalized))) return true;
  const words = normalized.split(/\s+/);
  return words.some((word) => DIRECT_PROFANITY_WORDS.has(word));
}

const cn = (cond, t, f) => (cond ? t : f);

const Toast = memo(function Toast({ tone, icon, children, visible, dark = true }) {
  const toneStyles = dark
    ? {
        success: "from-green-700/20 via-green-900/30 to-black/10 border-green-400/30 text-green-200",
        error: "from-red-700/20 via-red-900/30 to-black/10 border-red-400/30 text-red-200",
        warning: "from-yellow-700/20 via-yellow-900/30 to-black/10 border-yellow-400/30 text-yellow-200",
      }
    : {
        success: "from-green-100 via-green-50 to-white border-green-400/50 text-green-800",
        error: "from-red-100 via-red-50 to-white border-red-400/50 text-red-800",
        warning: "from-amber-100 via-amber-50 to-white border-amber-400/50 text-amber-800",
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
});

const WordCounter = memo(function WordCounter({ current, max, dark }) {
  const remaining = max - current;
  const low = remaining <= max * 0.1;
  const empty = current === 0;
  const pct = Math.min(100, (current / max) * 100);
  return (
    <div className="absolute bottom-3 right-4 sm:bottom-4 sm:right-6 flex items-center gap-2">
      <div className={`hidden sm:block w-16 h-1 rounded-full overflow-hidden ${dark ? "bg-white/10" : "bg-black/10"}`}>
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            low ? "bg-amber-400" : dark ? "bg-white/50" : "bg-slate-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div
        className={`text-xs font-mono px-2 py-1 rounded border shadow-sm whitespace-nowrap transition-colors duration-300 ${
          low
            ? "text-amber-400 border-amber-400/30 bg-amber-400/10"
            : dark
              ? "text-gray-300 border-white/10 bg-gray-900/70"
              : "text-slate-600 border-black/10 bg-white/80"
        }`}
      >
        {empty ? `${max} words max` : `${remaining} words left`}
      </div>
    </div>
  );
});

function ChecklistItem({ done, children }) {
  return (
    <li className="flex items-center gap-2">
      {done ? (
        <FaCheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
      ) : (
        <span className="w-3.5 h-3.5 rounded-full border-2 border-current opacity-50 shrink-0" />
      )}
      <span className={done ? "line-through opacity-60" : ""}>{children}</span>
    </li>
  );
}

function ToggleSwitch({ checked, onChange, id, dark, activeClass = "bg-red-500" }) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50 ${
        checked ? activeClass : dark ? "bg-white/15" : "bg-black/15"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

const ThemeToggleBtn = memo(function ThemeToggleBtn({ isDark, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`fixed top-4 right-4 z-50 flex items-center gap-2 pl-3 pr-3.5 py-2.5 rounded-full border shadow-lg backdrop-blur-md transition-all duration-300 hover:scale-105 active:scale-95 ${
        isDark
          ? "bg-white/10 border-white/15 text-white hover:bg-white/20"
          : "bg-black/5 border-black/10 text-slate-800 hover:bg-black/10 shadow-slate-300/50"
      }`}
    >
      {isDark ? <FaSun className="text-amber-300 text-sm" /> : <FaMoon className="text-indigo-500 text-sm" />}
      <span className="hidden sm:inline text-xs font-semibold tracking-wide">
        {isDark ? "Light mode" : "Dark mode"}
      </span>
    </button>
  );
});

const BannedView = memo(function BannedView({ isDark, banReason, onThemeToggle }) {
  return (
    <div
      className={`min-h-screen w-full flex items-center justify-center transition-colors duration-500 ${
        isDark
          ? "bg-gradient-to-br from-black via-gray-900 to-black"
          : "bg-gradient-to-br from-slate-100 via-white to-slate-200"
      }`}
    >
      <ThemeToggleBtn isDark={isDark} onToggle={onThemeToggle} />
      <div className="max-w-md w-full mx-auto p-8 rounded-2xl bg-gradient-to-br from-gray-900/90 via-black/90 to-gray-800/90 border border-red-500/30 shadow-2xl flex flex-col items-center">
        <FaBan className="text-red-400 text-5xl mb-4" />
        <h2 className="text-2xl font-bold text-red-300 mb-2">Access Restricted</h2>
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
                </a>.
              </span>
            </span>
          )}
        </p>
      </div>
    </div>
  );
});

const FormHeader = memo(function FormHeader({ isDark }) {
  return (
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
      <p className={`max-w-xl mx-auto text-base sm:text-lg ${isDark ? "text-gray-400" : "text-slate-600"}`}>
        Share your thoughts anonymously and respectfully.
      </p>
    </header>
  );
});

const DraftBanner = memo(function DraftBanner({ isDark, onDiscard }) {
  return (
    <div
      className={`flex items-center justify-between gap-3 text-xs sm:text-sm px-3 sm:px-4 py-2 rounded-lg border animate-[fadeIn_0.3s_ease] ${
        isDark
          ? "bg-blue-500/10 border-blue-400/20 text-blue-200"
          : "bg-blue-50 border-blue-200 text-blue-700"
      }`}
    >
      <span className="flex items-center gap-2">
        <FaClock className="shrink-0" />
        We restored your unsent draft.
      </span>
      <button
        type="button"
        onClick={onDiscard}
        className="font-semibold underline underline-offset-2 hover:opacity-75 transition"
      >
        Discard
      </button>
    </div>
  );
});

const TextareaSection = memo(function TextareaSection({
  value,
  onChange,
  wordCount,
  isDark,
  submitAttempted,
  onFocus,
  onBlur,
  draftRestored,
  setDraftRestored,
}) {
  return (
    <div className="relative group">
      <label htmlFor="confession" className="sr-only">Your confession</label>
      <textarea
        id="confession"
        onFocus={onFocus}
        onBlur={onBlur}
        className={`w-full min-h-[140px] sm:min-h-[200px] p-4 sm:p-6 rounded-xl sm:rounded-2xl border shadow-md focus:outline-none focus:ring-2 transition-all duration-300 resize-none text-base sm:text-lg ${
          isDark
            ? "bg-gradient-to-br from-gray-800 via-gray-700 to-gray-800 text-white border-white/10 placeholder-gray-400 focus:ring-white/20 focus:shadow-[0_0_0_2px_rgba(255,255,255,0.15)] group-hover:border-white/20"
            : "bg-white text-slate-900 border-black/10 placeholder-slate-400 focus:ring-slate-400/40 group-hover:border-black/20"
        } ${
          submitAttempted && !value.trim()
            ? isDark
              ? "border-red-400/50 focus:ring-red-400/40"
              : "border-red-400/60 focus:ring-red-400/30"
            : ""
        }`}
        placeholder="Type your anonymous confession..."
        value={value}
        onChange={(e) => {
          onChange(e);
          if (draftRestored) setDraftRestored(false);
        }}
        required
        maxLength={SOFT_CHAR_CAP}
      />
      <WordCounter current={wordCount} max={MAX_WORDS} dark={isDark} />
    </div>
  );
});

const CustomColorSection = memo(function CustomColorSection({
  isDark,
  enabled,
  color,
  onToggle,
  onChange,
}) {
  return (
    <div
      className={`rounded-2xl border-2 shadow-lg overflow-hidden transition-all duration-300 ${
        enabled
          ? isDark
            ? "border-violet-400/40 bg-gradient-to-br from-violet-950/30 via-gray-900/90 to-black/90"
            : "border-violet-300 bg-gradient-to-br from-violet-50 via-white to-violet-50/60"
          : isDark
            ? "border-white/10 bg-gradient-to-br from-black/60 via-gray-900/70 to-gray-800/60 hover:border-white/20"
            : "border-black/10 bg-slate-50 hover:border-black/20"
      }`}
    >
      <div className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5">
        <div
          className={`flex items-center justify-center w-11 h-11 rounded-xl shrink-0 transition-colors duration-300 ${
            enabled
              ? "bg-violet-500/15 text-violet-400"
              : isDark
                ? "bg-white/5 text-gray-400"
                : "bg-black/5 text-slate-500"
          }`}
        >
          {enabled ? (
            <span className="w-5 h-5 rounded-full block border border-white/30 shadow-inner" style={{ background: color }} />
          ) : (
            <FaPalette className="text-xl" />
          )}
        </div>
        <label htmlFor="customColorEnabled" className="flex-1 min-w-0 cursor-pointer">
          <span className={`flex items-center gap-2 font-bold text-sm sm:text-base ${isDark ? "text-white" : "text-slate-900"}`}>
            {enabled ? "Custom Color Enabled" : "Default Color"}
            <span
              className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${
                enabled
                  ? "bg-violet-500/15 text-violet-400"
                  : isDark
                    ? "bg-white/10 text-gray-400"
                    : "bg-black/5 text-slate-500"
              }`}
            >
              Optional
            </span>
          </span>
          <span className={`block text-xs sm:text-sm mt-0.5 ${isDark ? "text-gray-400" : "text-slate-500"}`}>
            {enabled
              ? "Your confession card will use the color you pick below."
              : "Give your confession card a color of your choice."}
          </span>
        </label>
        <ToggleSwitch
          id="customColorEnabled"
          checked={enabled}
          onChange={onToggle}
          dark={isDark}
          activeClass="bg-violet-500"
        />
      </div>
      {enabled && (
        <div className={`px-4 sm:px-5 pb-5 pt-1 animate-[fadeIn_0.3s_ease] border-t ${isDark ? "border-violet-400/10" : "border-violet-200/60"}`}>
          <div className="w-full flex flex-col items-center justify-center">
            <div
              className={`rounded-2xl border p-5 shadow-xl flex flex-col items-center ${
                isDark
                  ? "border-white/10 bg-gradient-to-br from-gray-900 via-black to-gray-800"
                  : "border-black/10 bg-white"
              }`}
              style={{ width: "100%", maxWidth: 260 }}
            >
              <HexColorPicker
                color={color}
                onChange={onChange}
                style={{
                  width: "100%",
                  maxWidth: 220,
                  aspectRatio: "1/1",
                  borderRadius: "1rem",
                  boxShadow: "0 2px 16px 0 #0006",
                }}
              />
              <div className="mt-4 flex items-center gap-2">
                <span className="inline-block w-7 h-7 rounded-lg border border-white/20 shadow" style={{ background: color }} />
                <input
                  type="text"
                  value={color}
                  onChange={(e) => onChange(e.target.value)}
                  className={`border rounded px-2 py-1 text-xs font-mono w-24 focus:outline-none focus:ring-2 focus:ring-violet-400 transition ${
                    isDark
                      ? "bg-gray-900 border-white/10 text-white"
                      : "bg-white border-black/10 text-slate-900"
                  }`}
                  maxLength={7}
                />
              </div>
              <div className={`mt-1 text-xs text-center w-full ${isDark ? "text-gray-400" : "text-slate-500"}`}>
                Selected color
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

const ImageSection = memo(function ImageSection({
  isDark,
  images,
  openExtra,
  onToggleExtra,
  onImageSelect,
  onRemoveImage,
  onImageDrop,
  onImageDragOver,
  onImageDragLeave,
  isDragging,
  imageError,
  imageInputRef,
}) {
  return (
    <div
      className={`rounded-2xl border-2 shadow-lg overflow-hidden transition-all duration-300 ${
        images.length > 0
          ? isDark
            ? "border-sky-400/40 bg-gradient-to-br from-sky-950/30 via-gray-900/90 to-black/90"
            : "border-sky-300 bg-gradient-to-br from-sky-50 via-white to-sky-50/60"
          : isDark
            ? "border-white/10 bg-gradient-to-br from-black/60 via-gray-900/70 to-gray-800/60 hover:border-white/20"
            : "border-black/10 bg-slate-50 hover:border-black/20"
      }`}
    >
      <button
        type="button"
        onClick={() => onToggleExtra("images")}
        aria-expanded={openExtra === "images"}
        aria-controls="extra-images-panel"
        className="w-full flex items-center gap-3 sm:gap-4 p-4 sm:p-5 text-left"
      >
        <div
          className={`flex items-center justify-center w-11 h-11 rounded-xl shrink-0 transition-colors duration-300 ${
            images.length > 0
              ? "bg-sky-500/15 text-sky-400"
              : isDark
                ? "bg-white/5 text-gray-400"
                : "bg-black/5 text-slate-500"
          }`}
        >
          <FaImage className="text-xl" />
        </div>
        <span className="flex-1 min-w-0">
          <span className={`flex items-center gap-2 font-bold text-sm sm:text-base ${isDark ? "text-white" : "text-slate-900"}`}>
            {images.length > 0
              ? `${images.length} Photo${images.length > 1 ? "s" : ""} Attached`
              : "No Photos Attached"}
            <span
              className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${
                images.length > 0
                  ? "bg-sky-500/15 text-sky-400"
                  : isDark
                    ? "bg-white/10 text-gray-400"
                    : "bg-black/5 text-slate-500"
              }`}
            >
              Optional
            </span>
          </span>
          <span className={`block text-xs sm:text-sm mt-0.5 ${isDark ? "text-gray-400" : "text-slate-500"}`}>
            {images.length > 0
              ? `Tap to manage — ${images.length}/${MAX_IMAGES} used`
              : `Add up to ${MAX_IMAGES} images to your confession`}
          </span>
        </span>
        <div className="flex items-center gap-3 shrink-0">
          {images.length > 0 && (
            <div className="hidden sm:flex -space-x-2">
              {images.slice(0, 3).map((img) => (
                <img
                  key={img.id}
                  src={img.previewUrl}
                  alt=""
                  className={`w-8 h-8 rounded-full object-cover border-2 ${isDark ? "border-gray-900" : "border-white"}`}
                />
              ))}
            </div>
          )}
          <svg
            className={`w-4 h-4 shrink-0 transition-transform duration-300 ${openExtra === "images" ? "rotate-180" : ""} ${isDark ? "text-gray-400" : "text-slate-500"}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      <div
        id="extra-images-panel"
        className={`grid transition-all duration-300 ease-in-out ${
          openExtra === "images" ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className={`px-4 sm:px-5 pb-5 pt-1 border-t ${isDark ? "border-sky-400/10" : "border-sky-200/60"}`}>
            <input
              ref={imageInputRef}
              id="confessionImage"
              type="file"
              accept={ALLOWED_IMAGE_TYPES.join(",")}
              multiple
              onChange={onImageSelect}
              className="hidden"
            />
            <div
              onDrop={onImageDrop}
              onDragOver={onImageDragOver}
              onDragLeave={onImageDragLeave}
              className={`rounded-lg border border-dashed p-2 mt-3 transition-colors duration-200 ${
                isDragging
                  ? isDark
                    ? "border-sky-400/60 bg-sky-400/5"
                    : "border-sky-400/60 bg-sky-50"
                  : "border-transparent"
              }`}
            >
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                {images.map((img) => (
                  <div key={img.id} className="relative aspect-square">
                    <img
                      src={img.previewUrl}
                      alt="Selected attachment preview"
                      className="w-full h-full rounded-lg border border-white/10 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => onRemoveImage(img.id)}
                      className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 shadow-lg transition"
                      aria-label="Remove image"
                      title="Remove image"
                    >
                      <FaTimesCircle className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {images.length < MAX_IMAGES && (
                  <label
                    htmlFor="confessionImage"
                    className={`flex flex-col items-center justify-center gap-1 aspect-square cursor-pointer border border-dashed rounded-lg text-[11px] sm:text-xs text-center px-1 transition ${
                      isDark
                        ? "border-white/20 text-gray-400 hover:border-sky-400/50 hover:text-sky-300"
                        : "border-black/20 text-slate-500 hover:border-sky-400/50 hover:text-sky-600"
                    }`}
                  >
                    <FaImage className="text-base" />
                    {isDragging ? "Drop here" : "Add or drop image"}
                  </label>
                )}
              </div>
            </div>
            {imageError && (
              <p className="mt-2 text-xs text-red-400 font-semibold">{imageError}</p>
            )}
            <p className={`mt-2 text-[11px] leading-relaxed ${isDark ? "text-gray-500" : "text-slate-500"}`}>
              Up to {MAX_IMAGES} images, {MAX_IMAGE_MB}MB each. Images are reviewed by our team before being shared. Do not upload nudity, gore, or anything illegal — violators will be permanently banned.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});

const IdentitySection = memo(function IdentitySection({
  isDark,
  showIdentity,
  onToggle,
  username,
  usernameError,
  usernameIsValid,
  onUsernameChange,
  onUsernameBlur,
  identityConfirmed,
  onConfirmChange,
  usernameInputRef,
}) {
  return (
    <div
      className={`rounded-2xl border-2 shadow-lg overflow-hidden transition-all duration-300 ${
        showIdentity
          ? isDark
            ? "border-red-400/40 bg-gradient-to-br from-red-950/30 via-gray-900/90 to-black/90"
            : "border-red-300 bg-gradient-to-br from-red-50 via-white to-red-50/60"
          : isDark
            ? "border-white/10 bg-gradient-to-br from-black/60 via-gray-900/70 to-gray-800/60 hover:border-white/20"
            : "border-black/10 bg-slate-50 hover:border-black/20"
      }`}
    >
      <div className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5">
        <div
          className={`flex items-center justify-center w-11 h-11 rounded-xl shrink-0 transition-colors duration-300 ${
            showIdentity
              ? "bg-red-500/15 text-red-400"
              : isDark
                ? "bg-white/5 text-gray-400"
                : "bg-black/5 text-slate-500"
          }`}
        >
          {showIdentity ? <FaUserCircle className="text-xl" /> : <FaEyeSlash className="text-xl" />}
        </div>
        <label htmlFor="showIdentity" className="flex-1 min-w-0 cursor-pointer">
          <span className={`flex items-center gap-2 font-bold text-sm sm:text-base ${isDark ? "text-white" : "text-slate-900"}`}>
            {showIdentity ? "Posting With Instagram Username" : "Posting Anonymously"}
            <span
              className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${
                showIdentity
                  ? "bg-red-500/15 text-red-400"
                  : isDark
                    ? "bg-white/10 text-gray-400"
                    : "bg-black/5 text-slate-500"
              }`}
            >
              Optional
            </span>
          </span>
          <span className={`block text-xs sm:text-sm mt-0.5 ${isDark ? "text-gray-400" : "text-slate-500"}`}>
            {showIdentity
              ? "Everyone will see this confession was sent by you."
              : "Nobody will know this confession was from you."}
          </span>
        </label>
        <ToggleSwitch id="showIdentity" checked={showIdentity} onChange={onToggle} dark={isDark} />
      </div>
      {showIdentity && (
        <div className={`px-4 sm:px-5 pb-5 pt-1 space-y-4 animate-[fadeIn_0.3s_ease] border-t ${isDark ? "border-red-400/10" : "border-red-200/60"}`}>
          <div className={`flex items-start gap-2 text-xs rounded-lg p-3 ${isDark ? "bg-red-500/10 text-red-200" : "bg-red-100/70 text-red-700"}`}>
            <FaExclamationTriangle className="shrink-0 mt-0.5" />
            <span>
              Only turn this on if you're okay with your username being public. It can't be undone once your confession is sent.
            </span>
          </div>
          <div>
            <label htmlFor="username" className={`block text-xs font-semibold mb-1.5 ${isDark ? "text-gray-300" : "text-slate-600"}`}>
              Your username
            </label>
            <div className="relative">
              <span className={`absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-mono select-none ${isDark ? "text-gray-500" : "text-slate-400"}`}>
                @
              </span>
              <input
                ref={usernameInputRef}
                id="username"
                type="text"
                inputMode="text"
                placeholder="yourusername"
                value={username}
                onChange={onUsernameChange}
                onBlur={onUsernameBlur}
                className={`border-2 rounded-xl pl-8 pr-10 py-3 text-sm font-mono w-full focus:outline-none focus:ring-4 transition-all duration-200 ${
                  usernameError
                    ? "border-red-400 focus:ring-red-400/20"
                    : username && usernameIsValid
                      ? "border-emerald-400/60 focus:ring-emerald-400/20"
                      : isDark
                        ? "border-white/10 focus:ring-red-400/20 focus:border-red-400/50"
                        : "border-black/10 focus:ring-red-400/10 focus:border-red-300"
                } ${isDark ? "bg-black/40 text-white" : "bg-white text-slate-900"}`}
                maxLength={MAX_USERNAME_LENGTH}
                aria-invalid={!!usernameError}
                aria-describedby="username-hint"
              />
              {username && usernameIsValid && (
                <FaCheckCircle className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-400" />
              )}
            </div>
            <div id="username-hint" className="mt-1.5 flex items-center justify-between text-[11px]">
              <span className={usernameError ? "text-red-400 font-medium" : cn(isDark, "text-gray-500", "text-slate-500")}>
                {usernameError || "Letters, numbers, periods and underscores."}
              </span>
              <span className={`font-mono ${isDark ? "text-gray-500" : "text-slate-500"}`}>
                {username.length}/{MAX_USERNAME_LENGTH}
              </span>
            </div>
          </div>
          <label
            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors duration-200 ${
              identityConfirmed
                ? isDark
                  ? "border-emerald-400/40 bg-emerald-500/10"
                  : "border-emerald-300 bg-emerald-50"
                : isDark
                  ? "border-white/10 bg-black/20"
                  : "border-black/10 bg-white"
            }`}
          >
            <input
              type="checkbox"
              checked={identityConfirmed}
              onChange={onConfirmChange}
              className={`scale-110 mt-0.5 shrink-0 transition-all duration-200 ${isDark ? "accent-emerald-400" : "accent-emerald-600"}`}
            />
            <span className={`text-xs sm:text-sm ${isDark ? "text-gray-300" : "text-slate-600"}`}>
              I confirm this username is accurate and I want it shown publicly with my confession.
            </span>
          </label>
        </div>
      )}
    </div>
  );
});

const TermsSection = memo(function TermsSection({ isDark, agreed, onChange }) {
  return (
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
        onChange={onChange}
        required
        className={`scale-110 sm:scale-125 mt-1 transition-all duration-200 ${isDark ? "accent-white" : "accent-slate-700"}`}
      />
      <label htmlFor="terms" className={`text-xs sm:text-sm cursor-pointer ${isDark ? "text-gray-300" : "text-slate-600"}`}>
        <p className={`font-semibold mb-1 tracking-wide ${isDark ? "text-white" : "text-slate-900"}`}>
          Important Disclaimer
        </p>
        <p>
          By checking this box, you accept our{" "}
          <a
            href="/terms"
            className={isDark ? "text-gray-400 underline hover:text-gray-300 transition" : "text-slate-500 underline hover:text-slate-700 transition"}
            target="_blank"
            rel="noopener noreferrer"
          >
            Terms and Conditions
          </a>.
        </p>
      </label>
    </div>
  );
});

const SubmitButton = memo(function SubmitButton({ isDark, loading, imageUploading, canSubmit, showIdentity }) {
  return (
    <button
      type="submit"
      disabled={loading}
      aria-disabled={!canSubmit}
      className={`w-full py-3 sm:py-4 rounded-xl sm:rounded-2xl font-bold tracking-wide transition-all duration-300 flex items-center justify-center gap-2 shadow-lg border hover:scale-105 hover:shadow-2xl active:scale-95 ${
        isDark
          ? "border-white/10 bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white hover:border-white/30 hover:from-gray-800 hover:via-gray-900 hover:to-black"
          : "border-black/10 bg-gradient-to-br from-slate-800 via-slate-900 to-black text-white hover:border-black/30 hover:from-slate-700 hover:via-slate-800 hover:to-slate-900"
      } ${!canSubmit ? "opacity-60 cursor-not-allowed hover:scale-100" : ""}`}
    >
      {loading ? (
        <>
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
          {imageUploading ? "Uploading image..." : "Sending..."}
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
  );
});

const FeedbackToasts = memo(function FeedbackToasts({
  isDark,
  formError,
  success,
  showFeedback,
  cooldownError,
  profanityError,
  showIdentity,
  identityConfirmed,
}) {
  return (
    <div className="px-4 sm:px-8 md:px-12 pb-6 sm:pb-8 space-y-2 sm:space-y-3">
      {formError && (
        <div className={`p-3 rounded-lg border font-semibold text-sm text-center mb-2 ${
          isDark
            ? "bg-red-900/80 border-red-400/30 text-red-200"
            : "bg-red-100 border-red-300 text-red-700"
        }`}>
          {formError}
        </div>
      )}
      {success === true && (
        <Toast tone="success" visible={showFeedback} dark={isDark} icon={<FaCheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />}>
          Confession sent{showIdentity && identityConfirmed ? "" : " anonymously"}!
        </Toast>
      )}
      {success === false && (
        <Toast tone="error" visible={showFeedback} dark={isDark} icon={<FaExclamationTriangle className="w-4 h-4 sm:w-5 sm:h-5" />}>
          Failed to send message. Please try again.
        </Toast>
      )}
      {cooldownError && (
        <Toast tone="warning" visible={showFeedback} dark={isDark} icon={<FaClock className="w-4 h-4 sm:w-5 sm:h-5" />}>
          Please wait 1 minute before sending another confession.
        </Toast>
      )}
      {profanityError && (
        <Toast tone="error" visible={showFeedback} dark={isDark} icon={<FaExclamationTriangle className="w-4 h-4 sm:w-5 sm:h-5" />}>
          Your confession contains inappropriate language. Please remove it.
        </Toast>
      )}
    </div>
  );
});

const SecurityFooter = memo(function SecurityFooter({ isDark, showIdentity }) {
  return (
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
  );
});

const InstagramLinks = memo(function InstagramLinks({ isDark }) {
  return (
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
          <div className={`p-2 sm:p-3 rounded-lg sm:rounded-xl shadow border transition ${
            isDark
              ? "bg-black border-white/20 group-hover:border-white/40"
              : "bg-slate-900 border-black/20 group-hover:border-black/40"
          }`}>
            <FaInstagram className="text-white text-xl sm:text-2xl group-hover:scale-110 transition" />
          </div>
          <div className="flex flex-col min-w-0">
            <p className={`text-xs transition whitespace-nowrap ${isDark ? "text-gray-500 group-hover:text-white" : "text-slate-400 group-hover:text-slate-900"}`}>
              Confession Page
            </p>
            <p className={`font-medium transition whitespace-nowrap ${isDark ? "text-white group-hover:text-gray-200" : "text-slate-900 group-hover:text-slate-700"}`}>
              americanlycetuff_confession
            </p>
          </div>
        </a>
      </div>
    </div>
  );
});

const SiteFooter = memo(function SiteFooter({ isDark }) {
  return (
    <footer
      className={`relative z-10 w-full text-center py-4 sm:py-6 text-xs sm:text-sm border-t mt-auto px-2 ${
        isDark
          ? "text-gray-500 border-white/5"
          : "text-slate-500 border-black/10"
      }`}
    >
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-2">
        <p>© {new Date().getFullYear()} American Lycetuff Confessions. Everything Is Anonymous.</p>
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
  );
});

export default function ConfessionPage() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "dark";
    return localStorage.getItem(THEME_STORAGE_KEY) || "dark";
  });
  const isDark = theme === "dark";
  const messageRef = useRef("");

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

  const [showIdentity, setShowIdentity] = useState(false);
  const [username, setUsername] = useState("");
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [usernameTouched, setUsernameTouched] = useState(false);

  const [formError, setFormError] = useState("");
  const usernameInputRef = useRef(null);

  const [openExtra, setOpenExtra] = useState(null);
  const toggleExtra = useCallback((key) => {
    setOpenExtra((prev) => (prev === key ? null : key));
  }, []);

  const [draftRestored, setDraftRestored] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const presenceSessionRef = useRef(null);
  const presenceStatusRef = useRef("active");

  const [attachedImages, setAttachedImages] = useState([]);
  const [imageError, setImageError] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef(null);
  const nextImageId = useRef(0);

  // Keep messageRef in sync
  messageRef.current = message;

  const wordCount = useMemo(() => {
    const trimmed = message.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [message]);

  const updatePresence = useCallback(async (status = "active") => {
    if (!presenceSessionRef.current) return;
    try {
      await setDoc(
        firestoreDoc(db, "confessionPresence", presenceSessionRef.current),
        { status, page: "confession", lastSeen: Timestamp.now() },
        { merge: true },
      );
    } catch {
      // Ignore presence write failures
    }
  }, []);

  // Merged presence effect — no `message` dependency, uses ref instead
  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const sessionId =
      sessionStorage.getItem("confessionPresenceSessionId") ||
      `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem("confessionPresenceSessionId", sessionId);
    presenceSessionRef.current = sessionId;

    // Heartbeat every 8s so Admin's 25s window safely catches us even if
    // one or two heartbeats are delayed or dropped.
    const heartbeat = window.setInterval(() => {
      void updatePresence(presenceStatusRef.current);
    }, 8000);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        presenceStatusRef.current = "away";
        void updatePresence("away");
      } else {
        presenceStatusRef.current = messageRef.current.trim() ? "typing" : "active";
        void updatePresence(presenceStatusRef.current);
      }
    };

    // Best-effort cleanup: deleteDoc works on fast unloads; on slow or
    // killed tabs the Admin's periodic stale-session sweep handles it.
    const handleUnload = () => {
      const id = presenceSessionRef.current;
      if (!id) return;
      try { void deleteDoc(firestoreDoc(db, "confessionPresence", id)); } catch {}
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleUnload);
    window.addEventListener("pagehide", handleUnload);

    void updatePresence("active");

    return () => {
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleUnload);
      window.removeEventListener("pagehide", handleUnload);
      handleUnload();
    };
  }, [updatePresence]);

  // Typing debounce effect — still depends on message but only sets a timer
  useEffect(() => {
    const timer = setTimeout(() => {
      const newStatus = message.trim() ? "typing" : "active";
      if (presenceStatusRef.current !== newStatus) {
        presenceStatusRef.current = newStatus;
        void updatePresence(newStatus);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [message, updatePresence]);

  // Restore draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved && saved.trim()) {
        setMessage(saved);
        setDraftRestored(true);
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  // Persist draft
  useEffect(() => {
    const saveTimer = window.setTimeout(() => {
      try {
        if (message.trim()) {
          localStorage.setItem(DRAFT_STORAGE_KEY, message);
        } else {
          localStorage.removeItem(DRAFT_STORAGE_KEY);
        }
      } catch {
        // ignore
      }
    }, 250);
    return () => window.clearTimeout(saveTimer);
  }, [message]);

  const handleMessageChange = useCallback((e) => {
    const value = e.target.value;
    const trimmed = value.trim();
    const words = trimmed ? trimmed.split(/\s+/) : [];
    setMessage(
      words.length > MAX_WORDS ? words.slice(0, MAX_WORDS).join(" ") : value,
    );
  }, []);

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

  const handleImageSelect = useCallback((e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;

    setAttachedImages((prev) => {
      const remainingSlots = MAX_IMAGES - prev.length;
      if (remainingSlots <= 0) {
        setImageError(`You can attach up to ${MAX_IMAGES} images.`);
        return prev;
      }

      const accepted = [];
      let skippedForType = false;
      let skippedForSize = false;
      let skippedForLimit = false;

      for (const file of files) {
        if (accepted.length >= remainingSlots) {
          skippedForLimit = true;
          break;
        }
        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
          skippedForType = true;
          continue;
        }
        if (file.size > MAX_IMAGE_BYTES) {
          skippedForSize = true;
          continue;
        }
        accepted.push({
          id: nextImageId.current++,
          file,
          previewUrl: URL.createObjectURL(file),
        });
      }

      if (skippedForType) {
        setImageError("Only JPG, PNG, WEBP or GIF images are allowed.");
      } else if (skippedForSize) {
        setImageError(`Each image must be under ${MAX_IMAGE_MB}MB.`);
      } else if (skippedForLimit) {
        setImageError(`You can attach up to ${MAX_IMAGES} images.`);
      } else if (accepted.length > 0) {
        setImageError("");
      }

      return accepted.length > 0 ? [...prev, ...accepted] : prev;
    });
  }, []);

  const removeImage = useCallback((id) => {
    setAttachedImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((img) => img.id !== id);
    });
    setImageError("");
  }, []);

  // Clean up blob URLs on unmount
  useEffect(() => {
    return () => {
      setAttachedImages((prev) => {
        prev.forEach((img) => URL.revokeObjectURL(img.previewUrl));
        return [];
      });
    };
  }, []);

  const handleImageDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDraggingImage(false);
      if (e.dataTransfer?.files?.length) {
        handleImageSelect({
          target: { files: e.dataTransfer.files, value: "" },
        });
      }
    },
    [handleImageSelect],
  );

  const handleImageDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDraggingImage(true);
  }, []);

  const handleImageDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDraggingImage(false);
  }, []);

  useEffect(() => {
    if (showIdentity) {
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
    const deviceInfoString = [
      `OS: ${result.os.name || "Unknown"} ${result.os.version || ""}`,
      `Browser: ${result.browser.name || "Unknown"} ${result.browser.version || ""}`,
      `Device Type: ${result.device.type || "Desktop"}`,
      `Device Model: ${result.device.vendor || ""} ${result.device.model || ""}`,
    ]
      .join(" | ")
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
    setAttachedImages((prev) => {
      prev.forEach((img) => URL.revokeObjectURL(img.previewUrl));
      return [];
    });
    setImageError("");
    if (imageInputRef.current) imageInputRef.current.value = "";
    setOpenExtra(null);
    setDraftRestored(false);
    setSubmitAttempted(false);
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setCooldownError(false);
      setProfanityError(false);
      setFormError("");
      setSubmitAttempted(true);

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
        let uploadedImages = [];

        if (attachedImages.length > 0) {
          setImageUploading(true);
          try {
            uploadedImages = await Promise.all(
              attachedImages.map((img) => uploadImageToImgbb(img.file)),
            );
          } catch (imgErr) {
            console.error("Image upload failed:", imgErr);
            setFormError(
              imgErr?.message || "Failed to upload one of your images. Remove it or try again.",
            );
            setImageUploading(false);
            setLoading(false);
            return;
          }
          setImageUploading(false);
        }

        await addDoc(collection(db, "messages"), {
          message,
          createdAt: Timestamp.now(),
          status: "not-opened",
          ipAddress: ip,
          deviceInfo,
          customColor: customColorEnabled ? customColor : null,
          instagramUsername: showIdentity ? username.trim() : null,
          identityConfirmed: showIdentity ? identityConfirmed : false,
          images: uploadedImages,
        });
        await sendToDiscord(
          uploadedImages.length > 0
            ? `${message}\n\n[${uploadedImages.length} image(s) attached: ${uploadedImages.map((img) => img.url).join(", ")}]`
            : message,
        );
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
      attachedImages,
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
    if (loading || imageUploading || !agreed || !message.trim()) return false;
    if (showIdentity && (!usernameIsValid || !username || !identityConfirmed)) return false;
    return true;
  }, [
    loading,
    imageUploading,
    agreed,
    message,
    showIdentity,
    usernameIsValid,
    username,
    identityConfirmed,
  ]);

  const handleTextareaFocus = useCallback(() => {
    presenceStatusRef.current = "typing";
    void updatePresence("typing");
  }, [updatePresence]);

  const handleTextareaBlur = useCallback(() => {
    presenceStatusRef.current = "active";
    void updatePresence("active");
  }, [updatePresence]);

  const handleThemeToggle = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const handleAgreedChange = useCallback((e) => {
    setAgreed(e.target.checked);
  }, []);

  const handleIdentityToggle = useCallback((val) => {
    setShowIdentity(val);
  }, []);

  const handleUsernameBlur = useCallback(() => {
    setUsernameTouched(true);
  }, []);

  const handleConfirmChange = useCallback((e) => {
    setIdentityConfirmed(e.target.checked);
  }, []);

  const handleColorToggle = useCallback((val) => {
    setCustomColorEnabled(val);
  }, []);

  const handleColorChange = useCallback((val) => {
    setCustomColor(val);
  }, []);

  const handleDiscardDraft = useCallback(() => {
    setMessage("");
    setDraftRestored(false);
  }, []);

  if (isBanned) {
    return <BannedView isDark={isDark} banReason={banReason} onThemeToggle={handleThemeToggle} />;
  }

  const showStartOver = message || attachedImages.length > 0 || customColorEnabled || showIdentity;

  return (
    <div
      className={`min-h-screen w-full overflow-x-hidden font-sans flex flex-col transition-colors duration-500 ${
        isDark
          ? "bg-gradient-to-br from-black via-gray-900 to-black text-white"
          : "bg-gradient-to-br from-slate-100 via-white to-slate-200 text-slate-900"
      }`}
    >
      <ThemeToggleBtn isDark={isDark} onToggle={handleThemeToggle} />

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
            <FormHeader isDark={isDark} />

            <form
              onSubmit={handleSubmit}
              className="p-4 sm:p-8 md:p-12 space-y-6 sm:space-y-8"
              noValidate
            >
              {showStartOver && (
                <div className="flex justify-end -mb-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    className={`text-xs font-semibold underline underline-offset-2 transition ${
                      isDark ? "text-gray-500 hover:text-gray-300" : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    Start over
                  </button>
                </div>
              )}

              {draftRestored && (
                <DraftBanner isDark={isDark} onDiscard={handleDiscardDraft} />
              )}

              <TextareaSection
                value={message}
                onChange={handleMessageChange}
                wordCount={wordCount}
                isDark={isDark}
                submitAttempted={submitAttempted}
                onFocus={handleTextareaFocus}
                onBlur={handleTextareaBlur}
                draftRestored={draftRestored}
                setDraftRestored={setDraftRestored}
              />

              <div className="space-y-3">
                <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? "text-gray-500" : "text-slate-400"}`}>
                  EXTRAS
                </p>

                <CustomColorSection
                  isDark={isDark}
                  enabled={customColorEnabled}
                  color={customColor}
                  onToggle={handleColorToggle}
                  onChange={handleColorChange}
                />

                <ImageSection
                  isDark={isDark}
                  images={attachedImages}
                  openExtra={openExtra}
                  onToggleExtra={toggleExtra}
                  onImageSelect={handleImageSelect}
                  onRemoveImage={removeImage}
                  onImageDrop={handleImageDrop}
                  onImageDragOver={handleImageDragOver}
                  onImageDragLeave={handleImageDragLeave}
                  isDragging={isDraggingImage}
                  imageError={imageError}
                  imageInputRef={imageInputRef}
                />

                <IdentitySection
                  isDark={isDark}
                  showIdentity={showIdentity}
                  onToggle={handleIdentityToggle}
                  username={username}
                  usernameError={usernameError}
                  usernameIsValid={usernameIsValid}
                  onUsernameChange={handleUsernameChange}
                  onUsernameBlur={handleUsernameBlur}
                  identityConfirmed={identityConfirmed}
                  onConfirmChange={handleConfirmChange}
                  usernameInputRef={usernameInputRef}
                />
              </div>

              <TermsSection isDark={isDark} agreed={agreed} onChange={handleAgreedChange} />

              {submitAttempted && !canSubmit && !loading && (
                <div
                  className={`rounded-xl border p-3 sm:p-4 text-xs sm:text-sm animate-[fadeIn_0.25s_ease] ${
                    isDark
                      ? "bg-amber-500/10 border-amber-400/20 text-amber-200"
                      : "bg-amber-50 border-amber-200 text-amber-800"
                  }`}
                >
                  <p className="font-semibold mb-1.5">A few things left:</p>
                  <ul className="space-y-1">
                    <ChecklistItem done={!!message.trim()}>Write your confession</ChecklistItem>
                    <ChecklistItem done={agreed}>Accept the Terms and Conditions</ChecklistItem>
                    {showIdentity && (
                      <>
                        <ChecklistItem done={usernameIsValid && !!username}>Enter a valid username</ChecklistItem>
                        <ChecklistItem done={identityConfirmed}>Confirm your username is accurate</ChecklistItem>
                      </>
                    )}
                  </ul>
                </div>
              )}

              <SubmitButton
                isDark={isDark}
                loading={loading}
                imageUploading={imageUploading}
                canSubmit={canSubmit}
                showIdentity={showIdentity}
              />
            </form>

            <FeedbackToasts
              isDark={isDark}
              formError={formError}
              success={success}
              showFeedback={showFeedback}
              cooldownError={cooldownError}
              profanityError={profanityError}
              showIdentity={showIdentity}
              identityConfirmed={identityConfirmed}
            />

            <SecurityFooter isDark={isDark} showIdentity={showIdentity} />
          </div>
        </div>

        <InstagramLinks isDark={isDark} />
      </div>

      <SiteFooter isDark={isDark} />
    </div>
  );
}
