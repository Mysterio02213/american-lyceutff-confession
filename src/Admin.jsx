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
import { doc as firestoreDoc } from "firebase/firestore";
import { db } from "./firebase";
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
  MessageSquare,
  ChevronDown,
  Users,
  Image as ImageIcon,
  ImageOff,
  Flag,
  AtSign,
  Copy,
  ExternalLink,
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
// Picks readable black/white text for any background color, so a light
// custom color (yellow, pink, white, etc.) never swallows the confession text.
function getContrastTextColor(hex) {
  if (!hex) return "#ffffff";
  let c = hex.replace("#", "");
  if (c.length === 3)
    c = c
      .split("")
      .map((ch) => ch + ch)
      .join("");
  if (c.length !== 6) return "#ffffff";
  const r = parseInt(c.substr(0, 2), 16);
  const g = parseInt(c.substr(2, 2), 16);
  const b = parseInt(c.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness >= 150 ? "#111111" : "#ffffff";
}

// Softer secondary text tone that still reads on either a light or dark
// custom color, used for the "Sent by" line and captions inside the card.
function getContrastMutedColor(hex) {
  return getContrastTextColor(hex) === "#111111"
    ? "rgba(17,17,17,0.65)"
    : "rgba(255,255,255,0.75)";
}

// Text shadow that boosts legibility in the direction the text actually
// needs it: a soft light halo behind dark text (light custom colors like
// white/yellow), or a soft dark halo behind light text (dark custom colors).
function getContrastTextShadow(hex) {
  return getContrastTextColor(hex) === "#111111"
    ? "0 1px 3px rgba(255,255,255,0.8), 0 1px 1px rgba(255,255,255,0.6)"
    : "0 2px 10px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.5)";
}

function timeAgo(timestamp) {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// Canvas-based, Instagram-ready confession card renderer.
//
// This replaces the old html2canvas DOM screenshot (which mangled gradients,
// backdrop-blur and rounded corners) with a hand-drawn 2D canvas that
// mirrors the public confession page's dark glass card. It's fully in our
// control: crisp at high resolution, respects the user's custom color with
// proper contrast, wraps and auto-sizes long confessions, and needs no
// visible DOM element to capture.
// ---------------------------------------------------------------------------

const CARD_FONT_STACK =
  '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function wrapTextLines(ctx, text, maxWidth) {
  const paragraphs = (text || "").split(/\n/);
  const lines = [];
  paragraphs.forEach((para) => {
    if (para.trim() === "") {
      lines.push("");
      return;
    }
    const words = para.split(" ");
    let current = "";
    words.forEach((word) => {
      let candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
      // Break up a single word that's wider than the line on its own.
      while (ctx.measureText(current).width > maxWidth && current.length > 1) {
        let i = current.length - 1;
        while (i > 1 && ctx.measureText(current.slice(0, i)).width > maxWidth) {
          i--;
        }
        lines.push(current.slice(0, i));
        current = current.slice(i);
      }
    });
    if (current) lines.push(current);
  });
  return lines;
}

// Shrinks the font until the wrapped message fits the available box,
// down to a readable floor, so a one-line confession and a 1000-char
// confession both render cleanly instead of overflowing or looking tiny.
function fitMessageText(ctx, text, maxWidth, maxHeight) {
  let fontSize = 64;
  const minFontSize = 26;
  let lines = [];
  let lineHeight = 0;
  while (fontSize >= minFontSize) {
    ctx.font = `600 ${fontSize}px ${CARD_FONT_STACK}`;
    lines = wrapTextLines(ctx, text, maxWidth);
    lineHeight = Math.round(fontSize * 1.45);
    if (lines.length * lineHeight <= maxHeight) break;
    fontSize -= 2;
  }
  return { lines, fontSize, lineHeight };
}

function drawGlowBlob(ctx, cx, cy, r, rgba) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, rgba);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Normalizes both the current `images: [{url, deleteUrl}]` array field and
// the older single `imageUrl`/`imageDeleteUrl` fields (from confessions
// submitted before multi-image support) into one shape. Module-level (not
// inside the component) so both the canvas card renderer below and the
// dashboard UI can share the exact same logic.
// ---------------------------------------------------------------------------
function getConfessionImages(confession) {
  if (!confession) return [];
  if (Array.isArray(confession.images)) {
    return confession.images.filter((img) => img && img.url);
  }
  if (confession.imageUrl) {
    return [
      {
        url: confession.imageUrl,
        deleteUrl: confession.imageDeleteUrl || null,
      },
    ];
  }
  return [];
}

async function renderConfessionCard(confession) {
  const SIZE = 1080; // Instagram square
  const SCALE = 2; // export at 2160x2160 for retina sharpness
  const canvas = document.createElement("canvas");
  canvas.width = SIZE * SCALE;
  canvas.height = SIZE * SCALE;
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);

  if (typeof document !== "undefined" && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* fall back to default fonts if this fails */
    }
  }

  // ---- Page background: same black -> gray-900 -> black wash as the site ----
  const bg = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  bg.addColorStop(0, "#000000");
  bg.addColorStop(0.5, "#121214");
  bg.addColorStop(1, "#000000");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SIZE, SIZE);

  drawGlowBlob(ctx, 60, 60, 260, "rgba(140,140,150,0.22)");
  drawGlowBlob(ctx, SIZE - 60, SIZE - 60, 260, "rgba(140,140,150,0.22)");

  // ---- Card geometry setup ----
  const cardX = 76;
  const cardW = SIZE - cardX * 2;
  const radius = 36;

  const customColor = confession?.customColor;
  const textColor = customColor ? getContrastTextColor(customColor) : "#f5f5f5";
  const mutedColor = customColor
    ? getContrastMutedColor(customColor)
    : "rgba(255,255,255,0.55)";

  const hasUsername =
    confession?.instagramUsername && confession?.identityConfirmed;
  const imageCount = getConfessionImages(confession).length;
  const hasImages = imageCount > 0;
  const textPaddingX = 72;
  const maxTextWidth = cardW - textPaddingX * 2;

  // ---- Chrome measurements ----
  const HEADER_H = 88;
  const TEXT_PAD_Y = 16;
  // Base footer fits just the date (52px). Each extra line — "Sent by"
  // and/or "Image(s) attached" — adds 36px so nothing overlaps.
  const FOOTER_EXTRA_LINES = (hasUsername ? 1 : 0) + (hasImages ? 1 : 0);
  const FOOTER_H = 52 + FOOTER_EXTRA_LINES * 36;

  // Minimum card height for a nice proportional / square-ish look
  const MIN_CARD_H = 560;

  // Max text height when card can grow freely
  const MAX_TEXT_H = SIZE - cardX * 2 - HEADER_H - FOOTER_H - TEXT_PAD_Y * 2;
  const MIN_TEXT_H = 40;

  // ---- Single pass: fit text once ----
  const { lines, fontSize, lineHeight } = fitMessageText(
    ctx,
    confession?.message || "",
    maxTextWidth,
    MAX_TEXT_H,
  );

  // Actual text block height
  const textBlockH = Math.max(MIN_TEXT_H, lines.length * lineHeight);

  // ---- Card height: natural wrap, but enforce minimum ----
  const naturalH = HEADER_H + TEXT_PAD_Y + textBlockH + TEXT_PAD_Y + FOOTER_H;
  const cardH = Math.max(MIN_CARD_H, naturalH);

  // ---- Center card vertically in the 1080 canvas ----
  const cardY = (SIZE - cardH) / 2;

  // ---- Card fill ----
  ctx.save();
  roundRectPath(ctx, cardX, cardY, cardW, cardH, radius);
  ctx.clip();
  const cardGrad = ctx.createLinearGradient(
    cardX,
    cardY,
    cardX + cardW,
    cardY + cardH,
  );
  if (customColor) {
    cardGrad.addColorStop(0, `${customColor}e6`);
    cardGrad.addColorStop(1, `${customColor}b3`);
  } else {
    cardGrad.addColorStop(0, "rgba(24,24,27,0.95)");
    cardGrad.addColorStop(0.55, "rgba(5,5,5,0.97)");
    cardGrad.addColorStop(1, "rgba(38,38,42,0.95)");
  }
  ctx.fillStyle = cardGrad;
  ctx.fillRect(cardX, cardY, cardW, cardH);
  ctx.restore();

  // ---- Card border + shadow ----
  ctx.save();
  ctx.shadowColor = customColor ? `${customColor}55` : "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 40;
  roundRectPath(ctx, cardX, cardY, cardW, cardH, radius);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = customColor ? customColor : "rgba(255,255,255,0.14)";
  ctx.stroke();
  ctx.restore();

  // ---- Header label ----
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 22px ${CARD_FONT_STACK}`;
  ctx.fillStyle = mutedColor;
  if ("letterSpacing" in ctx) ctx.letterSpacing = "4px";
  ctx.fillText("ANONYMOUS CONFESSION", SIZE / 2, cardY + 54);
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";

  // Divider line
  ctx.strokeStyle = customColor ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cardX + 56, cardY + HEADER_H);
  ctx.lineTo(cardX + cardW - 56, cardY + HEADER_H);
  ctx.stroke();

  // ---- Message text: centered within the available text area ----
  const textAreaTop = cardY + HEADER_H + TEXT_PAD_Y;
  const textAreaBottom = cardY + cardH - FOOTER_H - TEXT_PAD_Y;
  const textAreaH = textAreaBottom - textAreaTop;

  // Center the text block vertically in the available area
  const textStartY = textAreaTop + (textAreaH - textBlockH) / 2;

  ctx.font = `600 ${fontSize}px ${CARD_FONT_STACK}`;
  ctx.fillStyle = textColor;
  ctx.textBaseline = "top";

  lines.forEach((line, i) => {
    ctx.fillText(line, SIZE / 2, textStartY + i * lineHeight);
  });

  ctx.textBaseline = "alphabetic";

  // ---- Footer ----
  const footerBaseY = cardY + cardH - FOOTER_H;
  let footerLineY = footerBaseY + 32;

  if (hasUsername) {
    ctx.font = `600 26px ${CARD_FONT_STACK}`;
    ctx.fillStyle = mutedColor;
    ctx.fillText(
      `Sent by: @${confession.instagramUsername}`,
      SIZE / 2,
      footerLineY,
    );
    footerLineY += 36;
  }

  if (hasImages) {
    ctx.font = `600 24px ${CARD_FONT_STACK}`;
    ctx.fillStyle = mutedColor;
    ctx.fillText(
      imageCount > 1 ? `📎 ${imageCount} Images Attached` : "📎 Image Attached",
      SIZE / 2,
      footerLineY,
    );
    footerLineY += 36;
  }

  // Post date
  const postDate = confession?.createdAt
    ? (confession.createdAt.toDate
        ? confession.createdAt.toDate()
        : new Date(confession.createdAt)
      ).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";
  ctx.font = `500 19px ${CARD_FONT_STACK}`;
  ctx.fillStyle = mutedColor;
  ctx.fillText(postDate, SIZE / 2, cardY + cardH - 24);

  return canvas;
}

const STATUS_FILTER_OPTIONS = [
  { value: "not-opened", label: "Not Opened" },
  { value: "opened", label: "Opened" },
  { value: "shared", label: "Shared" },
  { value: "reported", label: "Reported" },
];

function matchesStatusFilter(confession, value) {
  if (value === "reported") {
    return !!(confession.reported && confession.reports > 0);
  }
  return confession.status === value;
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
  const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;
  const allowedEmail = import.meta.env.VITE_ADMIN_EMAIL;
  const allowedIp = import.meta.env.VITE_ADMIN_IP;

  const [accessAllowed, setAccessAllowed] = useState(null);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [confessions, setConfessions] = useState([]);
  const [selectedConfession, setSelectedConfession] = useState(null);
  const [activeConfessionUsers, setActiveConfessionUsers] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [statusFilters, setStatusFilters] = useState([]); // [] means "show all"
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const filterDropdownRef = useRef(null);
  // When set, the sidebar narrows down to every confession sent from this
  // same IP address — lets admins see everything a given (anonymous) user
  // has submitted, since IP is the only reliable link between confessions.
  const [userFilterIp, setUserFilterIp] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const deleteTimeoutRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editMessage, setEditMessage] = useState("");
  const [savingImage, setSavingImage] = useState(false);
  const [bannedIps, setBannedIps] = useState([]);
  const [showBannedTab, setShowBannedTab] = useState(false);
  const [isSelectedBanned, setIsSelectedBanned] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [banCustomReason, setBanCustomReason] = useState("");
  const [showBanModal, setShowBanModal] = useState(false);
  const [banLoading, setBanLoading] = useState(false);
  const [unbanLoading, setUnbanLoading] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState(null);

  // Check if selected confession's IP is banned
  useEffect(() => {
    if (!selectedConfession?.ipAddress) {
      setIsSelectedBanned(false);
      return;
    }
    const check = async () => {
      try {
        const docSnap = await getDoc(
          firestoreDoc(db, "bannedIps", selectedConfession.ipAddress),
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
    const unsubscribe = onSnapshot(
      collection(db, "confessionPresence"),
      (snapshot) => {
        const now = Date.now();
        let activeCount = 0;
        const staleIds = [];

        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.page !== "confession") return;
          const lastSeen = data.lastSeen;
          const lastSeenTime = lastSeen?.toDate
            ? lastSeen.toDate().getTime()
            : new Date(lastSeen || 0).getTime();

          if (!Number.isFinite(lastSeenTime)) return;

          const age = now - lastSeenTime;

          // Sessions older than 60s are considered dead — clean them up
          if (age > 60000) {
            staleIds.push(docSnap.id);
            return;
          }

          // 25s threshold = ~3 missed heartbeats at 8s interval,
          // giving plenty of margin for network lag or delayed tabs.
          if (
            age < 25000 &&
            (data.status === "active" || data.status === "typing")
          ) {
            activeCount++;
          }
        });

        setActiveConfessionUsers(activeCount);

        // Async-clean stale sessions so they don't accumulate on
        // browser crashes or mobile kills.
        if (staleIds.length > 0) {
          staleIds.forEach((id) => {
            try {
              void deleteDoc(firestoreDoc(db, "confessionPresence", id));
            } catch {}
          });
        }
      },
    );
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
      prev.filter((c) => c.id !== selectedConfession.id),
    );
    setSelectedConfession(null);
    toast.success("Confession deleted");
  };

  const handleDeleteClick = () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      deleteTimeoutRef.current = setTimeout(
        () => setDeleteConfirm(false),
        3000,
      );
    } else {
      clearTimeout(deleteTimeoutRef.current);
      handleDelete();
      setDeleteConfirm(false);
    }
  };

  // ---------------------------------------------------------------------
  // Instagram-ready confession image, drawn entirely with the Canvas 2D
  // API (no DOM screenshot). This mirrors the dark glassmorphism card
  // from the public confession page instead of the light admin preview,
  // so the exported PNG looks the same as what visitors see on the site.
  // ---------------------------------------------------------------------
  const handleSaveImage = async () => {
    if (!selectedConfession) return;
    setSavingImage(true);
    try {
      const canvas = await renderConfessionCard(selectedConfession);
      const dataUrl = canvas.toDataURL("image/png", 1.0);
      const link = document.createElement("a");
      link.href = dataUrl;

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
      toast.success("Image ready — ready to post!");
    } catch (err) {
      console.error("Image generation failed:", err);
      toast.error("Failed to generate image.");
    } finally {
      setSavingImage(false);
    }
  };

  const handleMarkAsShared = async () => {
    if (!selectedConfession) return;
    await updateDoc(doc(db, "messages", selectedConfession.id), {
      status: "shared",
    });
    setConfessions((prev) =>
      prev.map((c) =>
        c.id === selectedConfession.id ? { ...c, status: "shared" } : c,
      ),
    );
    setSelectedConfession({ ...selectedConfession, status: "shared" });
    toast.success("Marked as shared");
  };

  // ---------------------------------------------------------------------
  // Attached images (the ones the user uploaded with their confession, not
  // the generated share card above). Confessions can carry 0-3 images.
  // getConfessionImages is defined at module scope above (shared with the
  // canvas card renderer).
  // ---------------------------------------------------------------------

  // Downloading pulls the actual bytes so it saves locally instead of just
  // opening a tab; if the host doesn't allow cross-origin fetches we fall
  // back to opening the image directly.
  const handleDownloadImage = async (image, index) => {
    if (!image?.url || !selectedConfession) return;
    try {
      const response = await fetch(image.url, { mode: "cors" });
      if (!response.ok) throw new Error("Bad response");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      const ext = blob.type.split("/")[1]?.split("+")[0] || "jpg";
      link.download = `confession-image-${selectedConfession.id}-${index + 1}.${ext}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Direct image download failed, opening tab instead:", err);
      window.open(image.url, "_blank", "noopener,noreferrer");
      toast("Opened the image in a new tab — right-click it to save.", {
        icon: "🖼️",
      });
    }
  };

  // Moderation action: strips a single image from this confession, live —
  // updates Firestore, the sidebar list, and the open detail panel in the
  // same call so nothing needs a refresh. Also opens ImgBB's one-time
  // delete page (when we have it) so the admin can confirm removal from
  // the host itself, not just from our own dashboard.
  const handleRemoveImage = async (index) => {
    if (!selectedConfession) return;
    const currentImages = getConfessionImages(selectedConfession);
    const target = currentImages[index];
    if (!target) return;

    const nextImages = currentImages.filter((_, i) => i !== index);

    try {
      await updateDoc(doc(db, "messages", selectedConfession.id), {
        images: nextImages,
        // Clear the legacy single-image fields too, since `images` is now
        // the single source of truth going forward.
        imageUrl: deleteField(),
        imageDeleteUrl: deleteField(),
        imageRemoved: nextImages.length === 0 ? true : deleteField(),
      });

      if (target.deleteUrl) {
        window.open(target.deleteUrl, "_blank", "noopener,noreferrer");
      }

      const patch = {
        images: nextImages,
        imageUrl: null,
        imageDeleteUrl: null,
        imageRemoved: nextImages.length === 0,
      };
      setConfessions((prev) =>
        prev.map((c) =>
          c.id === selectedConfession.id ? { ...c, ...patch } : c,
        ),
      );
      setSelectedConfession((prev) => (prev ? { ...prev, ...patch } : prev));

      toast.success(
        nextImages.length === 0
          ? "Image removed."
          : `Image removed — ${nextImages.length} left.`,
      );
    } catch (err) {
      console.error("Failed to remove image:", err);
      toast.error("Failed to remove image.");
    }
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
    .filter((confession) =>
      userFilterIp ? confession.ipAddress === userFilterIp : true,
    )
    .filter(
      (confession) =>
        confession.message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        confession.ipAddress?.includes(searchTerm),
    )
    .filter((confession) => {
      if (statusFilters.length === 0) return true; // no filters = show all
      return statusFilters.some((value) =>
        matchesStatusFilter(confession, value),
      );
    });

  const toggleStatusFilter = (value) => {
    setStatusFilters((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };

  // Jump into "this user's confessions" mode from the detail view.
  const handleFilterByUser = (ip) => {
    if (!ip) return;
    setShowBannedTab(false);
    setSearchTerm("");
    setStatusFilters([]);
    setUserFilterIp(ip);
    setSidebarOpen(true);
  };

  const clearUserFilter = () => setUserFilterIp(null);

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
        },
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
        { merge: true },
      );
      setIsSelectedBanned(false);
      setBannedIps((prev) =>
        prev.filter((b) => b.ip !== selectedConfession.ipAddress),
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
        { merge: true },
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
          })),
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
    <div className="h-screen flex flex-col bg-black text-white overflow-hidden">
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

      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2.5 bg-gray-800/95 backdrop-blur border border-gray-700 text-white rounded-xl shadow-lg focus:outline-none sidebar-toggle-btn"
      >
        {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="md:hidden fixed inset-0 z-30 bg-black/70 backdrop-blur-sm"
        />
      )}

      <div className="flex-1 flex min-h-0">
        {/* Sidebar */}
        <aside
          ref={sidebarRef}
          className={`
          fixed md:static inset-y-0 left-0 md:inset-auto
          w-72 sm:w-80 md:w-80 h-full
          bg-gray-900 border-r border-gray-800 shadow-2xl md:shadow-none
          z-40 transform transition-transform duration-300 ease-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0
          flex-shrink-0 flex flex-col min-h-0
        `}
        >
          <div className="flex-1 min-h-0 flex flex-col p-5 pt-20 md:pt-5">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-white">
                  {userFilterIp ? "User's Confessions" : "Confessions"}
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] sm:text-[11px] font-semibold text-emerald-300 shadow-sm ${
                    activeConfessionUsers > 0 ? "animate-pulse" : ""
                  }`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {activeConfessionUsers} active
                  </span>
                  {!userFilterIp &&
                    confessions.filter((c) => c.status === "not-opened")
                      .length > 0 && (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[10px] sm:text-[11px] font-semibold text-white/90 shadow-sm"
                        title="Not opened yet"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        {
                          confessions.filter((c) => c.status === "not-opened")
                            .length
                        }{" "}
                        new
                      </span>
                    )}
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
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
                    className={`flex items-center gap-1.5 p-2 rounded-lg border focus:outline-none transition ${
                      statusFilters.length > 0
                        ? "bg-white text-black border-white"
                        : "bg-gray-900 border-gray-700 text-gray-300 hover:bg-gray-800"
                    }`}
                    title={
                      statusFilters.length === 0
                        ? "Filter confessions"
                        : `Filtering: ${statusFilters
                            .map(
                              (v) =>
                                STATUS_FILTER_OPTIONS.find((o) => o.value === v)
                                  ?.label,
                            )
                            .join(", ")}`
                    }
                    type="button"
                  >
                    <Filter size={18} />
                    {statusFilters.length > 0 && (
                      <span className="text-xs font-semibold pr-0.5 flex items-center gap-1">
                        {statusFilters.length === 1
                          ? STATUS_FILTER_OPTIONS.find(
                              (o) => o.value === statusFilters[0],
                            )?.label
                          : `${statusFilters.length} filters`}
                      </span>
                    )}
                  </button>
                  {showFilterDropdown && (
                    <div className="absolute right-0 mt-2 z-20 w-64 rounded-xl border border-gray-700 bg-black shadow-2xl p-3">
                      <div className="flex items-center justify-between mb-2 px-1">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                          Show confessions
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setStatusFilters(
                                STATUS_FILTER_OPTIONS.map((o) => o.value),
                              )
                            }
                            className="text-[11px] text-gray-400 hover:text-white transition"
                          >
                            Select all
                          </button>
                          <span className="text-gray-700">|</span>
                          <button
                            type="button"
                            onClick={() => setStatusFilters([])}
                            className="text-[11px] text-gray-400 hover:text-white transition"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        {STATUS_FILTER_OPTIONS.map((option) => {
                          const count = confessions.filter((c) =>
                            matchesStatusFilter(c, option.value),
                          ).length;
                          const checked = statusFilters.includes(option.value);
                          return (
                            <label
                              key={option.value}
                              className={`flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer transition select-none ${
                                checked ? "bg-white/10" : "hover:bg-white/5"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  toggleStatusFilter(option.value)
                                }
                                className="accent-white w-4 h-4 shrink-0"
                              />
                              <span className="flex-1 text-sm text-gray-200">
                                {option.label}
                              </span>
                              <span className="text-[11px] text-gray-500 font-mono">
                                {count}
                              </span>
                            </label>
                          );
                        })}
                      </div>

                      <div className="mt-3 pt-2 border-t border-gray-800 flex items-center justify-between px-1">
                        <span className="text-[11px] text-gray-500">
                          {statusFilters.length === 0
                            ? `Showing all ${confessions.length}`
                            : `${filteredConfessions.length} match${
                                filteredConfessions.length === 1 ? "" : "es"
                              }`}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowFilterDropdown(false)}
                          className="text-[11px] font-semibold text-white bg-gray-800 hover:bg-gray-700 rounded-full px-3 py-1 transition"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Active filter chips — quick visual summary + one-tap removal */}
            {statusFilters.length > 0 && (
              <div className="flex flex-wrap gap-1.5 -mt-3 mb-4">
                {statusFilters.map((value) => {
                  const option = STATUS_FILTER_OPTIONS.find(
                    (o) => o.value === value,
                  );
                  return (
                    <span
                      key={value}
                      className="flex items-center gap-1 text-[11px] font-medium bg-white/10 text-gray-200 border border-white/10 rounded-full pl-2.5 pr-1.5 py-1"
                    >
                      {option?.label}
                      <button
                        type="button"
                        onClick={() => toggleStatusFilter(value)}
                        className="hover:text-white text-gray-400 transition"
                        aria-label={`Remove ${option?.label} filter`}
                      >
                        <X size={11} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Active "this user's confessions" filter — dynamic, one click to clear */}
            {userFilterIp && (
              <div className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-xl border border-blue-400/30 bg-blue-500/10 text-blue-200">
                <Users size={15} className="shrink-0" />
                <div className="flex-1 min-w-0 text-xs leading-snug">
                  <div className="font-semibold text-blue-100">
                    Showing this user's confessions
                  </div>
                  <div className="font-mono text-[11px] text-blue-300/80 truncate">
                    {userFilterIp} · {filteredConfessions.length} found
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearUserFilter}
                  className="shrink-0 p-1.5 rounded-full hover:bg-white/10 text-blue-300 hover:text-white transition"
                  title="Clear filter"
                  aria-label="Clear user filter"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Banned Users Tab */}
            {showBannedTab ? (
              <div
                className="flex-1 min-h-0 overflow-auto space-y-2 pr-1 custom-scrollbar flex flex-col"
                style={{
                  minHeight: "200px",
                  width: "100%",
                  paddingBottom: 16,
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
                                    : ban.bannedAt,
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

                <div
                  className="flex-1 min-h-0 overflow-auto space-y-2 pr-1 custom-scrollbar"
                  style={{ paddingBottom: 16 }}
                >
                  {filteredConfessions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No confessions found
                    </div>
                  ) : (
                    filteredConfessions.map((confession) => {
                      const isSelected =
                        selectedConfession?.id === confession.id;
                      return (
                        <div
                          key={confession.id}
                          onClick={() => handleSelect(confession)}
                          className={`cursor-pointer px-4 py-3 rounded-xl text-sm transition-all flex items-start gap-3 border relative
                ${
                  isSelected
                    ? "bg-white text-black border-white"
                    : confession.status === "not-opened"
                      ? "bg-gray-800 border-white text-white"
                      : confession.status === "shared"
                        ? "bg-green-900 border-green-400 text-green-200"
                        : confession.reported
                          ? "bg-red-950/40 border-red-500/30 text-red-100 hover:bg-red-950/60"
                          : "bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-300"
                }
              `}
                          style={
                            confession.customColor
                              ? {
                                  borderLeft: `4px solid ${confession.customColor}`,
                                }
                              : undefined
                          }
                        >
                          {/* Reported badge — prominent */}
                          {confession.reported && (
                            <span className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-red-500/20 border border-red-500/40 rounded-full px-1.5 py-0.5" title="Reported">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                              <span className={`text-[9px] font-bold tracking-wide ${isSelected ? "text-red-700" : "text-red-300"}`}>
                                {confession.reports || 1}
                              </span>
                            </span>
                          )}
                          <div className="mt-0.5 shrink-0 flex flex-col items-center gap-1.5">
                            {confession.status === "not-opened" ? (
                              <Eye className="w-4 h-4" />
                            ) : confession.status === "shared" ? (
                              <Check className="w-4 h-4 text-green-300" />
                            ) : (
                              <FileText className="w-4 h-4" />
                            )}
                          </div>
                          <div className={`flex-1 min-w-0 overflow-hidden ${confession.reported ? "pr-8" : ""}`}>
                            <div className="font-medium whitespace-pre-wrap break-words break-all max-w-full overflow-hidden line-clamp-2">
                              {confession.message || "Confession"}
                            </div>
                            <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-1.5">
                              <span
                                className="text-xs opacity-80"
                                title={formatTimestamp(confession.createdAt)}
                              >
                                {timeAgo(confession.createdAt)}
                              </span>
                              {confession.instagramUsername &&
                                confession.identityConfirmed && (
                                  <span
                                    className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                                      isSelected
                                        ? "border-black/20 text-black/70"
                                        : "border-white/20 text-gray-300"
                                    }`}
                                  >
                                    @{confession.instagramUsername}
                                  </span>
                                )}
                              {getConfessionImages(confession).length > 0 && (
                                <span
                                  className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border ${
                                    isSelected
                                      ? "border-black/20 text-black/70"
                                      : "border-white/20 text-gray-300"
                                  }`}
                                >
                                  <ImageIcon className="w-3 h-3" />
                                  {getConfessionImages(confession).length > 1
                                    ? `${getConfessionImages(confession).length} Images`
                                    : "Image"}
                                </span>
                              )}
                              {confession.status === "not-opened" && (
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                    isSelected
                                      ? "bg-black/10 text-black"
                                      : "bg-white/10 text-white"
                                  }`}
                                >
                                  NEW
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main
          className="flex-1 min-w-0 h-full overflow-y-auto relative custom-scrollbar"
          style={{
            background: selectedConfession?.customColor
              ? `radial-gradient(circle at 25% 15%, ${selectedConfession.customColor}2e 0%, transparent 55%), linear-gradient(135deg, #050505 0%, #111827 45%, #0f172a 100%)`
              : "linear-gradient(135deg, #050505 0%, #111827 45%, #0f172a 100%)",
            transition: "background 0.7s",
          }}
        >
          {selectedConfession ? (
            <div className="relative w-full min-h-full flex flex-col items-center justify-center px-4 sm:px-6 py-10">
              <div className="relative w-full max-w-2xl flex flex-col gap-4">
                <button
                  type="button"
                  onClick={() => setSelectedConfession(null)}
                  className="absolute right-0 top-0 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white shadow-lg backdrop-blur transition hover:bg-white/10"
                  aria-label="Close confession"
                  title="Close confession"
                >
                  <X size={18} />
                </button>

                {/* Status / meta pills */}
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${
                      selectedConfession.status === "not-opened"
                        ? "bg-white/10 border-white/30 text-white"
                        : selectedConfession.status === "shared"
                          ? "bg-green-500/10 border-green-400/40 text-green-300"
                          : "bg-white/5 border-white/15 text-gray-300"
                    }`}
                  >
                    {selectedConfession.status === "not-opened" ? (
                      <Eye size={13} />
                    ) : selectedConfession.status === "shared" ? (
                      <Check size={13} />
                    ) : (
                      <FileText size={13} />
                    )}
                    {selectedConfession.status === "not-opened"
                      ? "New"
                      : selectedConfession.status === "shared"
                        ? "Shared"
                        : "Reviewed"}
                  </span>

                  {selectedConfession.reported && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border bg-red-500/10 border-red-400/40 text-red-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                      Reported · {selectedConfession.reports || 1}
                    </span>
                  )}

                  {isSelectedBanned && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border bg-red-950/60 border-red-500/50 text-red-300">
                      <ShieldX size={13} />
                      IP Banned
                    </span>
                  )}

                  {selectedConfession.customColor && (
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-white/15 text-gray-300"
                      title={`Custom color: ${selectedConfession.customColor}`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-white/30"
                        style={{ background: selectedConfession.customColor }}
                      />
                      Custom color
                    </span>
                  )}

                  <span className="ml-auto text-xs text-gray-500">
                    {timeAgo(selectedConfession.createdAt)}
                  </span>
                </div>

                {/* Report Details Panel */}
                {selectedConfession.reported && (
                  <div className="w-full max-w-md mx-auto">
                    <details
                      className="bg-gradient-to-br from-red-950/80 to-red-900/50 border border-red-500/40 rounded-2xl overflow-hidden shadow-lg backdrop-blur group"
                      open={false}
                    >
                      <summary className="flex items-center gap-2 px-4 py-3.5 cursor-pointer select-none outline-none hover:bg-white/5 transition">
                        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-red-500/20">
                          <Flag size={13} className="text-red-400" />
                        </span>
                        <span className="font-bold text-red-200 text-sm tracking-wide">
                          Report Details
                        </span>
                        <span className="ml-auto text-xs font-medium text-red-300 bg-red-500/10 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                          {selectedConfession.reports || 1} report
                          {selectedConfession.reports > 1 ? "s" : ""}
                        </span>
                        <span className="ml-1 text-red-300/70 group-open:rotate-90 transition-transform">
                          &#9654;
                        </span>
                      </summary>
                      <div className="px-4 pb-4 pt-2 text-sm text-red-100 border-t border-red-500/20 space-y-3">
                        {/* Report details from reportDetails array (new format) */}
                        {selectedConfession.reportDetails &&
                        selectedConfession.reportDetails.length > 0 ? (
                          <div className="space-y-2">
                            <span className="text-[11px] font-bold uppercase tracking-wide text-red-300/80 block">
                              Reports
                            </span>
                            {selectedConfession.reportDetails.map((detail, idx) => (
                              <div
                                key={idx}
                                className="rounded-lg border border-red-500/20 bg-red-950/40 p-3 space-y-1"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className="text-xs font-semibold text-red-200 flex-1 break-words">
                                    {detail.reason}
                                  </span>
                                  <span className="text-[10px] text-red-400/60 font-mono shrink-0 mt-0.5">
                                    #{idx + 1}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 text-[11px] text-red-300/70">
                                  <AtSign size={10} />
                                  <a
                                    href={`https://instagram.com/${detail.instagram}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline hover:text-red-200 transition truncate"
                                  >
                                    {detail.instagram || "unknown"}
                                  </a>
                                </div>
                                {detail.reportedAt && (
                                  <div className="text-[10px] text-red-400/40 font-mono">
                                    {new Date(detail.reportedAt).toLocaleString()}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {/* Legacy reportReasons fallback */}
                        {selectedConfession.reportReasons &&
                        selectedConfession.reportReasons.length > 0 ? (
                          <div>
                            <span className="text-[11px] font-bold uppercase tracking-wide text-red-300/80 block mb-1.5">
                              {selectedConfession.reportDetails?.length
                                ? "Legacy reasons"
                                : "Reasons"}
                            </span>
                            <ul className="space-y-1">
                              {selectedConfession.reportReasons.map(
                                (reason, idx) => (
                                  <li
                                    key={idx}
                                    className="flex items-start gap-2 text-xs text-red-200/80"
                                  >
                                    <span className="text-red-400/60 mt-0.5">&#8226;</span>
                                    <span className="break-words">{reason}</span>
                                  </li>
                                ),
                              )}
                            </ul>
                          </div>
                        ) : null}

                        {/* Copyable response templates — grouped by reporter */}
                        {selectedConfession.reportDetails?.length > 0 && (
                          <div className="pt-2 border-t border-red-500/10 space-y-2">
                            <span className="text-[11px] font-bold uppercase tracking-wide text-red-300/80 block">
                              Quick Responses
                            </span>
                            {(() => {
                              const seen = {};
                              const uniq = selectedConfession.reportDetails.filter((d) => {
                                const key = d.instagram || "unknown";
                                if (seen[key]) { seen[key].reasons.push(d.reason); return false; }
                                seen[key] = { reasons: [d.reason] };
                                return true;
                              }).map((d) => ({ ...d, reasons: seen[d.instagram || "unknown"].reasons }));
                              return uniq.map((detail, idx) => (
                                <div key={idx} className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-1.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-[11px] font-semibold text-red-200 flex items-center gap-1">
                                      <AtSign size={10} />
                                      <a
                                        href={`https://instagram.com/${detail.instagram}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="underline hover:text-red-100 transition"
                                      >
                                        {detail.instagram}
                                      </a>
                                    </span>
                                    <span className="text-[10px] text-red-400/50 font-mono">
                                      {detail.reasons.length} report{detail.reasons.length > 1 ? "s" : ""}
                                    </span>
                                  </div>
                                  {detail.reasons.length > 0 && (
                                    <div className="text-[10px] text-red-300/60 space-y-0.5">
                                      {detail.reasons.map((r, ri) => (
                                        <div key={ri} className="flex items-start gap-1">
                                          <span className="text-red-400/40 mt-0.5">&#8226;</span>
                                          <span>{r}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <div className="flex gap-1.5 pt-0.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const reasons = detail.reasons.join(", ");
                                        const msg = `Hi @${detail.instagram},\n\nWe got your report${detail.reasons.length > 1 ? "s" : ""} (Reason${detail.reasons.length > 1 ? "s" : ""}: ${reasons}). Can you confirm if this report was actually sent by you? Reply if you have more context.`;
                                        navigator.clipboard.writeText(msg);
                                        setCopiedTemplate(`confirm-${idx}`);
                                        setTimeout(() => setCopiedTemplate(null), 2000);
                                      }}
                                      className="flex-1 flex items-center justify-center gap-1 text-[10px] font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded-lg py-1.5 hover:bg-emerald-500/20 transition"
                                    >
                                      <Check size={10} />
                                      {copiedTemplate === `confirm-${idx}` ? "Copied!" : "Confirm"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const reasons = detail.reasons.join(", ");
                                        const msg = `Hi @${detail.instagram},\n\nWe've reviewed your report${detail.reasons.length > 1 ? "s" : ""} (Reason${detail.reasons.length > 1 ? "s" : ""}: ${reasons}). The confession does not violate our guidelines, so your report${detail.reasons.length > 1 ? "s have" : " has"} been rejected.\n\n⚠️ Filing false reports violates our terms and may lead to a ban. Please only flag content that genuinely breaks the rules.`;
                                        navigator.clipboard.writeText(msg);
                                        setCopiedTemplate(`reject-${idx}`);
                                        setTimeout(() => setCopiedTemplate(null), 2000);
                                      }}
                                      className="flex-1 flex items-center justify-center gap-1 text-[10px] font-mono bg-red-500/10 border border-red-500/30 text-red-300 rounded-lg py-1.5 hover:bg-red-500/20 transition"
                                    >
                                      <ShieldX size={10} />
                                      {copiedTemplate === `reject-${idx}` ? "Copied!" : "Reject"}
                                    </button>
                                  </div>
                                </div>
                              ));
                            })()}
                          </div>
                        )}

                        <div className="pt-2 border-t border-red-500/10">
                          <button
                            onClick={async () => {
                              await updateDoc(
                                doc(db, "messages", selectedConfession.id),
                                {
                                  reported: false,
                                  reports: 0,
                                  reportReasons: [],
                                  reportDetails: [],
                                },
                              );
                              setConfessions((prev) =>
                                prev.map((c) =>
                                  c.id === selectedConfession.id
                                    ? {
                                        ...c,
                                        reported: false,
                                        reports: 0,
                                        reportReasons: [],
                                        reportDetails: [],
                                      }
                                    : c,
                                ),
                              );
                              setSelectedConfession({
                                ...selectedConfession,
                                reported: false,
                                reports: 0,
                                reportReasons: [],
                                reportDetails: [],
                              });
                              toast.success("Report info cleared");
                            }}
                            className="w-full bg-gradient-to-br from-red-700 to-red-900 hover:from-red-600 hover:to-red-800 text-white px-4 py-2 rounded-lg text-sm font-semibold transition shadow-md shadow-red-950/50 flex items-center justify-center gap-2"
                          >
                            <Check size={14} />
                            Mark as Reviewed
                          </button>
                        </div>
                      </div>
                    </details>
                  </div>
                )}
                {/* Confession Card */}
                <div
                  className="relative w-full confession-glass"
                  style={{
                    border: "1.5px solid",
                    borderColor: selectedConfession?.customColor
                      ? selectedConfession.customColor
                      : "rgba(148,163,184,0.25)",
                    background: selectedConfession?.customColor
                      ? `linear-gradient(120deg, ${selectedConfession.customColor}cc 0%, ${selectedConfession.customColor}99 100%)`
                      : "linear-gradient(160deg, #1e293b 0%, #0b1120 100%)",
                    color: selectedConfession?.customColor
                      ? getContrastTextColor(selectedConfession.customColor)
                      : "#f1f5f9",
                    boxShadow: selectedConfession?.customColor
                      ? `0 20px 50px -12px ${selectedConfession.customColor}55`
                      : "0 20px 50px -12px rgba(0,0,0,0.7), 0 0 40px -18px rgba(59,130,246,0.35)",
                    backdropFilter: "blur(12px)",
                    transition: "box-shadow 0.3s, border 0.3s, background 0.3s",
                    overflow: "hidden",
                    borderRadius: "1.25rem",
                    minWidth: "320px",
                    minHeight: "220px",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {/* Header */}
                  <div
                    className="py-5 px-6 font-extrabold text-center text-lg border-b flex items-center justify-center gap-2"
                    style={{
                      borderColor: "transparent",
                      color: selectedConfession?.customColor
                        ? getContrastTextColor(selectedConfession.customColor)
                        : "#f1f5f9",
                      fontFamily: "Montserrat, Arial, sans-serif",
                      letterSpacing: "0.12em",
                      background: selectedConfession?.customColor
                        ? `linear-gradient(90deg, ${selectedConfession.customColor} 0%, ${selectedConfession.customColor}bb 100%)`
                        : "rgba(255,255,255,0.05)",
                      textShadow: selectedConfession?.customColor
                        ? getContrastTextShadow(selectedConfession.customColor)
                        : "none",
                      borderTopLeftRadius: "1.25rem",
                      borderTopRightRadius: "1.25rem",
                      boxShadow: selectedConfession?.customColor
                        ? `0 2px 16px ${selectedConfession.customColor}33`
                        : "0 2px 16px #1112",
                    }}
                  >
                    <MessageSquare size={16} className="opacity-70" />
                    ANONYMOUS CONFESSION
                  </div>
                  {/* Message */}
                  <div
                    className="relative px-6 sm:px-10 py-10 text-center font-semibold whitespace-pre-wrap break-words flex-1"
                    style={{
                      color: selectedConfession?.customColor
                        ? getContrastTextColor(selectedConfession.customColor)
                        : "#f1f5f9",
                      fontSize: "1.15rem",
                      textShadow: selectedConfession?.customColor
                        ? getContrastTextShadow(selectedConfession.customColor)
                        : "none",
                      background: "transparent",
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
                                },
                              );
                              setConfessions((prev) =>
                                prev.map((c) =>
                                  c.id === selectedConfession.id
                                    ? { ...c, message: editMessage }
                                    : c,
                                ),
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
                          <TruncatedConfession
                            text={selectedConfession.message}
                            maxLength={200}
                          />
                        </p>
                        {/* Username Info */}
                        {selectedConfession.instagramUsername &&
                          selectedConfession.identityConfirmed && (
                            <div
                              className="mt-6 text-base text-center font-semibold"
                              style={{
                                fontWeight: 500,
                                letterSpacing: "0.02em",
                                color: selectedConfession?.customColor
                                  ? getContrastMutedColor(
                                      selectedConfession.customColor,
                                    )
                                  : "#94a3b8",
                                opacity: 0.9,
                                textShadow: selectedConfession?.customColor
                                  ? getContrastTextShadow(
                                      selectedConfession.customColor,
                                    )
                                  : "none",
                                transition: "color 0.3s",
                              }}
                            >
                              Sent by:{" "}
                              {isEditing ? (
                                `@${selectedConfession.instagramUsername}`
                              ) : (
                                <a
                                  href={`https://instagram.com/${selectedConfession.instagramUsername}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline hover:opacity-80 transition"
                                  style={{
                                    color: selectedConfession?.customColor
                                      ? getContrastMutedColor(
                                          selectedConfession.customColor,
                                        )
                                      : "#94a3b8",
                                    textShadow: selectedConfession?.customColor
                                      ? getContrastTextShadow(
                                          selectedConfession.customColor,
                                        )
                                      : "none",
                                  }}
                                >
                                  @{selectedConfession.instagramUsername}
                                </a>
                              )}
                            </div>
                          )}
                        {/* Image-attached indicator — stays in sync with
                            the live image count, so it disappears the
                            moment the last image is removed below. */}
                        {getConfessionImages(selectedConfession).length > 0 && (
                          <div
                            className="mt-4 flex items-center justify-center gap-1.5 text-sm font-semibold"
                            style={{
                              color: selectedConfession?.customColor
                                ? getContrastMutedColor(
                                    selectedConfession.customColor,
                                  )
                                : "#94a3b8",
                              textShadow: selectedConfession?.customColor
                                ? getContrastTextShadow(
                                    selectedConfession.customColor,
                                  )
                                : "none",
                            }}
                          >
                            <ImageIcon size={15} className="opacity-80" />
                            {getConfessionImages(selectedConfession).length > 1
                              ? `${getConfessionImages(selectedConfession).length} images attached`
                              : "Image attached"}
                          </div>
                        )}
                      </>
                    )}

                    {/* Edit button: only show when not editing */}
                    {!isEditing && (
                      <button
                        className="absolute top-3 right-3 p-2.5 rounded-full bg-white/90 hover:bg-blue-100 hover:scale-105 border border-gray-300 shadow-lg focus:outline-none transition-all z-10"
                        style={{ boxShadow: "0 2px 12px 0 #0008" }}
                        onClick={() => {
                          setIsEditing(true);
                          setEditMessage(selectedConfession.message);
                        }}
                        title="Edit confession"
                        aria-label="Edit confession"
                      >
                        <Pencil className="w-4 h-4 text-blue-700" />
                      </button>
                    )}
                  </div>
                  {/* Timestamp */}
                  <div
                    className="py-3.5 px-8 text-xs font-semibold text-center border-t uppercase tracking-wider"
                    style={{
                      fontWeight: 500,
                      letterSpacing: "0.08em",
                      borderBottomLeftRadius: "1.25rem",
                      borderBottomRightRadius: "1.25rem",
                      borderColor: selectedConfession?.customColor
                        ? `${selectedConfession.customColor}40`
                        : "rgba(255,255,255,0.08)",
                      background: selectedConfession?.customColor
                        ? `${selectedConfession.customColor}cc`
                        : "rgba(255,255,255,0.04)",
                      color: selectedConfession?.customColor
                        ? getContrastTextColor(selectedConfession.customColor)
                        : "#94a3b8",
                      fontFamily: "Inter, Arial, sans-serif",
                      textShadow: selectedConfession?.customColor
                        ? getContrastTextShadow(selectedConfession.customColor)
                        : "none",
                    }}
                  >
                    {formatTimestamp(selectedConfession.createdAt)}
                  </div>
                </div>
                {/* IP / Device Info */}
                {(selectedConfession.ipAddress ||
                  selectedConfession.deviceInfo) && (
                  <details className="w-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur group open:bg-white/[0.07] transition-colors">
                    <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none outline-none text-xs font-semibold text-gray-300 hover:text-white transition">
                      <Info size={14} className="opacity-70" />
                      Submission metadata
                      <ChevronDown
                        size={14}
                        className="ml-auto opacity-60 group-open:rotate-180 transition-transform"
                      />
                    </summary>
                    <div className="px-4 pb-4 pt-1 flex flex-col sm:flex-row sm:flex-wrap gap-3 text-xs text-gray-300 border-t border-white/10">
                      {/* IP Address */}
                      {selectedConfession.ipAddress && (
                        <div
                          title="Click to copy IP"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              selectedConfession.ipAddress,
                            );
                            toast.success("IP address copied!");
                          }}
                          className="cursor-pointer hover:text-blue-400 transition flex items-center gap-1.5 bg-black/30 rounded-lg px-2.5 py-1.5"
                        >
                          <Globe className="w-3.5 h-3.5" />
                          <span className="truncate">
                            {selectedConfession.ipAddress}
                          </span>
                        </div>
                      )}

                      {/* Jump to all confessions from this same IP */}
                      {selectedConfession.ipAddress && (
                        <button
                          type="button"
                          onClick={() =>
                            handleFilterByUser(selectedConfession.ipAddress)
                          }
                          disabled={
                            userFilterIp === selectedConfession.ipAddress
                          }
                          className="flex items-center gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 disabled:bg-white/5 disabled:cursor-default disabled:text-gray-500 text-blue-300 rounded-lg px-2.5 py-1.5 transition"
                          title="Show every confession sent from this IP address"
                        >
                          <Users className="w-3.5 h-3.5" />
                          {userFilterIp === selectedConfession.ipAddress
                            ? "Viewing this user's confessions"
                            : "View all from this user"}
                        </button>
                      )}

                      {/* Device Info */}
                      {selectedConfession.deviceInfo && (
                        <div className="flex flex-wrap gap-2 text-gray-400">
                          {selectedConfession.deviceInfo
                            .split(" | ")
                            .map((part, idx) => {
                              const [label, ...rest] = part.split(":");
                              const value = rest.join(":").trim();
                              if (!label || !value) return null;

                              let icon = <Info className="w-3.5 h-3.5" />;
                              if (label.includes("OS"))
                                icon = <Monitor className="w-3.5 h-3.5" />;
                              else if (label.includes("Browser"))
                                icon = <Globe className="w-3.5 h-3.5" />;
                              else if (label.includes("Device Type"))
                                icon = <Smartphone className="w-3.5 h-3.5" />;

                              return (
                                <div
                                  key={idx}
                                  className="flex items-center gap-1.5 bg-black/30 rounded-lg px-2.5 py-1.5"
                                >
                                  {icon}
                                  <span className="font-semibold text-gray-300">
                                    {label.trim()}:
                                  </span>
                                  <span className="truncate">{value}</span>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </details>
                )}

                {/* Attached Images (the ones the user uploaded) — a live
                    gallery, so removing one immediately re-renders with the
                    rest and the count everywhere else (list badge, "Sent
                    by" area) updates along with it. */}
                {getConfessionImages(selectedConfession).length > 0 && (
                  <div className="w-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4 flex flex-col items-center gap-3">
                    <div className="w-full flex items-center gap-2 text-xs font-semibold text-gray-300">
                      <ImageIcon size={14} className="opacity-70" />
                      {getConfessionImages(selectedConfession).length > 1
                        ? `${getConfessionImages(selectedConfession).length} Attached Images — review before sharing`
                        : "Attached Image — review before sharing"}
                    </div>

                    <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {getConfessionImages(selectedConfession).map(
                        (image, index) => (
                          <div
                            key={image.url}
                            className="flex flex-col items-center gap-2"
                          >
                            <img
                              src={image.url}
                              alt={`Attachment ${index + 1}`}
                              className="max-h-56 w-full rounded-xl border border-white/10 object-contain bg-black/30"
                            />
                            <div className="w-full flex flex-col gap-2">
                              <button
                                onClick={() =>
                                  handleDownloadImage(image, index)
                                }
                                className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-full border border-gray-300 bg-white text-black hover:bg-gray-100 text-xs font-medium transition-all"
                              >
                                <Download size={14} />
                                Download
                              </button>
                              <button
                                onClick={() => handleRemoveImage(index)}
                                className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-full border border-red-700 bg-red-900 hover:bg-red-800 text-white text-xs font-medium transition-all"
                              >
                                <ImageOff size={14} />
                                Remove
                              </button>
                            </div>
                          </div>
                        ),
                      )}
                    </div>

                    <p className="text-[11px] text-gray-300 text-center leading-relaxed">
                      Check each image for nudity, gore, or illegal content
                      before marking this confession as shared. "Remove"
                      instantly deletes that image from this dashboard and the
                      public link, and opens the host's delete page (when
                      available) so you can wipe it permanently.
                    </p>
                  </div>
                )}

                {/* Action buttons */}
                <div className="w-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-4">
                  <div className="w-full flex flex-wrap justify-center gap-3">
                    <button
                      onClick={handleSaveImage}
                      disabled={savingImage}
                      className="flex items-center justify-center gap-2 px-4 py-2 rounded-full border border-gray-300 bg-white text-black hover:bg-gray-100 font-medium transition-all w-full sm:w-auto min-w-[140px] disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <Download size={18} />
                      {savingImage ? "Generating..." : "Save as Image"}
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
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[70vh] w-full max-w-md flex flex-col items-center justify-center px-6 text-center mx-auto">
              <div className="relative mb-8">
                <div className="absolute inset-0 rounded-full bg-blue-500/10 blur-3xl scale-150" />
                <div className="relative bg-gradient-to-br from-slate-800 to-slate-950 border border-slate-600/40 rounded-3xl p-10 flex items-center justify-center shadow-2xl">
                  <MessageSquare size={52} className="text-slate-400" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">
                No Confession Selected
              </h3>
              <p className="text-slate-300">
                Pick a confession from the list on the left to view its full
                details, manage its status, or take action.
              </p>

              {confessions.length > 0 && (
                <div className="grid grid-cols-2 gap-3 mt-8 w-full">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <div className="text-2xl font-bold text-white">
                      {confessions.length}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">Total</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <div className="text-2xl font-bold text-white">
                      {
                        confessions.filter((c) => c.status === "not-opened")
                          .length
                      }
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Unopened
                    </div>
                  </div>
                  <div className="rounded-2xl border border-green-400/20 bg-green-500/5 px-4 py-3">
                    <div className="text-2xl font-bold text-green-300">
                      {confessions.filter((c) => c.status === "shared").length}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">Shared</div>
                  </div>
                  <div className="rounded-2xl border border-red-400/20 bg-red-500/5 px-4 py-3">
                    <div className="text-2xl font-bold text-red-300">
                      {
                        confessions.filter((c) => c.reported && c.reports > 0)
                          .length
                      }
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Reported
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Stats Bar */}
      <div className="shrink-0 z-30 border-t border-white/10 bg-gradient-to-r from-black via-black-900 to-black px-3 py-2 sm:px-4">
        <div className="grid grid-cols-2 gap-2 text-center text-[11px] text-gray-300 sm:flex sm:flex-wrap sm:justify-center sm:gap-4 sm:text-sm">
          <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 sm:min-w-[120px] sm:flex-1">
            <div className="font-semibold text-white">{confessions.length}</div>
            <div className="mt-0.5 text-[10px] text-gray-400 sm:text-xs">
              Confessions
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 sm:min-w-[120px] sm:flex-1">
            <div className="font-semibold text-white">
              {confessions.filter((c) => c.status === "not-opened").length}
            </div>
            <div className="mt-0.5 text-[10px] text-gray-400 sm:text-xs">
              Not Opened
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-2 sm:min-w-[120px] sm:flex-1">
            <div className="font-semibold text-white">
              {confessions.filter((c) => c.status === "shared").length}
            </div>
            <div className="mt-0.5 text-[10px] text-gray-400 sm:text-xs">
              Shared
            </div>
          </div>
          <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-2 py-2 sm:min-w-[120px] sm:flex-1">
            <div className="font-semibold text-emerald-300">
              {activeConfessionUsers}
            </div>
            <div className="mt-0.5 text-[10px] text-emerald-200/80 sm:text-xs">
              Active Now
            </div>
          </div>
          <div className="rounded-lg border border-red-400/20 bg-red-500/10 px-2 py-2 sm:min-w-[120px] sm:flex-1">
            <div className="font-semibold text-red-300">
              {confessions.filter((c) => c.reported && c.reports > 0).length}
            </div>
            <div className="mt-0.5 text-[10px] text-red-200/80 sm:text-xs">
              Reported
            </div>
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
