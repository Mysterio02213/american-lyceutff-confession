import { useEffect, useRef, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  doc,
  deleteDoc,
  getDocs,
  setDoc,
  getDoc,
  deleteField,
} from "firebase/firestore";
import { db } from "./firebase";
import { doc as firestoreDoc } from "firebase/firestore";
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
  Pencil,
  Ban,
  Undo2,
  ShieldX,
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
  const allowedEmail = "hasnainamironly@gmail.com";
  const allowedIp = "139.135.60.86";
  const ADMIN_PASSWORD = "Mysterio@Mysterio"; // Change this!

  const [accessAllowed, setAccessAllowed] = useState(null);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [confessions, setConfessions] = useState([]);
  const [selectedConfession, setSelectedConfession] = useState(null);
  const confessionRef = useRef();
  const [searchTerm, setSearchTerm] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const filterDropdownRef = useRef(null);
  const [forceFullConfession, setForceFullConfession] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const deleteTimeoutRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editMessage, setEditMessage] = useState("");
  const [bannedIps, setBannedIps] = useState([]);
  const [showBannedTab, setShowBannedTab] = useState(false);
  const [isSelectedBanned, setIsSelectedBanned] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [banCustomReason, setBanCustomReason] = useState("");
  const [showBanModal, setShowBanModal] = useState(false);
  const [banLoading, setBanLoading] = useState(false);
  const [unbanLoading, setUnbanLoading] = useState(false);

  // Check if selected confession's IP is banned
  useEffect(() => {
    if (!selectedConfession?.ipAddress) {
      setIsSelectedBanned(false);
      return;
    }
    const check = async () => {
      try {
        const docSnap = await getDoc(
          firestoreDoc(db, "bannedIps", selectedConfession.ipAddress)
        );
        setIsSelectedBanned(!!(docSnap.exists() && docSnap.data().banned));
      } catch {
        setIsSelectedBanned(false);
      }
    };
    check();
  }, [selectedConfession]);

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

  useEffect(() => {
    const userEmail = localStorage.getItem("adminEmail");
    if (userEmail === allowedEmail) {
      setAccessAllowed(true);
      return;
    }
    fetch("https://api.ipify.org?format=json")
      .then((res) => res.json())
      .then((data) => {
        if (data.ip === allowedIp) {
          setAccessAllowed(true);
        } else {
          const isAuthed = localStorage.getItem("adminAuthed") === "true";
          if (isAuthed) {
            setAccessAllowed(true);
          } else {
            setShowPasswordPrompt(true);
            setAccessAllowed(false);
          }
        }
      })
      .catch(() => {
        setShowPasswordPrompt(true);
        setAccessAllowed(false);
      });
  }, []);

  const handleSelect = async (confession) => {
    if (confession.status === "not-opened") {
      await updateDoc(doc(db, "messages", confession.id), {
        status: "opened",
      });
      confession.status = "opened";
    }
    setIsEditing(false);
    setEditMessage("");
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
    await new Promise((resolve) => setTimeout(resolve, 50));
    // Get the background color from the confession box
    let bgColor = "#fff";
    if (selectedConfession?.customColor) {
      bgColor = selectedConfession.customColor + "cc";
    }
    // Use computed style if needed
    const computedBg = window.getComputedStyle(
      confessionRef.current
    ).background;
    // html2canvas does not support gradients as backgroundColor, so fallback to solid color
    const canvas = await html2canvas(confessionRef.current, {
      backgroundColor: bgColor,
      scale: 3,
    });
    setForceFullConfession(false);
    const padding = 40;
    const size = Math.max(canvas.width, canvas.height) + padding * 2;
    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = size;
    finalCanvas.height = size;
    const ctx = finalCanvas.getContext("2d");
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(
      canvas,
      padding + (size - canvas.width - 2 * padding) / 2,
      padding + (size - canvas.height - 2 * padding) / 2
    );
    const dataUrl = finalCanvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;

    // Get first 2 or 3 words from the confession message for filename
    let filename = "confession";
    if (selectedConfession?.message) {
      const words = selectedConfession.message
        .replace(/\s+/g, " ")
        .trim()
        .split(" ")
        .slice(0, 3)
        .join("_")
        .replace(/[^a-zA-Z0-9_]/g, "");
      if (words.length > 0) filename = words;
    }
    link.download = `${filename}.png`;
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

  const sidebarRef = useRef(null);
  useEffect(() => {
    if (!sidebarOpen) return;
    const handler = (e) => {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(e.target) &&
        !e.target.closest(".sidebar-toggle-btn")
      ) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [sidebarOpen]);

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      localStorage.setItem("adminAuthed", "true");
      setAccessAllowed(true);
      setShowPasswordPrompt(false);
      setPasswordError("");
      setPasswordInput("");
    } else {
      setPasswordError("Incorrect password. Please try again.");
      setPasswordInput("");
    }
  };

  // Ban IP (now opens modal)
  const handleBanIp = () => {
    if (!selectedConfession?.ipAddress) {
      toast.error("No IP address found for this confession.");
      return;
    }
    setShowBanModal(true);
  };

  // Confirm Ban with cooldown
  const handleConfirmBan = async () => {
    if (banLoading) return;
    const reason = banReason === "custom" ? banCustomReason.trim() : banReason;
    if (!reason) {
      toast.error("Please select or enter a reason.");
      return;
    }
    setBanLoading(true);
    try {
      await setDoc(
        firestoreDoc(db, "bannedIps", selectedConfession.ipAddress),
        {
          banned: true,
          bannedAt: new Date(),
          reason,
        }
      );
      setIsSelectedBanned(true);
      setShowBanModal(false);
      setBanReason("");
      setBanCustomReason("");
      toast.success("User/IP banned successfully!");
    } catch (err) {
      toast.error("Failed to ban IP.");
    } finally {
      setTimeout(() => setBanLoading(false), 2000); // 2s cooldown
    }
  };

  // Unban IP (for selected confession) with cooldown
  const handleUnbanSelectedIp = async () => {
    if (unbanLoading) return;
    if (!selectedConfession?.ipAddress) return;
    setUnbanLoading(true);
    try {
      await setDoc(
        firestoreDoc(db, "bannedIps", selectedConfession.ipAddress),
        { banned: false },
        { merge: true }
      );
      setIsSelectedBanned(false);
      setBannedIps((prev) =>
        prev.filter((b) => b.ip !== selectedConfession.ipAddress)
      );
      toast.success("User/IP unbanned!");
    } catch (err) {
      toast.error("Failed to unban IP.");
    } finally {
      setTimeout(() => setUnbanLoading(false), 2000); // 2s cooldown
    }
  };

  // Unban function (for banned tab) with cooldown
  const handleUnbanIp = async (ip) => {
    if (unbanLoading) return;
    setUnbanLoading(true);
    try {
      await setDoc(
        firestoreDoc(db, "bannedIps", ip),
        { banned: false },
        { merge: true }
      );
      setBannedIps((prev) => prev.filter((b) => b.ip !== ip));
      // If selected confession is this IP, update state
      if (selectedConfession?.ipAddress === ip) setIsSelectedBanned(false);
      toast.success("User/IP unbanned!");
    } catch (err) {
      toast.error("Failed to unban IP.");
    } finally {
      setTimeout(() => setUnbanLoading(false), 2000); // 2s cooldown
    }
  };

  // Fetch banned IPs
  useEffect(() => {
    if (!showBannedTab) return;
    const fetchBannedIps = async () => {
      const snap = await getDocs(collection(db, "bannedIps"));
      setBannedIps(
        snap.docs
          .filter((doc) => doc.data().banned)
          .map((doc) => ({
            ip: doc.id,
            ...doc.data(),
          }))
      );
    };
    fetchBannedIps();
  }, [showBannedTab]);

  if (showPasswordPrompt && accessAllowed === false) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white">
        <div className="w-full max-w-xs rounded-2xl shadow-2xl border border-gray-800 bg-gradient-to-br from-black via-gray-900 to-gray-800 p-8">
          <h2 className="text-2xl font-extrabold mb-6 text-center bg-gradient-to-r from-white via-gray-300 to-gray-400 bg-clip-text text-transparent">
            Admin Login
          </h2>
          <form onSubmit={handlePasswordSubmit} className="space-y-5">
            <div>
              <label className="block mb-2 text-xs font-semibold text-gray-300 tracking-wide">
                Enter Admin Password
              </label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-black/80 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-white transition"
                autoFocus
                autoComplete="current-password"
                placeholder="Password"
              />
              {passwordError && (
                <div className="text-xs mt-2 text-center text-red-400">
                  {passwordError}
                </div>
              )}
            </div>
            <button
              type="submit"
              className="w-full py-2 rounded-lg font-bold bg-gradient-to-r from-gray-700 via-gray-900 to-black text-white border border-gray-700 hover:from-gray-600 hover:to-gray-900 transition"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

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
      >
        {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={`
        fixed md:static top-0 left-0 h-[calc(100vh-36px)] w-64 md:w-80 bg-gray-900 border-r border-gray-700 p-5 pt-20 md:pt-5 z-40 transform transition-transform duration-300
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        flex-shrink-0
      `}
        style={{ minWidth: 0 }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Confessions</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setShowBannedTab((v) => !v)}
                className={`
                  p-2 rounded-full border border-gray-700 bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-red-400 focus:outline-none transition
                  ${
                    showBannedTab
                      ? "bg-red-950 text-red-400 border-red-400 shadow"
                      : ""
                  }
                `}
                title="Banned Users"
                type="button"
                aria-label="Banned Users"
                style={{
                  minWidth: 0,
                  width: 38,
                  height: 38,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                }}
              >
                <ShieldX className="w-5 h-5" />
                <span className="sr-only">Banned Users</span>
                {bannedIps.length > 0 && (
                  <span
                    className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-xs font-bold rounded-full px-1.5 py-0.5 border-2 border-gray-900"
                    style={{
                      minWidth: 18,
                      minHeight: 18,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                    }}
                  >
                    {bannedIps.length}
                  </span>
                )}
              </button>
            </div>
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
        </div>

        {/* Banned Users Tab */}
        {showBannedTab ? (
          <div
            className="overflow-auto space-y-2 max-h-[70vh] pr-1 custom-scrollbar flex flex-col"
            style={{
              minHeight: "200px",
              maxHeight: "calc(100vh - 120px)",
              width: "100%",
            }}
          >
            <h3 className="text-lg font-bold text-red-300 mb-2 flex items-center gap-2">
              <Ban className="w-5 h-5" /> Banned Users
            </h3>
            {bannedIps.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No banned users
              </div>
            ) : (
              <div className="flex flex-col gap-3 w-full">
                {bannedIps.map((ban) => (
                  <div
                    key={ban.ip}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-red-900/60 border border-red-400 rounded-xl px-4 py-3 text-sm text-red-200 w-full"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs break-all">
                        {ban.ip}
                      </div>
                      <div className="text-xs text-gray-300">
                        {ban.bannedAt
                          ? new Date(
                              ban.bannedAt.seconds
                                ? ban.bannedAt.seconds * 1000
                                : ban.bannedAt
                            ).toLocaleString()
                          : ""}
                      </div>
                      {ban.reason && (
                        <div className="text-xs text-red-200 mt-1">
                          <span className="font-semibold">Reason:</span>{" "}
                          {ban.reason}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleUnbanIp(ban.ip)}
                      className="flex items-center gap-1 px-3 py-1 mt-2 sm:mt-0 sm:ml-4 rounded-lg bg-gradient-to-br from-green-700 via-green-900 to-black text-white border border-green-400 hover:bg-green-800 transition-all text-xs"
                      disabled={unbanLoading}
                    >
                      <Undo2 className="w-4 h-4" />
                      {unbanLoading ? "Please wait..." : "Unban"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
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
          </>
        )}
      </aside>

      {/* Main Content */}
      <main
        className="flex-1 flex flex-col items-center justify-center p-6 relative min-w-0"
        style={{
          background: selectedConfession?.customColor
            ? `linear-gradient(120deg, ${selectedConfession.customColor}22 0%, #fff 100%)`
            : "linear-gradient(120deg, #111 0%, #fff 100%)",
          minHeight: "100vh",
          transition: "background 0.7s",
        }}
      >
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
              className="relative w-full max-w-2xl mx-auto px-0 md:px-8"
              style={{
                padding: "0",
                margin: "0 auto",
                zIndex: 2,
              }}
            >
              <div
                className="shadow-2xl border confession-glass"
                style={{
                  border: "3px solid",
                  borderColor: selectedConfession?.customColor
                    ? selectedConfession.customColor
                    : "#111",
                  background: selectedConfession?.customColor
                    ? `linear-gradient(120deg, ${selectedConfession.customColor}cc 0%, ${selectedConfession.customColor}99 100%)`
                    : "#fff",
                  color: selectedConfession?.customColor ? "#fff" : "#111",
                  boxShadow: selectedConfession?.customColor
                    ? `0 8px 32px 0 ${selectedConfession.customColor}33`
                    : "0 8px 32px 0 #1112",
                  backdropFilter: "blur(12px)",
                  transition: "box-shadow 0.3s, border 0.3s, background 0.3s",
                  position: "relative",
                  overflow: "hidden",
                  borderRadius: "1rem",
                  minWidth: "320px",
                  maxWidth: "100%",
                  width: "100%",
                  minHeight: "220px",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Header */}
                <div
                  className="py-6 px-6 font-extrabold text-center text-2xl border-b"
                  style={{
                    borderColor: "transparent",
                    color: selectedConfession?.customColor ? "#fff" : "#111",
                    fontFamily: "Montserrat, Arial, sans-serif",
                    letterSpacing: "0.08em",
                    background: selectedConfession?.customColor
                      ? `linear-gradient(90deg, ${selectedConfession.customColor} 0%, ${selectedConfession.customColor}bb 100%)`
                      : "#f3f4f6",
                    textShadow: selectedConfession?.customColor
                      ? "0 2px 16px #000a"
                      : "none",
                    borderTopLeftRadius: "1rem",
                    borderTopRightRadius: "1rem",
                    boxShadow: selectedConfession?.customColor
                      ? `0 2px 16px ${selectedConfession.customColor}33`
                      : "0 2px 16px #1112",
                  }}
                >
                  ANONYMOUS CONFESSION
                </div>
                {/* Message */}
                <div
                  className="relative px-6 py-8 text-center font-semibold whitespace-pre-wrap break-words flex-1"
                  style={{
                    color: selectedConfession?.customColor ? "#fff" : "#111",
                    fontSize: "1.15rem",
                    textShadow: selectedConfession?.customColor
                      ? "0 2px 12px #000c"
                      : "none",
                    background: selectedConfession?.customColor
                      ? "transparent"
                      : "#fff",
                    fontFamily: "Inter, Arial, sans-serif",
                    lineHeight: "1.7",
                    minHeight: "120px",
                    maxHeight: "60vh",
                    overflowY: "auto",
                    borderRadius: 0,
                  }}
                >
                  {isEditing ? (
                    <div className="flex flex-col items-center gap-3 w-full">
                      <textarea
                        className="w-full min-h-[120px] p-4 rounded-lg bg-black/70 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                        value={editMessage}
                        onChange={(e) => setEditMessage(e.target.value)}
                        maxLength={1100}
                        style={{
                          fontSize: "1.1rem",
                          fontFamily: "Inter, Arial, sans-serif",
                          boxShadow: "0 2px 12px #0008",
                          width: "100%",
                          minWidth: 0,
                        }}
                      />
                      <div className="flex flex-col sm:flex-row gap-2 mt-2 w-full justify-center items-center">
                        <button
                          className="w-full sm:w-auto px-5 py-2 rounded-lg bg-gradient-to-br from-blue-500 via-blue-700 to-blue-900 text-white font-bold shadow-lg hover:from-blue-600 hover:to-blue-800 transition"
                          onClick={async () => {
                            await updateDoc(
                              doc(db, "messages", selectedConfession.id),
                              {
                                message: editMessage,
                              }
                            );
                            setConfessions((prev) =>
                              prev.map((c) =>
                                c.id === selectedConfession.id
                                  ? { ...c, message: editMessage }
                                  : c
                              )
                            );
                            setSelectedConfession({
                              ...selectedConfession,
                              message: editMessage,
                            });
                            setIsEditing(false);
                            toast.success("Confession updated!");
                          }}
                        >
                          Save
                        </button>
                        <button
                          className="w-full sm:w-auto px-5 py-2 rounded-lg bg-gray-700 hover:bg-gray-800 text-white font-bold shadow-lg transition"
                          onClick={() => {
                            setIsEditing(false);
                            setEditMessage(selectedConfession.message);
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-xl leading-relaxed">
                        {forceFullConfession ? (
                          selectedConfession.message
                        ) : (
                          <TruncatedConfession
                            text={selectedConfession.message}
                            maxLength={200}
                          />
                        )}
                      </p>
                      {/* Instagram Username Info */}
                      {selectedConfession.instagramUsername &&
                        selectedConfession.identityConfirmed && (
                          <div
                            className="mt-6 text-base text-center font-semibold"
                            style={{
                              fontWeight: 500,
                              letterSpacing: "0.02em",
                              color: selectedConfession?.customColor
                                ? "#e0e6f0"
                                : "#888",
                              opacity: 0.8,
                              textShadow: selectedConfession?.customColor
                                ? "0 1px 8px #0004, 1px 1px 0 #222"
                                : "none",
                              transition: "color 0.3s",
                            }}
                          >
                            Sent by:{" "}
                            {isEditing || forceFullConfession ? (
                              `@${selectedConfession.instagramUsername}`
                            ) : (
                              <a
                                href={`https://instagram.com/${selectedConfession.instagramUsername}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="underline hover:text-blue-400 transition"
                                style={{
                                  color: selectedConfession?.customColor
                                    ? "#e0e6f0"
                                    : "#888",
                                  textShadow: selectedConfession?.customColor
                                    ? "0 1px 8px #0004, 1px 1px 0 #222"
                                    : "none",
                                }}
                              >
                                @{selectedConfession.instagramUsername}
                              </a>
                            )}
                          </div>
                        )}
                    </>
                  )}

                  {/* Edit button: only show when not editing and not saving image */}
                  {!isEditing && !forceFullConfession && (
                    <button
                      className="absolute top-4 right-4 p-3 rounded-full bg-white/90 hover:bg-blue-100 border border-gray-400 shadow-lg focus:outline-none transition z-10"
                      style={{ boxShadow: "0 2px 12px 0 #0008" }}
                      onClick={() => {
                        setIsEditing(true);
                        setEditMessage(selectedConfession.message);
                      }}
                      title="Edit confession"
                      aria-label="Edit confession"
                    >
                      <Pencil className="w-5 h-5 text-blue-700" />
                    </button>
                  )}
                </div>
                {/* Timestamp */}
                <div
                  className="py-4 px-8 text-base text-center border-t"
                  style={{
                    fontWeight: 500,
                    letterSpacing: "0.02em",
                    borderBottomLeftRadius: "1rem",
                    borderBottomRightRadius: "1rem",
                    background: selectedConfession?.customColor
                      ? `${selectedConfession.customColor}cc`
                      : "#f3f4f6",
                    color: selectedConfession?.customColor ? "#fff" : "#111",
                    fontFamily: "Inter, Arial, sans-serif",
                    textShadow: selectedConfession?.customColor
                      ? "0 1px 8px #0004"
                      : "none",
                  }}
                >
                  {formatTimestamp(selectedConfession.createdAt)}
                </div>
              </div>
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

        {selectedConfession && (
          <div className="w-full flex justify-center mt-6 md:mt-10 px-4">
            <div className="w-full max-w-2xl flex flex-wrap justify-center gap-3 z-20">
              <button
                onClick={handleSaveImage}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-full border border-gray-300 bg-white text-black hover:bg-gray-100 font-medium transition-all w-full sm:w-auto min-w-[140px]"
              >
                <Download size={18} />
                Save as Image
              </button>

              <button
                onClick={handleDeleteClick}
                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-full border bg-red-900 text-white font-medium transition-all w-full sm:w-auto min-w-[140px] ${
                  deleteConfirm
                    ? "border-red-500 bg-red-700"
                    : "border-red-700 hover:bg-red-800"
                }`}
              >
                <Trash2 size={18} />
                {deleteConfirm ? "Confirm?" : "Delete"}
              </button>

              <button
                onClick={handleMarkAsShared}
                disabled={selectedConfession.status === "shared"}
                className={`flex items-center justify-center gap-2 px-4 py-2 rounded-full font-medium transition-all w-full sm:w-auto min-w-[140px] ${
                  selectedConfession.status === "shared"
                    ? "opacity-60 cursor-not-allowed bg-green-800 border-green-600 text-white"
                    : "bg-green-700 border-green-600 hover:bg-green-800 text-white"
                }`}
              >
                <Check size={18} />
                {selectedConfession.status === "shared"
                  ? "Marked as Shared"
                  : "Mark as Shared"}
              </button>

              {isSelectedBanned ? (
                <button
                  onClick={handleUnbanSelectedIp}
                  disabled={!selectedConfession.ipAddress || unbanLoading}
                  title="Unban this user's IP"
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-green-700 border border-green-600 text-white hover:bg-green-800 font-medium transition-all w-full sm:w-auto min-w-[140px] disabled:opacity-50"
                >
                  <Undo2 className="w-5 h-5" />
                  {unbanLoading ? "Please wait..." : "Unban User"}
                </button>
              ) : (
                <button
                  onClick={handleBanIp}
                  disabled={!selectedConfession.ipAddress || banLoading}
                  title={
                    selectedConfession.ipAddress
                      ? "Ban this user's IP"
                      : "No IP address to ban"
                  }
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-red-700 border border-red-600 text-white hover:bg-red-800 font-medium transition-all w-full sm:w-auto min-w-[140px] disabled:opacity-50"
                >
                  🚫 {banLoading ? "Please wait..." : "Ban User"}
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Stats Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-black via-gray-900 to-black border-t border-white/10 px-4 py-2">
        <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-300 text-center">
          <div className="flex-1 min-w-[120px]">
            <span className="font-semibold">{confessions.length}</span>{" "}
            Confessions
          </div>
          <div className="flex-1 min-w-[120px]">
            <span className="font-semibold">
              {confessions.filter((c) => c.status === "not-opened").length}
            </span>{" "}
            Not Opened
          </div>
          <div className="flex-1 min-w-[120px]">
            <span className="font-semibold">
              {confessions.filter((c) => c.status === "shared").length}
            </span>{" "}
            Shared
          </div>
          <div className="flex-1 min-w-[120px]">
            <span className="font-semibold">
              {confessions.filter((c) => c.reported && c.reports > 0).length}
            </span>{" "}
            Reported
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
        .confession-glass {
          backdrop-filter: blur(14px);
          border-radius: 1.25rem;
          border: 4px solid transparent;
          transition: box-shadow 0.3s, border 0.3s, background 0.3s;
        }
        @keyframes gradientBG {
          0% {
            background: linear-gradient(120deg, #232526 0%, #414345 100%);
          }
          50% {
            background: linear-gradient(120deg, #232526 0%, #7f5fff 50%, #00c6ff 100%);
          }
          100% {
            background: linear-gradient(120deg, #232526 0%, #414345 100%);
          }
        }
      `}</style>

      {/* Ban Modal */}
      {showBanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-xs shadow-2xl flex flex-col gap-4">
            <h3 className="text-lg font-bold text-red-300 flex items-center gap-2">
              <ShieldX className="w-5 h-5" /> Ban User
            </h3>
            <div>
              <label className="block mb-2 text-sm font-semibold text-gray-300">
                Select a reason for ban:
              </label>
              <select
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg py-2 px-3 text-white focus:outline-none"
                disabled={banLoading}
              >
                <option value="">-- Select Reason --</option>
                <option value="Use of Abusive or Inappropriate Language">
                  Use of Abusive or Inappropriate Language
                </option>
                <option value="Sharing Sensitive or Private Information">
                  Sharing Sensitive or Private Information
                </option>
                <option value="Irrelevant or Non-Constructive Submissions">
                  Irrelevant or Non-Constructive Submissions
                </option>
                <option value="Spamming or Repeated Submissions">
                  Spamming or Repeated Submissions
                </option>
                <option value="custom">Other (Specify Reason)</option>
              </select>
              {banReason === "custom" && (
                <input
                  type="text"
                  value={banCustomReason}
                  onChange={(e) => setBanCustomReason(e.target.value)}
                  className="w-full mt-3 bg-gray-800 border border-gray-700 rounded-lg py-2 px-3 text-white focus:outline-none"
                  placeholder="Enter custom reason"
                  maxLength={100}
                  autoFocus
                  disabled={banLoading}
                />
              )}
            </div>
            <div className="flex gap-2 justify-end mt-2">
              <button
                onClick={() => {
                  setShowBanModal(false);
                  setBanReason("");
                  setBanCustomReason("");
                }}
                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-800 text-white font-semibold transition"
                disabled={banLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBan}
                className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white font-semibold transition"
                disabled={banLoading}
              >
                {banLoading ? "Please wait..." : "Ban User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
