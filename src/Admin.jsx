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
import {
  Eye,
  FileText,
  Trash2,
  Download,
  Filter,
  X,
  Menu,
  Check,
  Smartphone,
  Monitor,
  Globe,
  Info,
} from "lucide-react";

function TruncatedConfession({ text, maxLength = 200 }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  if (text.length <= maxLength || expanded) {
    return <span>{text}</span>;
  }
  return (
    <>
      {text.slice(0, maxLength)}...
      <button
        className="ml-2 text-blue-400 underline text-xs"
        onClick={() => setExpanded(true)}
        type="button"
      >
        Read more
      </button>
    </>
  );
}

function DeviceInfoLine({ info }) {
  if (!info) return null;
  const parts = info.split(" | ");
  const icons = {
    OS: <Monitor className="inline w-3 h-3 mr-0.5" />,
    Browser: <Globe className="inline w-3 h-3 mr-0.5" />,
    "Device Type": <Smartphone className="inline w-3 h-3 mr-0.5" />,
    "Device Brand": <Info className="inline w-3 h-3 mr-0.5" />,
    "Device Model": <Info className="inline w-3 h-3 mr-0.5" />,
  };
  return (
    <div className="flex flex-col items-start gap-0.5 text-[10px] text-gray-400 w-full break-words">
      {parts.map((part, idx) => {
        const [label, ...rest] = part.split(":");
        const value = rest.join(":").trim();
        return (
          <span
            key={idx}
            className="flex items-center gap-0.5 w-full break-words"
          >
            {icons[label.trim()] || <Info className="inline w-3 h-3 mr-0.5" />}
            <span className="font-semibold">{label.trim()}:</span>
            <span className="break-words">{value}</span>
          </span>
        );
      })}
    </div>
  );
}

export default function AdminPage() {
  const [confessions, setConfessions] = useState([]);
  const [selectedConfession, setSelectedConfession] = useState(null);
  const [showOnlyNew, setShowOnlyNew] = useState(false);
  const confessionRef = useRef();
  const [searchTerm, setSearchTerm] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all"); // NEW
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const filterDropdownRef = useRef(null); // Add this ref
  const [forceFullConfession, setForceFullConfession] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const deleteTimeoutRef = useRef(null);

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

  const handleDeleteClick = () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      // Reset after 3 seconds if not confirmed
      deleteTimeoutRef.current = setTimeout(
        () => setDeleteConfirm(false),
        3000
      );
    } else {
      clearTimeout(deleteTimeoutRef.current);
      handleDelete();
      setDeleteConfirm(false);
    }
  };

  const handleSaveImage = async () => {
    if (!confessionRef.current) return;
    setForceFullConfession(true);
    await new Promise((resolve) => setTimeout(resolve, 50)); // Wait for DOM update

    const canvas = await html2canvas(confessionRef.current, {
      backgroundColor: null,
      scale: 3,
    });

    setForceFullConfession(false);

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

  const handleMarkAsShared = async () => {
    if (!selectedConfession) return;
    await updateDoc(doc(db, "messages", selectedConfession.id), {
      status: "shared",
    });
    setConfessions((prev) =>
      prev.map((c) =>
        c.id === selectedConfession.id ? { ...c, status: "shared" } : c
      )
    );
    setSelectedConfession({ ...selectedConfession, status: "shared" });
    toast.success("Marked as shared");
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
    .filter((confession) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "reported") {
        return confession.reported && confession.reports > 0;
      }
      return confession.status === statusFilter;
    });

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showFilterDropdown) return;
    const handler = (e) => {
      if (
        filterDropdownRef.current &&
        !filterDropdownRef.current.contains(e.target)
      ) {
        setShowFilterDropdown(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [showFilterDropdown]);

  // Close sidebar when clicking outside (on mobile)
  const sidebarRef = useRef(null);
  useEffect(() => {
    if (!sidebarOpen) return;
    const handler = (e) => {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(e.target) &&
        // Ignore sidebar toggle button
        !e.target.closest(".sidebar-toggle-btn")
      ) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [sidebarOpen]);

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

      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden absolute top-4 left-4 z-50 p-2 bg-gray-800 text-white rounded-lg focus:outline-none sidebar-toggle-btn"
        // ^ Add this class for outside click ignore
      >
        {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={`
        fixed md:static top-0 left-0 h-[calc(100vh-36px)] w-64 md:w-80 bg-gray-900 border-r border-gray-700 p-5 pt-20 md:pt-5 z-40 transform transition-transform duration-300
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Confessions</h2>
          <div className="relative" ref={filterDropdownRef}>
            <button
              onClick={() => setShowFilterDropdown((v) => !v)}
              className="p-2 rounded-lg border bg-gray-900 border-gray-700 text-gray-300 hover:bg-gray-800 focus:outline-none"
              title="Filter confessions"
              type="button"
            >
              <Filter size={18} />
            </button>
            {showFilterDropdown && (
              <div className="absolute right-0 mt-2 z-20">
                <select
                  autoFocus
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setShowFilterDropdown(false); // Close after selection
                  }}
                  className="bg-black border border-gray-700 text-white rounded-lg px-3 py-2 text-sm shadow-lg focus:outline-none"
                  style={{
                    minWidth: 140,
                    border: "1px solid #444",
                  }}
                >
                  <option value="all">All</option>
                  <option value="not-opened">Not Opened</option>
                  <option value="opened">Opened</option>
                  <option value="shared">Shared</option>
                  <option value="reported">Reported</option>
                </select>
              </div>
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
                className={`cursor-pointer px-4 py-3 rounded-xl text-sm transition-all flex items-start gap-3 border relative
            ${
              selectedConfession?.id === confession.id
                ? "bg-white text-black border-white"
                : confession.status === "not-opened"
                ? "bg-gray-800 border-white text-white"
                : confession.status === "shared"
                ? "bg-green-900 border-green-400 text-green-200"
                : "bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-300"
            }
          `}
              >
                {/* Reported dot */}
                {confession.reported && (
                  <span
                    className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full"
                    title="Reported"
                  ></span>
                )}
                <div className="mt-0.5 shrink-0">
                  {confession.status === "not-opened" ? (
                    <Eye className="w-4 h-4" />
                  ) : confession.status === "shared" ? (
                    <Check className="w-4 h-4 text-green-300" />
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
            {/* Report Info Tab/Button */}
            {selectedConfession.reported && (
              <div className="w-full max-w-md mx-auto mt-4 mb-2">
                <details
                  className="bg-red-900/80 border border-red-400 rounded-xl p-0 shadow group"
                  open={false}
                >
                  <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none outline-none">
                    <span className="w-2.5 h-2.5 bg-red-500 rounded-full"></span>
                    <span className="font-bold text-red-200 text-base">
                      Report Info
                    </span>
                    <span className="ml-auto text-xs text-red-200">
                      {selectedConfession.reports || 1} report
                      {selectedConfession.reports > 1 ? "s" : ""}
                    </span>
                    <span className="ml-2 text-red-300 group-open:rotate-90 transition-transform">
                      &#9654;
                    </span>
                  </summary>
                  <div className="px-4 pb-4 pt-2 text-sm text-red-100">
                    <span className="font-semibold">Reasons:</span>
                    <ul className="list-disc ml-5 mt-1 space-y-1">
                      {(selectedConfession.reportReasons || []).map(
                        (reason, idx) => (
                          <li key={idx} className="break-words">
                            {reason}
                          </li>
                        )
                      )}
                    </ul>
                    <button
                      onClick={async () => {
                        await updateDoc(
                          doc(db, "messages", selectedConfession.id),
                          {
                            reported: false,
                            reports: 0,
                            reportReasons: [],
                          }
                        );
                        setConfessions((prev) =>
                          prev.map((c) =>
                            c.id === selectedConfession.id
                              ? {
                                  ...c,
                                  reported: false,
                                  reports: 0,
                                  reportReasons: [],
                                }
                              : c
                          )
                        );
                        setSelectedConfession({
                          ...selectedConfession,
                          reported: false,
                          reports: 0,
                          reportReasons: [],
                        });
                        toast.success("Report info cleared");
                      }}
                      className="mt-4 bg-red-700 hover:bg-red-800 text-white px-4 py-2 rounded-lg font-semibold transition"
                    >
                      Clear Report Info
                    </button>
                  </div>
                </details>
              </div>
            )}
            {/* Confession Box */}
            <div
              ref={confessionRef}
              className="relative rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-white/10 overflow-hidden backdrop-blur"
              style={{
                width: "min(90vw, 500px)",
                boxSizing: "border-box",
                background: "linear-gradient(145deg, #1f1f1f, #2c2c2c)",
              }}
            >
              {/* Header */}
              <div className="py-4 px-6 font-bold text-center text-xl border-b border-gray-700 bg-gradient-to-r from-white to-gray-200 text-black shadow-inner">
                ANONYMOUS CONFESSION
              </div>

              {/* Message */}
              <div
                className={`p-6 text-white text-center font-bold whitespace-pre-wrap break-words bg-gradient-to-br from-black via-gray-900 to-gray-800 ${
                  forceFullConfession
                    ? ""
                    : "max-h-[60vh] sm:max-h-[400px] overflow-y-auto"
                }`}
              >
                <p className="text-lg leading-relaxed text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.25)]">
                  {forceFullConfession ? (
                    selectedConfession.message
                  ) : (
                    <TruncatedConfession
                      text={selectedConfession.message}
                      maxLength={200}
                    />
                  )}
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
                onClick={handleDeleteClick}
                className={`flex items-center gap-2 bg-black text-white font-medium px-5 py-2.5 rounded-lg hover:bg-gray-800 transition-all border border-gray-600
                  ${
                    deleteConfirm
                      ? "border-red-500 bg-red-900 text-red-200"
                      : ""
                  }
                `}
              >
                <Trash2 size={18} />
                {deleteConfirm ? "Confirm?" : "Delete"}
              </button>
              <button
                onClick={handleMarkAsShared}
                disabled={selectedConfession.status === "shared"}
                className={`flex items-center gap-2 font-medium px-5 py-2.5 rounded-lg transition-all border
                  ${
                    selectedConfession.status === "shared"
                      ? "bg-green-700 text-white border-green-400 cursor-not-allowed opacity-60"
                      : "bg-green-500 text-white border-green-600 hover:bg-green-600"
                  }
                `}
              >
                <Check size={18} />
                {selectedConfession.status === "shared"
                  ? "Marked as Shared"
                  : "Mark as Shared"}
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
        {selectedConfession &&
          (selectedConfession.ipAddress || selectedConfession.deviceInfo) && (
            <div className="absolute top-2 right-3 z-10 p-3 rounded-xl bg-zinc-900/90 shadow-lg flex flex-col gap-2 min-w-[120px] max-w-[220px] text-[11px] text-gray-300">
              {/* IP Address */}
              {selectedConfession.ipAddress && (
                <div
                  title="Click to copy IP"
                  onClick={() => {
                    navigator.clipboard.writeText(selectedConfession.ipAddress);
                    toast.success("IP address copied!");
                  }}
                  className="cursor-pointer hover:text-blue-400 transition flex items-center gap-1"
                >
                  <Globe className="w-3 h-3" />
                  <span className="truncate">
                    {selectedConfession.ipAddress}
                  </span>
                </div>
              )}

              {/* Device Info */}
              {selectedConfession.deviceInfo && (
                <div className="flex flex-col gap-1 text-gray-400 text-[10px]">
                  {selectedConfession.deviceInfo
                    .split(" | ")
                    .map((part, idx) => {
                      const [label, ...rest] = part.split(":");
                      const value = rest.join(":").trim();
                      if (!label || !value) return null;

                      let icon = <Info className="w-3 h-3" />;
                      if (label.includes("OS"))
                        icon = <Monitor className="w-3 h-3" />;
                      else if (label.includes("Browser"))
                        icon = <Globe className="w-3 h-3" />;
                      else if (label.includes("Device Type"))
                        icon = <Smartphone className="w-3 h-3" />;

                      return (
                        <div key={idx} className="flex items-center gap-1">
                          {icon}
                          <span className="font-semibold">{label.trim()}:</span>
                          <span className="truncate">{value}</span>
                        </div>
                      );
                    })}
                </div>
              )}
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
            Viewed:{" "}
            {
              confessions.filter(
                (c) => c.status === "opened" || c.status === "shared"
              ).length
            }
          </div>
        </div>
      </div>

      {/* Custom Styles */}
      <style>{`
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
