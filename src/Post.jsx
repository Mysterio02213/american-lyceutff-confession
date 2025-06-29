import React, { useState, useEffect, useRef } from "react";
import { auth, db } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  getDocs,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import schoolLogo from "/android-chrome-192x192.png";
import { FaArrowLeft } from "react-icons/fa";

const Post = () => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [users, setUsers] = useState([]);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const textareaRef = useRef();
  const navigate = useNavigate();

  // Auth check and fetch user profile
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        navigate("/login");
      } else {
        setUser(u);
        const userDoc = await getDoc(doc(db, "users", u.uid));
        setUserProfile(userDoc.data());
      }
    });
    return () => unsub();
  }, [navigate]);

  // Fetch users for mention
  useEffect(() => {
    const fetchUsers = async () => {
      const snap = await getDocs(collection(db, "users"));
      setUsers(
        snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
      );
    };
    fetchUsers();
  }, []);

  // Mention suggestion logic
  useEffect(() => {
    const match = content.match(/@([a-zA-Z0-9._-]*)$/);
    if (match && match[1].length > 0) {
      const search = match[1].toLowerCase();
      setMentionSuggestions(
        users
          .filter(
            (u) =>
              u.username &&
              u.username.toLowerCase().startsWith(search) &&
              userProfile &&
              u.username !== userProfile.username
          )
          .slice(0, 5)
      );
    } else {
      setMentionSuggestions([]);
    }
  }, [content, users, userProfile]);

  // Handle mention click (insert at cursor position)
  const handleMentionClick = (username) => {
    const textarea = textareaRef.current;
    const value = content;
    const selectionStart = textarea.selectionStart;
    // Find the last @... before the cursor
    const before = value.slice(0, selectionStart);
    const after = value.slice(selectionStart);
    const match = before.match(/@([a-zA-Z0-9._-]*)$/);
    if (match) {
      const startIdx = before.lastIndexOf("@" + match[1]);
      const newBefore = before.slice(0, startIdx) + `@${username} `;
      const newValue = newBefore + after;
      setContent(newValue);
      setMentionSuggestions([]);
      setTimeout(() => {
        textarea.focus();
        // Move cursor to after inserted mention
        textarea.selectionStart = textarea.selectionEnd = newBefore.length;
      }, 0);
    } else {
      setContent(value + `@${username} `);
      setMentionSuggestions([]);
      setTimeout(() => textarea.focus(), 0);
    }
  };

  // Handle post submit (written only, limitless text)
  const handlePost = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!content.trim()) {
      setError("Post content cannot be empty.");
      return;
    }
    if (!user || !userProfile) {
      setError("User not loaded.");
      return;
    }

    setPosting(true);
    try {
      await addDoc(collection(db, "posts"), {
        content: content.trim(),
        authorId: user.uid,
        authorName: userProfile.fullName,
        authorUsername: userProfile.username,
        classStatus: userProfile.classStatus || "",
        branch: userProfile.branch || "",
        createdAt: serverTimestamp(),
        images: [], // always empty, for compatibility
      });
      setSuccess(true);
      setContent("");
      setTimeout(() => {
        navigate("/home");
      }, 1200);
    } catch (err) {
      setError("Failed to post. Please try again.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-black via-gray-900 to-black text-white flex flex-col items-center justify-center px-2">
      <div className="relative w-full max-w-xl mx-auto mt-8 mb-10">
        {/* Back to Home Button - top left, always visible, adaptive */}
        <button
          onClick={() => navigate("/home")}
          className="fixed top-4 left-4 sm:top-6 sm:left-6 flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 rounded-lg bg-black/70 border border-white/10 text-white hover:bg-gray-900 transition shadow z-50"
          style={{ minWidth: 0 }}
        >
          <FaArrowLeft className="text-lg" />
          <span className="font-semibold text-xs sm:text-sm">Back to Home</span>
        </button>
        <div className="flex justify-center mb-4">
          <img
            src={schoolLogo}
            alt="American Lycetuff Logo"
            className="h-20 w-auto sm:h-24 object-contain"
            style={{ maxWidth: "120px" }}
          />
        </div>
        <div className="relative z-10 rounded-2xl sm:rounded-3xl shadow-2xl border border-white/10 bg-gradient-to-br from-gray-900/90 via-black/95 to-gray-800/90 backdrop-blur-2xl overflow-hidden">
          <header className="w-full text-center py-7 px-3 sm:py-8 sm:px-6 bg-gradient-to-br from-black/90 via-gray-900/90 to-gray-800/90 border-b border-white/10">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent drop-shadow-lg mb-2">
              Create a Post
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto text-base sm:text-lg">
              Share something fun, a confession, or a thought with your
              classmates!
              <br />
              <span className="text-xs text-gray-500">
                You can <b>@mention</b> others.
              </span>
            </p>
          </header>
          <form onSubmit={handlePost} className="p-4 sm:p-8 space-y-6">
            <div className="relative">
              <textarea
                ref={textareaRef}
                className="w-full min-h-[120px] rounded-lg p-3 bg-black border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-gray-400 resize-y"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What's on your mind? Use @ to mention!"
                required
                rows={6}
                style={{ minHeight: 120 }}
              />
              <div className="flex justify-end items-center mt-1">
                <div className="text-xs text-gray-400">
                  {content.length} characters
                </div>
              </div>
              {/* Mention Suggestions */}
              {mentionSuggestions.length > 0 && (
                <div className="absolute z-30 left-0 mt-2 bg-black border border-white/10 rounded-lg shadow-lg w-full max-h-40 overflow-y-auto">
                  {mentionSuggestions.map((u) => (
                    <div
                      key={u.id}
                      className="px-3 py-2 cursor-pointer hover:bg-gray-800 text-white"
                      onMouseDown={() => handleMentionClick(u.username)}
                    >
                      @{u.username}{" "}
                      <span className="text-xs text-gray-400">
                        {u.fullName}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {error && (
              <div className="p-3 rounded-lg bg-gradient-to-r from-black via-gray-900 to-black border border-red-400/30 text-red-200 font-semibold text-sm transition-opacity duration-500">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 rounded-lg bg-gradient-to-r from-black via-gray-900 to-black border border-green-400/30 text-green-200 font-semibold text-sm transition-opacity duration-500">
                Posted! Redirecting...
              </div>
            )}
            <button
              type="submit"
              disabled={posting}
              className="w-full py-3 rounded-xl font-bold tracking-wide transition-all duration-300 flex items-center justify-center gap-2 shadow-lg border border-white/10 bg-gradient-to-br from-black via-gray-900 to-black text-white hover:scale-105 hover:shadow-2xl hover:border-white/30 active:scale-95 disabled:opacity-60"
            >
              {posting ? "Posting..." : "Post"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Post;
