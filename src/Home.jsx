// Fully rebuilt Home.jsx with advanced UI, comments, likes, modals, and clean dark theme
import React, { useEffect, useState } from "react";
import { auth, db } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  collection,
  query,
  orderBy,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  getDoc,
  onSnapshot,
  addDoc,
  getDocs,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import {
  FaPlus,
  FaSignOutAlt,
  FaUserCircle,
  FaCommentDots,
  FaHeart,
  FaRegHeart,
  FaTimes,
  FaPaperPlane,
} from "react-icons/fa";

const Home = () => {
  const [user, setUser] = useState(null);
  const [feed, setFeed] = useState([]);
  const [comments, setComments] = useState([]);
  const [activePost, setActivePost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userMap, setUserMap] = useState({});
  const [authorProfiles, setAuthorProfiles] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) navigate("/login");
      else setUser(u);
    });
    return () => unsub();
  }, [navigate]);

  useEffect(() => {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setFeed(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // In feed, listen for live comment counts and likes
  useEffect(() => {
    if (!feed.length) return;
    // Unsubscribe functions for comments and likes
    const unsubscribes = feed.map((post, idx) => {
      const commentsRef = collection(db, `posts/${post.id}/comments`);
      const postRef = doc(db, "posts", post.id);
      // Listen for comments
      const unsubComments = onSnapshot(commentsRef, (snap) => {
        const count = snap.docs.filter((doc) => !doc.data().parentId).length;
        setFeed((prev) => {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], liveCommentsCount: count };
          return updated;
        });
      });
      // Listen for likes
      const unsubLikes = onSnapshot(postRef, (snap) => {
        const data = snap.data();
        setFeed((prev) => {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], likes: data.likes || [] };
          return updated;
        });
      });
      return () => {
        unsubComments();
        unsubLikes();
      };
    });
    return () => unsubscribes.forEach((unsub) => unsub && unsub());
  }, [feed.length]);

  // Fetch all users for mention mapping
  useEffect(() => {
    const fetchUsers = async () => {
      const snap = await getDocs(collection(db, "users"));
      const map = {};
      snap.docs.forEach((doc) => {
        const d = doc.data();
        if (d.username) map[d.username] = doc.id;
      });
      setUserMap(map);
    };
    fetchUsers();
  }, []);

  // Fetch latest class and branch for each post author
  useEffect(() => {
    if (!feed.length) return;
    // Get unique authorIds from feed
    const authorIds = Array.from(
      new Set(feed.map((post) => post.authorId).filter(Boolean))
    );
    if (!authorIds.length) return;
    const fetchAuthors = async () => {
      const profiles = {};
      for (const uid of authorIds) {
        try {
          const userDoc = await getDoc(doc(db, "users", uid));
          if (userDoc.exists()) {
            const d = userDoc.data();
            profiles[uid] = {
              classStatus: d.classStatus || "",
              branch: d.branch || "",
            };
          }
        } catch {}
      }
      setAuthorProfiles(profiles);
    };
    fetchAuthors();
  }, [feed]);

  const toggleLike = async (post) => {
    const postRef = doc(db, "posts", post.id);
    const liked = post.likes?.includes(user.uid);
    await updateDoc(postRef, {
      likes: liked ? arrayRemove(user.uid) : arrayUnion(user.uid),
    });
  };

  // Helper to fetch comments and their replies in a hierarchy
  const fetchCommentsWithReplies = async (postId, setComments) => {
    const commentsRef = collection(db, `posts/${postId}/comments`);
    const q = query(commentsRef, orderBy("createdAt", "asc"));
    onSnapshot(q, (snap) => {
      // Build a map of comments by id
      const all = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const map = {};
      all.forEach((c) => (map[c.id] = { ...c, replies: [] }));
      // Assign replies to their parent
      all.forEach((c) => {
        if (c.parentId && map[c.parentId]) {
          map[c.parentId].replies.push(map[c.id]);
        }
      });
      // Only top-level comments
      const topLevel = all.filter((c) => !c.parentId).map((c) => map[c.id]);
      setComments(topLevel);
    });
  };

  const openComments = (post) => {
    fetchCommentsWithReplies(post.id, setComments);
    setActivePost(post);
  };

  // Helper to render post content with clickable mentions
  const renderContentWithMentions = (content) => {
    if (!content) return null;
    const parts = content.split(/(@[a-zA-Z0-9._-]+)/g);
    return parts.map((part, i) => {
      if (/^@[a-zA-Z0-9._-]+$/.test(part)) {
        const username = part.slice(1);
        const userId = userMap[username];
        if (userId) {
          return (
            <span
              key={i}
              className="text-blue-400 font-semibold cursor-pointer hover:underline"
              onClick={() => navigate(`/profile/${userId}`)}
            >
              {part}
            </span>
          );
        }
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white font-sans">
      {/* Feed */}
      <main className="px-2 py-8 sm:px-0 max-w-md mx-auto w-full flex flex-col items-center">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white mb-4"></div>
            <p className="text-center text-gray-400">Loading feed...</p>
          </div>
        ) : feed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <FaUserCircle className="text-5xl text-gray-700 mb-2" />
            <p className="text-center text-gray-300 text-lg font-semibold">
              No posts yet. Start the conversation!
            </p>
            <button
              className="mt-2 px-6 py-3 rounded-full bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white font-bold text-base shadow-lg border border-white/10 hover:scale-105 hover:bg-white/10 transition"
              onClick={() => navigate("/post")}
            >
              Create a Post
            </button>
          </div>
        ) : (
          <div className="space-y-8 w-full">
            {feed.map((post, idx) => {
              const isNew =
                post.createdAt?.toDate &&
                Date.now() - new Date(post.createdAt.toDate()).getTime() <
                  5 * 60000;
              const liked = post.likes?.includes(user.uid);
              const authorProfile = authorProfiles[post.authorId] || {};
              return (
                <div
                  key={post.id}
                  className={`relative group bg-gradient-to-br from-black/80 via-gray-900/90 to-gray-800/90 border border-white/10 rounded-3xl shadow-2xl overflow-hidden w-full max-w-full sm:max-w-md mx-auto transition-all duration-200 hover:scale-[1.025] hover:shadow-[0_8px_32px_0_rgba(0,0,0,0.45)] hover:border-white/30 ${
                    isNew ? "ring-2 ring-white/20" : ""
                  }`}
                  style={{ minHeight: 120 }}
                >
                  {/* Accent bar (monochrome) */}
                  <div className="absolute left-0 top-0 h-full w-2 bg-gradient-to-b from-white/10 via-gray-400/10 to-gray-800/20 opacity-80" />
                  {/* Post Header */}
                  <div className="flex items-center gap-3 px-5 pt-5 pb-2">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-gray-800 via-black to-gray-900 border-2 border-white/10 flex items-center justify-center shadow-inner">
                      <FaUserCircle className="text-2xl text-white/70" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-white text-base leading-tight truncate">
                        {post.authorName}
                      </span>
                      <span className="text-xs text-gray-400 truncate">
                        {authorProfile.classStatus && authorProfile.branch
                          ? `${authorProfile.classStatus} | ${authorProfile.branch}`
                          : "Not in school"}
                      </span>
                    </div>
                    <div className="ml-auto flex flex-col items-end">
                      <time className="text-xs text-gray-400">
                        {post.createdAt?.toDate?.().toLocaleString()}
                      </time>
                      {isNew && (
                        <span className="text-xs text-white/70 font-bold animate-pulse mt-1">
                          New
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Post Content */}
                  <div className="px-6 pb-4 pt-1">
                    <p className="text-white text-lg font-medium leading-relaxed whitespace-pre-wrap mb-2 font-sans drop-shadow-sm">
                      {renderContentWithMentions(post.content)}
                    </p>
                  </div>
                  {/* Post Actions */}
                  <div className="flex gap-8 px-6 pb-5 pt-2 items-center border-t border-white/10 bg-gradient-to-r from-white/5 via-gray-900/10 to-gray-800/10">
                    <button
                      onClick={() => toggleLike(post)}
                      className={`flex items-center gap-1 group/like px-3 py-1 rounded-full transition font-semibold text-base ${
                        liked
                          ? "bg-white/10 text-white"
                          : "hover:bg-white/10 text-white/80"
                      }`}
                    >
                      {liked ? (
                        <FaHeart className="text-white group-hover/like:scale-110 transition" />
                      ) : (
                        <FaRegHeart className="text-white/70 group-hover/like:scale-110 transition" />
                      )}
                      <span>{post.likes?.length || 0}</span>
                    </button>
                    <button
                      onClick={() => openComments(post)}
                      className="flex items-center gap-1 group/comment px-3 py-1 rounded-full hover:bg-white/10 text-white/80 font-semibold text-base transition"
                    >
                      <FaCommentDots className="text-white/70 group-hover/comment:scale-110 transition" />
                      <span>
                        {post.liveCommentsCount !== undefined
                          ? post.liveCommentsCount
                          : 0}{" "}
                        Comments
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      {/* Floating Post Button */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 sm:right-8 sm:left-auto sm:translate-x-0 z-50">
        <button
          className="w-16 h-16 flex items-center justify-center rounded-full bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white text-3xl shadow-2xl border-4 border-white/10 hover:scale-110 transition"
          onClick={() => navigate("/post")}
          aria-label="Create Post"
        >
          <FaPlus />
        </button>
      </div>

      {/* Comments Modal */}
      {activePost && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center px-4">
          <div className="bg-gradient-to-br from-white/95 to-gray-200/95 text-black border border-black/10 rounded-2xl max-w-md w-full p-6 relative shadow-2xl">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-black"
              onClick={() => setActivePost(null)}
              aria-label="Close Comments"
            >
              <FaTimes size={20} />
            </button>
            <h2 className="text-lg font-bold mb-4">
              Comments (
              {comments.reduce(
                (acc, c) => acc + 1 + (c.replies?.length || 0),
                0
              )}
            </h2>
            {comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <FaCommentDots className="text-4xl text-gray-300 mb-2" />
                <p className="text-gray-400 text-sm">
                  No comments yet. Be the first to comment!
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto mb-4">
                {comments.map((cmt) => (
                  <CommentItem
                    key={cmt.id}
                    comment={cmt}
                    user={user}
                    postId={activePost.id}
                    setComments={setComments}
                  />
                ))}
              </div>
            )}
            <AddComment
              postId={activePost.id}
              user={user}
              setComments={setComments}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;

// Helper to get user profile from Firestore
const getUserProfile = async (uid) => {
  const userDoc = await getDoc(doc(db, "users", uid));
  if (userDoc.exists()) {
    const data = userDoc.data();
    return {
      username: data.username || data.fullName || "Anonymous",
      classStatus: data.classStatus || "",
    };
  }
  return { username: "Anonymous", classStatus: "" };
};

// AddComment component for replying to a post
const AddComment = ({ postId, user, setComments, parentId = null, onDone }) => {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    const profile = await getUserProfile(user.uid);
    const comment = {
      text,
      author: profile.username,
      authorId: user.uid,
      classStatus: profile.classStatus,
      createdAt: new Date(),
      likes: [],
      parentId,
    };
    const commentsRef = collection(db, `posts/${postId}/comments`);
    await addDoc(commentsRef, comment);
    setText("");
    setLoading(false);
    if (setComments) {
      // If setComments function is provided, use it to update comments
      setComments((prev) => {
        const updated = [...prev];
        // Find the parent comment if replying to a thread
        if (parentId) {
          const parentComment = updated.find((c) => c.id === parentId);
          if (parentComment) {
            // Add the new comment as a reply to the parent comment
            parentComment.replies = parentComment.replies || [];
            parentComment.replies.push({ ...comment, id: comment.authorId });
          }
        } else {
          // Otherwise, add as a top-level comment
          updated.push({ ...comment, id: comment.authorId });
        }
        return updated;
      });
    }
    if (onDone) onDone();
  };

  return (
    <form
      onSubmit={handleAdd}
      className="flex gap-2 mt-4 w-full"
      autoComplete="off"
    >
      <div className="flex-1 relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full p-3 text-black bg-gray-100 rounded-lg border border-black/10 focus:ring-1 focus:ring-black focus:outline-none resize-none text-sm sm:text-base pr-12"
          rows={1}
          placeholder="Write a comment..."
          disabled={loading}
          style={{ minHeight: 40, maxHeight: 120 }}
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black text-white rounded-full p-2 shadow-md hover:bg-gray-900 transition flex items-center justify-center disabled:opacity-60"
          disabled={loading || !text.trim()}
          aria-label="Send"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          ) : (
            <FaPaperPlane className="text-lg sm:text-xl" />
          )}
        </button>
      </div>
    </form>
  );
};

// CommentItem component for rendering a single comment
const CommentItem = ({
  comment,
  user,
  postId,
  setComments,
  parentId = null,
  topLevelId = null,
}) => {
  const [replying, setReplying] = useState(false);
  const [liked, setLiked] = useState(
    comment.likes?.includes(user.uid) || false
  );
  const [loading, setLoading] = useState(false);

  const handleLike = async () => {
    setLiked((prev) => !prev);
    const commentRef = doc(db, `posts/${postId}/comments`, comment.id);
    await updateDoc(commentRef, {
      likes: liked ? arrayRemove(user.uid) : arrayUnion(user.uid),
    });
  };

  const handleReply = () => {
    setReplying((prev) => !prev);
  };

  // Find all replies to this top-level comment (flat, not nested)
  const allReplies =
    parentId === null && comment.replies
      ? comment.replies.filter((r) => r.parentId === comment.id)
      : [];

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 flex flex-col gap-2">
      {/* Comment Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-black/10 flex items-center justify-center">
            <FaUserCircle className="text-xl text-black/60" />
          </div>
          <span className="font-semibold text-black text-sm">
            {comment.author}
          </span>
        </div>
        <time className="text-xs text-gray-400">
          {comment.createdAt?.toDate?.().toLocaleString()}
        </time>
      </div>
      {/* Comment Content */}
      <div className="text-black text-sm whitespace-pre-wrap">
        {comment.text}
      </div>
      {/* Comment Actions */}
      <div className="flex gap-4 text-black/60 text-xs">
        <button
          onClick={handleLike}
          className="flex items-center gap-1 transition"
        >
          {liked ? (
            <FaHeart className="text-red-500" />
          ) : (
            <FaRegHeart className="text-black/60" />
          )}
          Like
        </button>
        <button
          onClick={handleReply}
          className="flex items-center gap-1 transition"
        >
          <FaCommentDots className="text-black/60" />
          Reply
        </button>
      </div>
      {/* Replies Section (flat, not nested) */}
      {allReplies.length > 0 && (
        <div className="mt-2 ml-4 border-l border-black/10 pl-4">
          {allReplies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              user={user}
              postId={postId}
              setComments={setComments}
              parentId={comment.id}
              topLevelId={comment.id}
            />
          ))}
        </div>
      )}
      {/* Add Reply Component */}
      {replying && (
        <AddComment
          postId={postId}
          user={user}
          setComments={setComments}
          parentId={topLevelId || comment.id} // always reply to top-level
          onDone={() => setReplying(false)}
        />
      )}
    </div>
  );
};
