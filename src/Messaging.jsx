import React, { useEffect, useState, useRef } from "react";
import { db, auth } from "./firebase";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  FaUserCircle,
  FaArrowLeft,
  FaPaperPlane,
  FaSmile,
  FaTrash,
  FaSearch,
  FaPaperclip,
  FaCheck,
  FaCheckDouble,
} from "react-icons/fa";
import { useLocation, useNavigate } from "react-router-dom";

const emojiList = ["😀", "😂", "😍", "😎", "😢", "👍", "🔥", "🎉"];

const Messaging = () => {
  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [userProfiles, setUserProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [typingStatus, setTypingStatus] = useState({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [reactingTo, setReactingTo] = useState(null);
  const [messageStatus, setMessageStatus] = useState({});
  const [search, setSearch] = useState("");
  const currentUser = auth.currentUser;
  const location = useLocation();
  const navigate = useNavigate();
  const typingTimeout = useRef(null);
  const messagesEndRef = useRef(null);

  // Scroll to bottom on new message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const profiles = {};
      snap.docs.forEach((doc) => {
        profiles[doc.id] = doc.data();
      });
      setUserProfiles(profiles);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    const q = query(
      collection(db, "conversations"),
      where("members", "array-contains", currentUser.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      setConversations(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [currentUser]);

  useEffect(() => {
    if (location.state?.conversationId) {
      const conv = conversations.find(
        (c) => c.id === location.state.conversationId
      );
      if (conv) setActiveChat(conv);
    } else if (location.state?.userId) {
      const conv = conversations.find((c) =>
        c.members.includes(location.state.userId)
      );
      if (conv) setActiveChat(conv);
    }
  }, [location.state, conversations]);

  useEffect(() => {
    if (!activeChat) return;

    const q = query(
      collection(db, `conversations/${activeChat.id}/messages`),
      orderBy("createdAt", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    const chatRef = doc(db, "conversations", activeChat.id);

    const unsubTyping = onSnapshot(chatRef, (snap) => {
      setTypingStatus(snap.data()?.typingStatus || {});
      setMessageStatus(snap.data()?.messageStatus || {});
    });

    return () => {
      unsub();
      unsubTyping();
    };
  }, [activeChat]);

  const handleInputChange = (e) => {
    setText(e.target.value);
    if (!activeChat) return;
    const typingRef = doc(db, "conversations", activeChat.id);
    updateDoc(typingRef, { [`typingStatus.${currentUser.uid}`]: true });

    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      updateDoc(typingRef, { [`typingStatus.${currentUser.uid}`]: false });
    }, 2000);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() || !activeChat) return;
    await addDoc(collection(db, `conversations/${activeChat.id}/messages`), {
      text,
      sender: currentUser.uid,
      createdAt: serverTimestamp(),
      reactions: {},
      seenBy: [currentUser.uid],
    });
    setText("");
    const typingRef = doc(db, "conversations", activeChat.id);
    updateDoc(typingRef, { [`typingStatus.${currentUser.uid}`]: false });
  };

  const handleReact = async (msgId, emoji) => {
    const msgRef = doc(db, `conversations/${activeChat.id}/messages`, msgId);
    const msgSnap = await getDoc(msgRef);
    let reactions = msgSnap.data().reactions || {};
    if (!reactions[emoji]) reactions[emoji] = [];
    if (!reactions[emoji].includes(currentUser.uid)) {
      reactions[emoji].push(currentUser.uid);
      await updateDoc(msgRef, { reactions });
    }
    setReactingTo(null);
  };

  const handleDeleteMessage = async (msgId, senderId) => {
    if (senderId !== currentUser.uid) return;
    await deleteDoc(doc(db, `conversations/${activeChat.id}/messages`, msgId));
  };

  useEffect(() => {
    if (!activeChat || !messages.length) return;
    const unseen = messages.filter(
      (m) =>
        m.sender !== currentUser.uid &&
        (!m.seenBy || !m.seenBy.includes(currentUser.uid))
    );
    unseen.forEach(async (msg) => {
      const msgRef = doc(db, `conversations/${activeChat.id}/messages`, msg.id);
      await updateDoc(msgRef, {
        seenBy: [...(msg.seenBy || []), currentUser.uid],
      });
    });
  }, [messages, activeChat, currentUser]);

  if (activeChat) {
    // Show split view on desktop (sm: and up)
    const otherId = activeChat
      ? activeChat.members.find((id) => id !== currentUser.uid)
      : null;
    const otherProfile = otherId ? userProfiles[otherId] || {} : {};
    const classBranch =
      otherProfile.classStatus && otherProfile.branch
        ? `${otherProfile.classStatus} | ${otherProfile.branch}`
        : "Not in school";

    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white font-sans flex w-full">
        {/* Only chat area, no sidebar */}
        <div className="flex-1 flex flex-col w-full max-w-full">
          {/* Chat header */}
          <header className="flex items-center gap-3 px-4 py-4 border-b border-white/10 bg-black/80 shadow sticky top-0 z-40 w-full max-w-full rounded-b-2xl backdrop-blur-md">
            <button
              onClick={() => setActiveChat(null)}
              className="p-2 rounded-full hover:bg-white/10 text-white"
            >
              <FaArrowLeft />
            </button>
            <FaUserCircle className="text-3xl text-white/40 flex-shrink-0" />
            <div className="min-w-0">
              <div className="font-semibold text-white text-lg truncate max-w-[120px] sm:max-w-xs">
                {otherProfile.username || "User"}
              </div>
              <div className="text-xs text-gray-400 truncate max-w-[120px] sm:max-w-xs">
                {classBranch}
              </div>
            </div>
            <button
              onClick={() => navigate(`/profile/${otherId}`)}
              className="ml-auto px-3 py-1 rounded-full bg-gradient-to-r from-gray-900 via-black to-gray-800 text-white text-xs font-semibold hover:bg-white/10 transition shadow"
            >
              View Profile
            </button>
            {Object.entries(typingStatus).some(
              ([uid, val]) => uid !== currentUser.uid && val
            ) && (
              <span className="ml-2 text-xs text-blue-400 animate-pulse">
                Typing...
              </span>
            )}
          </header>

          {/* Chat messages */}
          <main className="w-full max-w-full flex-1 mx-auto px-2 sm:px-6 py-6 flex flex-col gap-2 min-h-[60vh] overflow-y-auto">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10">
                <FaUserCircle className="text-5xl text-gray-700 mb-2" />
                <span className="text-gray-400 text-sm">
                  No messages yet. Start the conversation!
                </span>
              </div>
            ) : (
              messages.map((msg) => {
                const senderProfile = userProfiles[msg.sender] || {};
                const msgClassBranch =
                  senderProfile.classStatus && senderProfile.branch
                    ? `${senderProfile.classStatus} | ${senderProfile.branch}`
                    : "Not in school";
                // Find user's current reaction (if any)
                let userReaction = null;
                if (msg.reactions) {
                  for (const [emoji, users] of Object.entries(msg.reactions)) {
                    if (users.includes(currentUser.uid)) userReaction = emoji;
                  }
                }
                // Timestamp hover
                const createdAt =
                  msg.createdAt && msg.createdAt.seconds
                    ? new Date(msg.createdAt.seconds * 1000)
                    : null;
                const timeString = createdAt
                  ? createdAt.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "";
                return (
                  <div
                    key={msg.id}
                    className={`group flex w-full mb-2 ${
                      msg.sender === currentUser.uid
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div className="flex items-end gap-2">
                      {msg.sender !== currentUser.uid && (
                        <FaUserCircle className="text-2xl text-white/40 mb-2" />
                      )}
                      <div className="relative flex flex-col items-start group/message">
                        <div
                          className={`rounded-3xl px-5 py-3 max-w-[80vw] sm:max-w-xs break-words shadow-2xl backdrop-blur-md bg-gradient-to-br ${
                            msg.sender === currentUser.uid
                              ? "from-gray-900 via-black to-gray-800 text-white border border-white/10"
                              : "from-white/80 via-gray-100/80 to-gray-200/80 text-black border border-white/10"
                          } transition-all duration-200 hover:scale-[1.02] hover:shadow-2xl`}
                          title={timeString}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-xs text-black/60 dark:text-white/70">
                              {senderProfile.username || "User"}
                            </span>
                            <span className="text-xs text-gray-400">
                              {msgClassBranch}
                            </span>
                          </div>
                          <div className="text-base leading-relaxed">
                            {msg.text}
                          </div>
                          {/* Reactions under message */}
                          {msg.reactions &&
                            Object.keys(msg.reactions).length > 0 && (
                              <div className="flex gap-1 mt-2">
                                {Object.entries(msg.reactions).map(
                                  ([emoji, users]) => (
                                    <div
                                      key={emoji}
                                      className={`w-7 h-7 rounded-full bg-gradient-to-br from-white/90 to-gray-200/90 border border-white/10 flex items-center justify-center text-lg shadow ${
                                        userReaction === emoji
                                          ? "ring-2 ring-yellow-400"
                                          : ""
                                      }`}
                                    >
                                      <span>{emoji}</span>
                                      <span className="text-xs ml-1 text-gray-500">
                                        {users.length}
                                      </span>
                                    </div>
                                  )
                                )}
                              </div>
                            )}
                        </div>
                        {/* React and delete controls: react button only on hover */}
                        <div className="flex gap-2 mt-1 items-center">
                          <button
                            onClick={() => setReactingTo(msg.id)}
                            className="text-yellow-400 opacity-0 group-hover/message:opacity-100 transition hover:scale-110"
                          >
                            <FaSmile />
                          </button>
                          {msg.sender === currentUser.uid && (
                            <button
                              onClick={() =>
                                handleDeleteMessage(msg.id, msg.sender)
                              }
                              className="text-red-400 opacity-0 group-hover/message:opacity-100 transition hover:scale-110"
                            >
                              <FaTrash />
                            </button>
                          )}
                        </div>
                        {/* Reaction bar below message, only one emoji per user per message */}
                        {reactingTo === msg.id && (
                          <div className="z-50 bg-gradient-to-br from-white/95 to-gray-200/95 border border-white/10 rounded-2xl shadow-2xl p-2 flex gap-1 mt-2 backdrop-blur-md">
                            {emojiList.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={async () => {
                                  // Remove previous reaction by this user
                                  const msgRef = doc(
                                    db,
                                    `conversations/${activeChat.id}/messages`,
                                    msg.id
                                  );
                                  const msgSnap = await getDoc(msgRef);
                                  let reactions =
                                    msgSnap.data().reactions || {};
                                  // Remove user from all emojis
                                  for (const key in reactions) {
                                    reactions[key] = reactions[key].filter(
                                      (uid) => uid !== currentUser.uid
                                    );
                                    if (reactions[key].length === 0)
                                      delete reactions[key];
                                  }
                                  // Add user to selected emoji
                                  if (!reactions[emoji]) reactions[emoji] = [];
                                  reactions[emoji].push(currentUser.uid);
                                  await updateDoc(msgRef, { reactions });
                                  setReactingTo(null);
                                }}
                                className={`text-xl hover:scale-125 transition-transform ${
                                  userReaction === emoji
                                    ? "ring-2 ring-yellow-400 rounded-full"
                                    : ""
                                }`}
                              >
                                {emoji}
                              </button>
                            ))}
                            <button
                              onClick={() => setReactingTo(null)}
                              className="ml-2 text-xs text-gray-400"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                        <div className="text-xs text-gray-400 pr-2 pb-1 flex items-center gap-1">
                          {msg.sender === currentUser.uid &&
                            msg.seenBy &&
                            msg.seenBy.includes(otherId) && (
                              <>
                                <FaCheckDouble className="inline text-blue-400" />{" "}
                                Seen
                              </>
                            )}
                          {msg.sender === currentUser.uid &&
                            (!msg.seenBy || !msg.seenBy.includes(otherId)) && (
                              <>
                                <FaCheck className="inline text-gray-400" />{" "}
                                Sent
                              </>
                            )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </main>

          {/* Message input bar (no paperclip) */}
          <form
            onSubmit={sendMessage}
            className="flex gap-2 w-full max-w-full px-2 sm:px-6 pb-6 pt-2 sticky bottom-0 bg-gradient-to-t from-black/90 via-gray-900/90 to-gray-800/90 z-10 shadow-2xl rounded-t-2xl backdrop-blur-md"
          >
            <input
              type="text"
              className="flex-1 border border-white/10 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 min-w-0 bg-gradient-to-r from-gray-900/80 via-black/80 to-gray-800/80 text-white placeholder-gray-400 shadow-inner"
              placeholder="Message..."
              value={text}
              onChange={handleInputChange}
              style={{ wordBreak: "break-word" }}
            />
            <div className="relative">
              <button
                type="button"
                className="bg-gradient-to-r from-gray-900 via-black to-gray-800 text-white rounded-full px-2 py-2 text-xl hover:bg-white/10 transition shadow"
                onClick={() => setShowEmojiPicker((v) => !v)}
              >
                <FaSmile />
              </button>
              {showEmojiPicker && (
                <div className="absolute bottom-12 right-0 z-50 bg-gradient-to-br from-white/95 to-gray-200/95 border border-white/10 rounded-2xl shadow-2xl p-2 flex gap-1 backdrop-blur-md">
                  {emojiList.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => setText((t) => t + emoji)}
                      className="text-xl hover:scale-125 transition-transform"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="submit"
              className="bg-gradient-to-r from-gray-900 via-black to-gray-800 text-white rounded-full px-4 py-2 text-xl hover:bg-white/10 transition shadow flex items-center"
            >
              <FaPaperPlane />
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white font-sans">
      <header className="flex justify-between items-center px-2 sm:px-6 py-4 border-b border-white/10 bg-black/90 shadow sticky top-0 z-40 w-full max-w-full rounded-b-2xl">
        <h1 className="text-xl font-bold truncate text-white">Messages</h1>
      </header>
      <div className="w-full max-w-lg mx-auto py-6 px-2 sm:px-4">
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center items-center py-10">
              <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center py-10">
              <FaUserCircle className="text-5xl text-gray-700 mb-2" />
              <span className="text-gray-400 text-sm">
                No conversations yet.
              </span>
            </div>
          ) : (
            conversations.map((conv) => {
              const otherId = conv.members.find((id) => id !== currentUser.uid);
              const otherProfile = userProfiles[otherId] || {};
              const branch =
                otherProfile.classStatus && otherProfile.branch
                  ? `${otherProfile.classStatus} | ${otherProfile.branch}`
                  : "Not in school";
              return (
                <div
                  key={conv.id}
                  className="flex items-center gap-4 bg-gradient-to-r from-white/10 via-gray-900/20 to-gray-800/20 rounded-xl p-3 border border-white/10 shadow w-full text-left min-w-0 cursor-pointer hover:bg-white/10 transition"
                  onClick={() => setActiveChat(conv)}
                >
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/profile/${otherId}`);
                    }}
                    className="flex items-center gap-2 focus:outline-none"
                  >
                    <FaUserCircle className="text-2xl text-white/60 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="font-semibold text-white underline truncate max-w-[120px] sm:max-w-xs">
                        {otherProfile.username || "User"}
                      </div>
                      <div className="text-xs text-gray-300 truncate max-w-[120px] sm:max-w-xs">
                        {branch}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Messaging;
