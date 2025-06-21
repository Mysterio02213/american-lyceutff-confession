import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  increment,
} from "firebase/firestore";
import { db } from "./firebase";
import { toast, Toaster } from "react-hot-toast";
import { Check, Flag, Search, X as CloseIcon } from "lucide-react";
import sendToDiscord from "./sendToDiscord";

export default function ReportsPage() {
  const [confessions, setConfessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reportingId, setReportingId] = useState(null);
  const [reason, setReason] = useState("");
  const [reportCounts, setReportCounts] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [cooldowns, setCooldowns] = useState({});
  const [submitting, setSubmitting] = useState({});

  useEffect(() => {
    const stored = localStorage.getItem("confessionReports") || "{}";
    setReportCounts(JSON.parse(stored));
  }, []);

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, "messages"),
      where("status", "==", "shared")
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Reset localStorage report limit if confession has 0 reports
      let changed = false;
      const stored = JSON.parse(
        localStorage.getItem("confessionReports") || "{}"
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

  const COOLDOWN_MS = 5000;

  const handleReport = async (confessionId) => {
    if (!reason.trim()) {
      toast.error("Please provide a reason.");
      return;
    }
    if (cooldowns[confessionId] || submitting[confessionId]) {
      toast.error("Please wait before reporting again.");
      return;
    }
    const stored = JSON.parse(
      localStorage.getItem("confessionReports") || "{}"
    );
    const count = stored[confessionId] || 0;
    if (count >= 2) {
      toast.error("You have already reported this confession twice.");
      return;
    }

    setSubmitting((prev) => ({ ...prev, [confessionId]: true }));

    try {
      const confessionRef = doc(db, "messages", confessionId);
      await updateDoc(confessionRef, {
        reported: true,
        reports: increment(1),
        reportReasons: [
          ...(confessions.find((c) => c.id === confessionId)?.reportReasons ||
            []),
          reason,
        ],
      });

      const confession = confessions.find((c) => c.id === confessionId);
      await sendToDiscord(
        `Confession: "${confession?.message || ""}"\nReason: "${reason}"`,
        "report"
      );

      stored[confessionId] = count + 1;
      localStorage.setItem("confessionReports", JSON.stringify(stored));
      setReportCounts(stored);

      setCooldowns((prev) => ({
        ...prev,
        [confessionId]: true,
      }));
      setTimeout(() => {
        setCooldowns((prev) => ({
          ...prev,
          [confessionId]: false,
        }));
      }, COOLDOWN_MS);

      setReportingId(null);
      setReason("");
      toast.success("Thank you for your feedback!");
    } finally {
      setSubmitting((prev) => ({ ...prev, [confessionId]: false }));
    }
  };

  const filteredConfessions = confessions.filter((confession) =>
    (confession.message || "")
      .toLowerCase()
      .includes(searchTerm.trim().toLowerCase())
  );

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-black via-gray-900 to-black flex flex-col items-center px-2 py-8">
      <Toaster />
      <div className="w-full max-w-2xl mx-auto rounded-3xl shadow-2xl border border-gray-800 bg-gradient-to-br from-gray-900/90 via-black/95 to-gray-800/90 backdrop-blur-2xl p-0 sm:p-0 overflow-hidden">
        {/* Header */}
        <header className="w-full text-center py-8 px-2 sm:py-10 sm:px-6 bg-gradient-to-br from-black/90 via-gray-900/90 to-gray-800/90 border-b border-gray-800">
          <Flag className="mx-auto mb-3 text-gray-300" size={38} />
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent drop-shadow-lg mb-2">
            Report a Confession
          </h1>
          <p className="text-gray-400 max-w-xl mx-auto text-base sm:text-lg">
            Help us keep the platform safe and respectful. Search and report
            inappropriate confessions below.
          </p>
        </header>

        {/* Search Bar */}
        <div className="relative mb-8 max-w-lg mx-auto mt-8">
          <input
            type="text"
            placeholder="Search confessions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gradient-to-br from-gray-900 via-black to-gray-900 border border-gray-700 rounded-xl py-3 px-5 pl-12 text-white focus:outline-none focus:ring-2 focus:ring-gray-500 transition text-base shadow-lg"
          />
          <span className="absolute left-4 top-3.5 text-gray-500">
            <Search size={20} />
          </span>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-4 top-3.5 text-gray-500 hover:text-white"
              aria-label="Clear search"
            >
              <CloseIcon size={18} />
            </button>
          )}
        </div>

        {/* Confessions List */}
        <div className="space-y-7 min-h-[200px] flex flex-col justify-center px-3 sm:px-6 pb-10">
          {loading ? (
            <div className="flex justify-center items-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-600"></div>
              <span className="ml-4 text-gray-400 text-lg">
                Loading confessions...
              </span>
            </div>
          ) : filteredConfessions.length === 0 ? (
            <div className="text-gray-500 text-center py-16 text-lg">
              No confessions found.
            </div>
          ) : (
            filteredConfessions
              .slice()
              .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
              .map((confession) => (
                <div
                  key={confession.id}
                  className="relative bg-gradient-to-br from-gray-900 via-black to-gray-800 border border-gray-800 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-shadow duration-200 group"
                >
                  {/* Futuristic small report button at top right */}
                  <button
                    onClick={() => setReportingId(confession.id)}
                    disabled={
                      reportCounts[confession.id] >= 2 ||
                      cooldowns[confession.id] ||
                      submitting[confession.id]
                    }
                    className={`absolute top-4 right-4 p-2 rounded-full border border-gray-700 bg-gradient-to-br from-gray-900 via-black to-gray-800 text-gray-400 hover:text-red-400 hover:border-red-400 hover:bg-gray-900/80 transition text-xs flex items-center shadow-lg z-10
                      ${
                        reportCounts[confession.id] >= 2 ||
                        cooldowns[confession.id] ||
                        submitting[confession.id]
                          ? "opacity-60 cursor-not-allowed"
                          : ""
                      }`}
                    title="Report this confession"
                  >
                    <Flag size={16} className="text-red-400" />
                  </button>
                  <div className="text-lg font-medium whitespace-pre-wrap break-words text-center text-white tracking-wide leading-relaxed">
                    {confession.message}
                  </div>
                  {reportCounts[confession.id] >= 2 ? (
                    <div className="text-gray-400 text-xs mt-3 font-medium flex items-center gap-2 justify-center">
                      <Check size={14} /> You have reached the report limit for
                      this confession.
                    </div>
                  ) : reportingId === confession.id ? (
                    <div className="mt-4 flex flex-col gap-2 bg-gradient-to-br from-gray-900/80 via-black/80 to-gray-800/80 border border-gray-700 rounded-xl p-4">
                      <textarea
                        className="w-full p-2 rounded bg-black border border-gray-700 text-white focus:ring-2 focus:ring-gray-500 transition text-sm"
                        rows={2}
                        placeholder="Reason for reporting..."
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        maxLength={300}
                      />
                      <div className="flex justify-end text-xs mt-1 text-gray-400">
                        <span
                          className={
                            reason.length >= 300
                              ? "text-red-400 font-semibold"
                              : ""
                          }
                        >
                          {300 - reason.length}
                        </span>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleReport(confession.id)}
                          disabled={
                            cooldowns[confession.id] ||
                            submitting[confession.id]
                          }
                          className={`flex-1 bg-gradient-to-br from-white via-gray-200 to-gray-400 text-black border border-gray-700 px-3 py-2 rounded-lg font-bold text-xs transition shadow-sm hover:bg-gray-100 hover:text-black ${
                            cooldowns[confession.id] ||
                            submitting[confession.id]
                              ? "opacity-60 cursor-not-allowed"
                              : ""
                          }`}
                        >
                          {cooldowns[confession.id] || submitting[confession.id]
                            ? "Please wait..."
                            : "Submit"}
                        </button>
                        <button
                          onClick={() => {
                            setReportingId(null);
                            setReason("");
                          }}
                          className="flex-1 bg-gradient-to-br from-gray-900 via-black to-gray-800 text-white border border-gray-700 px-3 py-2 rounded-lg font-bold text-xs transition shadow-sm hover:bg-gray-900"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
}
