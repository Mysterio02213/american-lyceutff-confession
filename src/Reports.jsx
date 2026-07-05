import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  increment,
  arrayUnion,
} from "firebase/firestore";
import { db } from "./firebase";
import { toast, Toaster } from "react-hot-toast";
import {
  Check,
  Flag,
  Search,
  X as CloseIcon,
  Clock,
  ArrowUpDown,
  ChevronDown,
  Info,
  FolderX,
  AlertTriangle,
  Instagram,
  Send,
} from "lucide-react";
import sendToDiscord from "./sendToDiscord";

const REPORT_REASONS = [
  "Use of Abusive or Inappropriate Language",
  "Sharing Sensitive or Private Information",
  "Hate Speech or Discrimination",
  "Harassment or Bullying",
  "Irrelevant or Non-Constructive Submissions",
  "Spamming or Repeated Submissions",
];
const MAX_REPORTS_PER_USER = 2;
const MAX_CUSTOM_REASON = 300;
const COOLDOWN_MS = 5000;

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
];

function toMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toDate === "function") return ts.toDate().getTime();
  if (typeof ts === "number") return ts;
  return new Date(ts).getTime() || 0;
}

function timeAgo(timestamp) {
  const millis = toMillis(timestamp);
  if (!millis) return "";
  const seconds = Math.floor((Date.now() - millis) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(millis).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function caseNumber(id) {
  if (!id) return "F-0000";
  const hash = Array.from(id).reduce(
    (acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0,
    7,
  );
  return `F-${hash.toString(16).slice(-4).toUpperCase().padStart(4, "0")}`;
}

export default function ReportsPage() {
  const [confessions, setConfessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportingId, setReportingId] = useState(null);
  const [reasonOption, setReasonOption] = useState(REPORT_REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [reporterInstagram, setReporterInstagram] = useState("");
  const [instagramError, setInstagramError] = useState("");
  const [reportCounts, setReportCounts] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(false);
  const [cooldowns, setCooldowns] = useState({});
  const [submitting, setSubmitting] = useState({});

  useEffect(() => {
    const stored = localStorage.getItem("confessionReports") || "{}";
    setReportCounts(JSON.parse(stored));
    const savedIg = localStorage.getItem("reporterInstagram");
    if (savedIg) setReporterInstagram(savedIg);
  }, []);

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, "messages"),
      where("status", "==", "shared"),
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      let changed = false;
      const stored = JSON.parse(
        localStorage.getItem("confessionReports") || "{}",
      );
      docs.forEach((c) => {
        if ((c.reports || 0) === 0 && stored[c.id]) {
          delete stored[c.id];
          changed = true;
        }
      });
      if (changed) {
        localStorage.setItem("confessionReports", JSON.stringify(stored));
        setReportCounts(stored);
      }

      setConfessions(docs);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const isReasonCustom = reasonOption === "custom";
  const activeReasonText = isReasonCustom ? customReason.trim() : reasonOption;

  const openReportForm = (id) => {
    setReportingId(id);
    setReasonOption(REPORT_REASONS[0]);
    setCustomReason("");
    setInstagramError("");
    const savedIg = localStorage.getItem("reporterInstagram");
    if (savedIg) setReporterInstagram(savedIg);
  };

  const closeReportForm = () => {
    setReportingId(null);
    setReasonOption(REPORT_REASONS[0]);
    setCustomReason("");
    setInstagramError("");
  };

  const handleInstagramChange = (e) => {
    const raw = e.target.value;
    const cleaned = raw
      .replace(/^@+/, "")
      .replace(/\s/g, "")
      .replace(/[^a-zA-Z0-9._]/g, "")
      .slice(0, 30);
    setReporterInstagram(cleaned);
    if (instagramError) setInstagramError("");
  };

  const handleReport = async (confessionId) => {
    if (!activeReasonText) {
      toast.error("Please provide a reason.");
      return;
    }

    const ig = reporterInstagram.trim();
    if (!ig) {
      setInstagramError("Instagram username is required.");
      return;
    }
    if (ig.length < 2) {
      setInstagramError("Username must be at least 2 characters.");
      return;
    }

    if (cooldowns[confessionId] || submitting[confessionId]) {
      toast.error("Please wait before reporting again.");
      return;
    }
    const stored = JSON.parse(
      localStorage.getItem("confessionReports") || "{}",
    );
    const count = stored[confessionId] || 0;
    if (count >= MAX_REPORTS_PER_USER) {
      toast.error("You have already reported this confession twice.");
      return;
    }

    setSubmitting((prev) => ({ ...prev, [confessionId]: true }));

    try {
      const confessionRef = doc(db, "messages", confessionId);
      await updateDoc(confessionRef, {
        reported: true,
        reports: increment(1),
        reportReasons: arrayUnion(activeReasonText),
        reportDetails: arrayUnion({
          reason: activeReasonText,
          instagram: ig,
          reportedAt: new Date().toISOString(),
        }),
      });

      const confession = confessions.find((c) => c.id === confessionId);
      await sendToDiscord(
        `Confession: "${confession?.message || ""}"\nReason: "${activeReasonText}"\nReported by: @${ig}`,
        "report",
      );

      stored[confessionId] = count + 1;
      localStorage.setItem("confessionReports", JSON.stringify(stored));
      localStorage.setItem("reporterInstagram", ig);
      setReportCounts(stored);

      setCooldowns((prev) => ({ ...prev, [confessionId]: true }));
      setTimeout(() => {
        setCooldowns((prev) => ({ ...prev, [confessionId]: false }));
      }, COOLDOWN_MS);

      closeReportForm();
      toast.success("Thank you for your feedback!");
    } finally {
      setSubmitting((prev) => ({ ...prev, [confessionId]: false }));
    }
  };

  const filteredConfessions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const list = confessions.filter((confession) =>
      (confession.message || "").toLowerCase().includes(term),
    );
    return list.slice().sort((a, b) => {
      const diff = toMillis(b.createdAt) - toMillis(a.createdAt);
      return sortBy === "oldest" ? -diff : diff;
    });
  }, [confessions, searchTerm, sortBy]);

  const reportedByMeCount = useMemo(
    () => Object.values(reportCounts).filter((n) => n > 0).length,
    [reportCounts],
  );

  return (
    <div className="min-h-screen w-full bg-black text-gray-200 relative">
      <Toaster
        toastOptions={{
          style: {
            background: "#0a0a0a",
            color: "#f3f4f6",
            border: "1px solid rgba(255,255,255,0.1)",
            fontFamily: "monospace",
          },
        }}
      />

      {/* Ambient texture */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.05]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, #fff 0px, #fff 1px, transparent 1px, transparent 14px)",
        }}
      />
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.06),_transparent_60%)]" />
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_bottom,_rgba(127,29,29,0.15),_transparent_55%)]" />

      {/* Sticky control bar */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-black/80 border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-400/30 flex items-center justify-center rotate-3">
                <Flag className="text-red-400" size={18} />
              </div>
              <div>
                <h1 className="font-mono text-sm sm:text-base tracking-[0.2em] text-white uppercase">
                  Report Confessions
                </h1>
                <p className="font-mono text-[10px] sm:text-xs text-gray-400">
                  {confessions.length} active confession
                  {confessions.length === 1 ? "" : "s"}
                  {reportedByMeCount > 0 &&
                    ` · you flagged ${reportedByMeCount}`}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGuidelines((v) => !v)}
              className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wide px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition"
            >
              <Info size={13} />
              Rules
              <ChevronDown
                size={13}
                className={`transition-transform ${showGuidelines ? "rotate-180" : ""}`}
              />
            </button>
          </div>

          {showGuidelines && (
            <div className="mt-3 rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-4 text-xs sm:text-sm text-gray-400 leading-relaxed animate-[fadeIn_0.2s_ease] font-mono">
              <p className="text-gray-200 mb-1.5">
                // flag a confession when it contains:
              </p>
              <ul className="space-y-1 text-gray-500">
                <li>01. abusive, hateful or discriminatory language</li>
                <li>02. someone's private or sensitive information</li>
                <li>03. spam or repeated junk submissions</li>
                <li>04. targeted harassment or bullying</li>
              </ul>
              <p className="mt-2 text-gray-600">
                limit: {MAX_REPORTS_PER_USER} flags per case from this browser.
                every report is reviewed by a human.
              </p>
            </div>
          )}

          {/* Search + sort */}
          <div className="flex gap-2 mt-4">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search case files..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg py-2.5 px-4 pl-10 text-sm text-white placeholder-gray-600 font-mono focus:outline-none focus:ring-1 focus:ring-red-400/50 focus:border-red-400/50 transition"
              />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600">
                <Search size={15} />
              </span>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white transition"
                  aria-label="Clear search"
                >
                  <CloseIcon size={14} />
                </button>
              )}
            </div>

            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setShowSortMenu((v) => !v)}
                className="h-full flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-white/10 bg-white/5 text-gray-400 hover:text-white hover:border-white/20 transition text-xs font-mono uppercase"
              >
                <ArrowUpDown size={14} />
                <span className="hidden sm:inline">
                  {SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
                </span>
              </button>
              {showSortMenu && (
                <div className="absolute right-0 mt-2 w-44 rounded-lg border border-white/10 bg-gray-950 shadow-2xl z-20 overflow-hidden">
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setSortBy(option.value);
                        setShowSortMenu(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-xs font-mono transition ${
                        sortBy === option.value
                          ? "bg-white/10 text-white"
                          : "text-gray-500 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {searchTerm && (
            <div className="mt-2 text-[11px] font-mono text-gray-600">
              {filteredConfessions.length} match
              {filteredConfessions.length === 1 ? "" : "es"} · "{searchTerm}"
            </div>
          )}
        </div>
      </div>

      {/* Case file grid */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 font-mono text-gray-500 text-sm">
            <div className="flex gap-1">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-bounce [animation-delay:-0.3s]" />
              <span className="w-2 h-2 rounded-full bg-red-400 animate-bounce [animation-delay:-0.15s]" />
              <span className="w-2 h-2 rounded-full bg-red-400 animate-bounce" />
            </div>
            pulling confession...
          </div>
        ) : filteredConfessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-xl bg-white/5 border border-dashed border-white/15 flex items-center justify-center mb-4 -rotate-3">
              <FolderX size={26} className="text-gray-600" />
            </div>
            <p className="font-mono text-gray-400 text-sm uppercase tracking-wide">
              No confessions
            </p>
            <p className="text-gray-600 text-xs mt-1 font-mono">
              {searchTerm
                ? "try a different search term."
                : "nothing shared publicly yet."}
            </p>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 [column-fill:_balance]">
            {filteredConfessions.map((confession) => {
              const myReports = reportCounts[confession.id] || 0;
              const atLimit = myReports >= MAX_REPORTS_PER_USER;
              const isOpen = reportingId === confession.id;
              const isCoolingDown = cooldowns[confession.id];
              const isSubmitting = submitting[confession.id];
              const canReport = !atLimit && !isCoolingDown && !isSubmitting;

              return (
                <div
                  key={confession.id}
                  role={canReport && !isOpen ? "button" : undefined}
                  tabIndex={canReport && !isOpen ? 0 : undefined}
                  onClick={() => {
                    if (canReport && !isOpen) openReportForm(confession.id);
                  }}
                  onKeyDown={(e) => {
                    if (
                      canReport &&
                      !isOpen &&
                      (e.key === "Enter" || e.key === " ")
                    ) {
                      e.preventDefault();
                      openReportForm(confession.id);
                    }
                  }}
                  title={
                    atLimit
                      ? "You've reached the report limit for this case"
                      : canReport && !isOpen
                        ? "Click to flag this confession"
                        : undefined
                  }
                  className={`relative mb-4 break-inside-avoid rounded-xl border bg-[#0d0d0d] p-5 transition-all duration-200 group overflow-hidden ${
                    isOpen
                      ? "border-red-400/50 shadow-[0_0_0_1px_rgba(248,113,113,0.3),0_12px_30px_-10px_rgba(220,38,38,0.35)]"
                      : canReport
                        ? "border-white/10 cursor-pointer hover:border-red-400/40 hover:-translate-y-0.5 hover:shadow-[0_16px_30px_-12px_rgba(0,0,0,0.7)]"
                        : "border-white/10 opacity-70"
                  }`}
                >
                  {/* Folded-corner detail */}
                  <div
                    className="absolute top-0 right-0 w-5 h-5 bg-white/[0.06] border-l border-b border-white/10"
                    style={{ clipPath: "polygon(100% 0, 0 0, 100% 100%)" }}
                  />

                  {/* Diagonal stamp */}
                  {canReport && !isOpen && (
                    <div className="pointer-events-none select-none absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-200">
                      <span className="font-mono font-black text-2xl sm:text-3xl tracking-widest text-red-500/25 border-4 border-red-500/25 rounded px-4 py-1 -rotate-12">
                        FLAG
                      </span>
                    </div>
                  )}

                  {/* Case header */}
                  <div className="relative flex items-center justify-between mb-3 font-mono text-[10px] uppercase tracking-wider text-gray-400">
                    {confession.createdAt && (
                      <span className="inline-flex items-center gap-1">
                        <Clock size={10} />
                        {timeAgo(confession.createdAt)}
                      </span>
                    )}
                  </div>

                  {/* Message */}
                  <p className="relative font-serif text-[15px] sm:text-base text-gray-100 leading-relaxed whitespace-pre-wrap break-words">
                    "{confession.message}"
                  </p>

                  {confession.instagramUsername &&
                    confession.identityConfirmed && (
                      <p className="relative mt-3 font-mono text-[10px] text-gray-600">
                        — @{confession.instagramUsername}
                      </p>
                    )}

                  {atLimit && (
                    <div className="relative mt-4 pt-3 border-t border-dashed border-white/10 text-gray-500 text-[11px] font-mono flex items-center gap-2">
                      <Check size={13} /> limit reached for this case
                    </div>
                  )}

                  {/* Report modal overlay */}
                  {isOpen && (
                    <>
                      {/* Backdrop */}
                      <div
                        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                        onClick={closeReportForm}
                      />

                      {/* Modal */}
                      <div
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div
                          className="relative w-full max-w-md rounded-2xl border border-red-400/30 bg-gradient-to-br from-gray-900 via-black to-gray-800 p-6 shadow-2xl shadow-red-900/30 animate-[fadeIn_0.2s_ease]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Modal header */}
                          <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/10">
                            <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-400/30 flex items-center justify-center">
                              <AlertTriangle size={18} className="text-red-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-sm text-white">
                                Flag Confession
                              </h3>
                              <p className="text-[11px] text-gray-500 font-mono">
                                {caseNumber(confession.id)}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={closeReportForm}
                              className="w-8 h-8 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition"
                              aria-label="Close"
                            >
                              <CloseIcon size={14} />
                            </button>
                          </div>

                          {/* Reason */}
                          <div className="mb-4">
                            <label className="block text-[10px] font-mono uppercase tracking-wide text-gray-500 mb-1.5">
                              Reason for flagging
                            </label>
                            <select
                              value={reasonOption}
                              onChange={(e) => setReasonOption(e.target.value)}
                              className="w-full bg-black/60 border border-white/10 rounded-lg py-2.5 px-3 text-xs sm:text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-400/50 transition"
                            >
                              {REPORT_REASONS.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                              <option value="custom">Other (specify)</option>
                            </select>
                          </div>

                          {isReasonCustom && (
                            <div className="mb-4">
                              <textarea
                                className="w-full p-2.5 rounded-lg bg-black/60 border border-white/10 text-white focus:outline-none focus:ring-1 focus:ring-red-400/50 transition text-sm resize-none"
                                rows={2}
                                placeholder="Describe the issue..."
                                value={customReason}
                                onChange={(e) => setCustomReason(e.target.value)}
                                maxLength={MAX_CUSTOM_REASON}
                                autoFocus
                              />
                              <div className="flex justify-end text-[10px] mt-1 font-mono text-gray-600">
                                <span
                                  className={
                                    customReason.length >= MAX_CUSTOM_REASON
                                      ? "text-red-400 font-semibold"
                                      : ""
                                  }
                                >
                                  {MAX_CUSTOM_REASON - customReason.length} left
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Instagram username — mandatory */}
                          <div className="mb-5">
                            <label className="block text-[10px] font-mono uppercase tracking-wide text-gray-500 mb-1.5">
                              Your Instagram username <span className="text-red-400">*</span>
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-mono text-sm">
                                @
                              </span>
                              <input
                                type="text"
                                value={reporterInstagram}
                                onChange={handleInstagramChange}
                                placeholder="yourusername"
                                className={`w-full bg-black/60 border rounded-lg py-2.5 pl-8 pr-3 text-sm text-white placeholder-gray-600 font-mono focus:outline-none focus:ring-1 transition ${
                                  instagramError
                                    ? "border-red-400/60 focus:ring-red-400/50"
                                    : "border-white/10 focus:ring-red-400/50"
                                }`}
                                maxLength={30}
                              />
                            </div>
                            {instagramError && (
                              <p className="mt-1.5 text-[11px] text-red-400 font-mono flex items-center gap-1">
                                <AlertTriangle size={11} />
                                {instagramError}
                              </p>
                            )}
                            <p className="mt-1 text-[10px] text-gray-600 font-mono">
                              Required so our team can follow up if needed.
                            </p>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleReport(confession.id)}
                              disabled={
                                isCoolingDown ||
                                isSubmitting ||
                                (isReasonCustom && !customReason.trim())
                              }
                              className={`flex-1 bg-gradient-to-br from-red-600 to-red-800 text-white px-3 py-2.5 rounded-lg font-mono font-bold text-[11px] uppercase tracking-wide transition shadow-lg hover:from-red-500 hover:to-red-700 flex items-center justify-center gap-2 ${
                                isCoolingDown ||
                                isSubmitting ||
                                (isReasonCustom && !customReason.trim())
                                  ? "opacity-50 cursor-not-allowed"
                                  : ""
                              }`}
                            >
                              {isCoolingDown || isSubmitting ? (
                                "please wait..."
                              ) : (
                                <>
                                  <Send size={13} />
                                  submit report
                                </>
                              )}
                            </button>
                            <button
                              onClick={closeReportForm}
                              className="flex-1 bg-white/5 text-gray-300 border border-white/10 px-3 py-2.5 rounded-lg font-mono text-[11px] uppercase tracking-wide transition hover:bg-white/10"
                            >
                              cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
