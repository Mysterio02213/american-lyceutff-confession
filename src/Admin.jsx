import React, { useEffect, useRef, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  doc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import html2canvas from "html2canvas";
import { Toaster, toast } from "react-hot-toast";
import { Eye, FileText, Trash2, Download, Filter, X } from "lucide-react";

export default function AdminPage() {
  const [confessions, setConfessions] = useState([]);
  const [selectedConfession, setSelectedConfession] = useState(null);
  const [showOnlyNew, setShowOnlyNew] = useState(false);
  const confessionRef = useRef();
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const q = query(collection(db, "messages"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setConfessions(data);
    });
    return () => unsubscribe();
  }, []);

  const handleSelect = async (confession) => {
    if (confession.status === "not-opened") {
      await updateDoc(doc(db, "messages", confession.id), {
        status: "opened",
      });
      confession.status = "opened";
    }
    setSelectedConfession(confession);
  };

  const handleDelete = async () => {
    if (!selectedConfession) return;
    await deleteDoc(doc(db, "messages", selectedConfession.id));
    setConfessions((prev) =>
      prev.filter((c) => c.id !== selectedConfession.id)
    );
    setSelectedConfession(null);
    toast.success("Confession deleted");
  };

  const handleSaveImage = async () => {
    if (!confessionRef.current) return;

    const canvas = await html2canvas(confessionRef.current, {
      backgroundColor: null,
      scale: 3,
    });

    const padding = 40;
    const size = Math.max(canvas.width, canvas.height) + padding * 2;
    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = size;
    finalCanvas.height = size;

    const ctx = finalCanvas.getContext("2d");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(
      canvas,
      padding + (size - canvas.width - 2 * padding) / 2,
      padding + (size - canvas.height - 2 * padding) / 2
    );

    const dataUrl = finalCanvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = "confession.png";
    link.click();
    toast.success("Image saved");
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "";
    const dateObj = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return dateObj.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // Filter confessions based on search and status
  const filteredConfessions = confessions
    .filter(
      (confession) =>
        confession.message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        confession.ipAddress?.includes(searchTerm)
    )
    .filter((confession) => !showOnlyNew || confession.status === "not-opened");

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-black text-white">
      <Toaster
        position="top-center"
        reverseOrder={false}
        toastOptions={{
          style: {
            background: "#1a1a1a",
            color: "#fff",
            border: "1px solid #333",
          },
        }}
      />

      {/* Sidebar */}
      <aside className="w-full md:w-80 bg-gray-900 border-b md:border-r border-gray-700 p-5">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Confessions</h2>
          <div className="relative">
            <button
              onClick={() => setShowOnlyNew(!showOnlyNew)}
              className={`p-2 rounded-lg border ${
                showOnlyNew
                  ? "bg-white text-black border-white"
                  : "bg-transparent text-gray-300 border-gray-600"
              }`}
            >
              <Filter size={18} />
            </button>
            {showOnlyNew && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full"></span>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Search confessions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-3 pl-10 text-white focus:outline-none focus:ring-1 focus:ring-white"
          />
          <div className="absolute left-3 top-2.5 text-gray-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="overflow-auto space-y-2 max-h-[70vh] pr-1 custom-scrollbar">
          {filteredConfessions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No confessions found
            </div>
          ) : (
            filteredConfessions.map((confession) => (
              <div
                key={confession.id}
                onClick={() => handleSelect(confession)}
                className={`cursor-pointer px-4 py-3 rounded-xl text-sm transition-all flex items-start gap-3 border
            ${
              selectedConfession?.id === confession.id
                ? "bg-white text-black border-white"
                : confession.status === "not-opened"
                ? "bg-gray-800 border-white text-white"
                : "bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-300"
            }
          `}
              >
                <div className="mt-0.5 shrink-0">
                  {confession.status === "not-opened" ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <FileText className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="font-medium whitespace-pre-wrap break-words break-all max-w-full overflow-hidden line-clamp-2">
                    {confession.message || "Confession"}
                  </div>
                  <div className="text-xs mt-1">
                    {formatTimestamp(confession.createdAt)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 relative">
        {selectedConfession ? (
          <>
            <div className="absolute top-6 right-6 text-xs text-gray-400 group text-right">
              <div className="flex flex-col items-end gap-1">
                {/* IP */}
                <div
                  className="flex items-center gap-1 cursor-pointer hover:text-white"
                  onClick={() => {
                    if (selectedConfession.ipAddress) {
                      navigator.clipboard.writeText(
                        selectedConfession.ipAddress
                      );
                      toast.success("IP copied to clipboard!");
                    }
                  }}
                  title="Copy IP"
                >
                  <span className="bg-gray-800 p-1 rounded group-hover:bg-gray-700">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                  </span>
                  <strong>IP:</strong>{" "}
                  {selectedConfession.ipAddress || "Unknown"}
                </div>

                {/* Device Info (if exists) */}
                {selectedConfession.deviceInfo && (
                  <div className="text-gray-300 text-xs bg-gray-800 p-3 rounded mt-2 w-full max-w-xs shadow-md">
                    <strong className="block mb-2 text-white text-left">
                      Device Info:
                    </strong>
                    <div className="space-y-1">
                      {selectedConfession.deviceInfo
                        .split(" | ")
                        .map((entry, idx) => {
                          const [label, value] = entry
                            .split(":")
                            .map((s) => s.trim());
                          return (
                            <div
                              key={idx}
                              className="flex justify-between border-b border-gray-700 pb-1"
                            >
                              <span className="text-gray-400">{label}:</span>
                              <span className="text-white text-right ml-2">
                                {value || "Unknown"}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Confession Box */}
            <div
              ref={confessionRef}
              className="rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden backdrop-blur"
              style={{
                width: "min(90vw, 500px)",
                boxSizing: "border-box",
                background: "linear-gradient(145deg, #1f1f1f, #2c2c2c)", // black-gray gradient
              }}
            >
              {/* Header */}
              <div className="py-4 px-6 font-bold text-center text-xl border-b border-gray-700 bg-gradient-to-r from-white to-gray-200 text-black shadow-inner">
                ANONYMOUS CONFESSION
              </div>

              {/* Message */}
              <div className="p-6 text-white text-center font-bold whitespace-pre-wrap break-words bg-gradient-to-br from-black via-gray-900 to-gray-800">
                <p className="text-lg leading-relaxed text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.25)]">
                  {selectedConfession.message}
                </p>
              </div>

              {/* Timestamp */}
              <div className="py-4 px-6 text-gray-400 text-sm text-center border-t border-gray-700 bg-gradient-to-r from-gray-900 to-black">
                {formatTimestamp(selectedConfession.createdAt)}
              </div>
            </div>

            {/* Buttons */}
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <button
                onClick={handleSaveImage}
                className="flex items-center gap-2 bg-white text-black font-medium px-5 py-2.5 rounded-lg hover:bg-gray-200 transition-all border border-white"
              >
                <Download size={18} />
                Save as Image
              </button>
              <button
                onClick={handleDelete}
                className="flex items-center gap-2 bg-black text-white font-medium px-5 py-2.5 rounded-lg hover:bg-gray-800 transition-all border border-gray-600"
              >
                <Trash2 size={18} />
                Delete
              </button>
            </div>
          </>
        ) : (
          <div className="text-center max-w-md">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-8 mb-6 mx-auto w-48 h-48 flex items-center justify-center">
              <FileText size={64} className="text-gray-600" />
            </div>
            <h3 className="text-xl font-medium mb-2">No Confession Selected</h3>
            <p className="text-gray-400">
              Select a confession from the sidebar to view details
            </p>
          </div>
        )}
      </main>

      {/* Stats Bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 py-2 px-4 flex justify-between text-sm">
        <div className="text-gray-400">
          Total: {confessions.length} confessions
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 bg-white rounded-full"></span>
            New: {confessions.filter((c) => c.status === "not-opened").length}
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 bg-gray-600 rounded-full"></span>
            Viewed: {confessions.filter((c) => c.status === "opened").length}
          </div>
        </div>
      </div>

      {/* Custom Styles */}
      <style jsx>{`
        .word-break {
          word-break: break-word;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #444;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}
