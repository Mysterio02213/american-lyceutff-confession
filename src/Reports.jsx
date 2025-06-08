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

export default function ReportsPage() {
  const [confessions, setConfessions] = useState([]);
  const [loading, setLoading] = useState(true); // <-- loading state
  const [reportingId, setReportingId] = useState(null);
  const [reason, setReason] = useState("");
  const [reportCounts, setReportCounts] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [cooldowns, setCooldowns] = useState({});
  const [submitting, setSubmitting] = useState({}); // Prevent multiple clicks

  // Use localStorage to track user reports (max 2 per confession)
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
      setLoading(false); // <-- set loading false after data
    });
    return () => unsub();
  }, []);

  // Cooldown logic: 5 seconds per confession
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
    // Check localStorage for report count
    const stored = JSON.parse(
      localStorage.getItem("confessionReports") || "{}"
    );
    const count = stored[confessionId] || 0;
    if (count >= 2) {
      toast.error("You have already reported this confession twice.");
      return;
    }

    // Prevent multiple clicks
    setSubmitting((prev) => ({ ...prev, [confessionId]: true }));

    try {
      // Update Firestore
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

      // Update localStorage
      stored[confessionId] = count + 1;
      localStorage.setItem("confessionReports", JSON.stringify(stored));
      setReportCounts(stored);

      // Set cooldown
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

  // Filter confessions by search
  const filteredConfessions = confessions.filter((confession) =>
    (confession.message || "")
      .toLowerCase()
      .includes(searchTerm.trim().toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white px-4 py-8">
      <Toaster />
      <div className="max-w-2xl mx-auto">
        <div className="mb-8 text-center">
          <Flag className="mx-auto mb-2 text-red-500" size={40} />
          <h1 className="text-3xl font-extrabold mb-2 tracking-tight">
            Report a Confession
          </h1>
          <p className="text-gray-300 max-w-lg mx-auto">
            If you find a confession inappropriate or against our guidelines,
            please report it below.
          </p>
        </div>
        {/* Search Bar */}
        <div className="relative mb-8 max-w-lg mx-auto">
          <input
            type="text"
            placeholder="Search confessions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-4 pl-10 text-white focus:outline-none focus:ring-2 focus:ring-red-500 transition"
          />
          <span className="absolute left-3 top-2.5 text-gray-400">
            <Search size={18} />
          </span>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-white"
              aria-label="Clear search"
            >
              <CloseIcon size={18} />
            </button>
          )}
        </div>
        <div className="space-y-8 min-h-[200px] flex flex-col justify-center">
          {loading ? (
            <div className="flex justify-center items-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-500"></div>
              <span className="ml-3 text-gray-400 text-lg">
                Loading confessions...
              </span>
            </div>
          ) : filteredConfessions.length === 0 ? (
            <div className="text-gray-400 text-center py-16">
              No confessions found.
            </div>
          ) : (
            filteredConfessions.map((confession) => (
              <div
                key={confession.id}
                className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-shadow duration-200"
              >
                <div className="flex items-center mb-4">
                  <span className="mx-auto text-4xl font-extrabold text-red-400 flex items-center gap-3">
                    <Flag size={32} className="text-red-500" />
                    {confession.reports || 0}
                    <span className="text-lg font-medium text-gray-300">
                      reports
                    </span>
                  </span>
                </div>
                <div className="text-lg font-semibold whitespace-pre-wrap break-words mb-4 text-white/90 text-center">
                  {confession.message}
                </div>
                {reportCounts[confession.id] >= 2 ? (
                  <div className="text-green-500 text-base mt-2 font-medium flex items-center gap-2 justify-center">
                    <Check size={18} /> You have reached the report limit for
                    this confession.
                  </div>
                ) : reportingId === confession.id ? (
                  <div className="mt-2 flex flex-col gap-2">
                    <textarea
                      className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-white focus:ring-2 focus:ring-red-500 transition"
                      rows={3}
                      placeholder="Please enter your reason for reporting..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      maxLength={300}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReport(confession.id)}
                        disabled={
                          cooldowns[confession.id] || submitting[confession.id]
                        }
                        className={`flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold transition ${
                          cooldowns[confession.id] || submitting[confession.id]
                            ? "opacity-60 cursor-not-allowed"
                            : ""
                        }`}
                      >
                        {cooldowns[confession.id] || submitting[confession.id]
                          ? "Please wait..."
                          : "Submit Report"}
                      </button>
                      <button
                        onClick={() => {
                          setReportingId(null);
                          setReason("");
                        }}
                        className="flex-1 bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded-lg font-semibold transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setReportingId(confession.id)}
                    disabled={
                      reportCounts[confession.id] >= 2 ||
                      cooldowns[confession.id] ||
                      submitting[confession.id]
                    }
                    className={`w-full bg-red-700 hover:bg-red-800 text-white px-4 py-2 rounded-lg mt-2 font-semibold flex items-center justify-center gap-2 transition ${
                      reportCounts[confession.id] >= 2 ||
                      cooldowns[confession.id] ||
                      submitting[confession.id]
                        ? "opacity-60 cursor-not-allowed"
                        : ""
                    }`}
                  >
                    <Flag size={18} /> Report this confession
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
