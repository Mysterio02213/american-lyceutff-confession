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
} from "react-icons/fa";

const Home = () => {
  const [user, setUser] = useState(null);
  const [feed, setFeed] = useState([]);
  const [comments, setComments] = useState([]);
  const [activePost, setActivePost] = useState(null);
  const [loading, setLoading] = useState(true);
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

  // In feed, listen for live comment counts
  useEffect(() => {
    if (!feed.length) return;
    const unsubscribes = feed.map((post, idx) => {
      const commentsRef = collection(db, `posts/${post.id}/comments`);
      return onSnapshot(commentsRef, (snap) => {
        // Only count top-level comments
        const count = snap.docs.filter((doc) => !doc.data().parentId).length;
        setFeed((prev) => {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], liveCommentsCount: count };
          return updated;
        });
      });
    });
    return () => unsubscribes.forEach((unsub) => unsub && unsub());
  }, [feed.length]);

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
          <div className="flex flex-col items-center justify-center py-16">
            <FaUserCircle className="text-5xl text-gray-700 mb-2" />
            <p className="text-center text-gray-400">
              No posts yet. Be the first to post!
            </p>
          </div>
        ) : (
          <div className="space-y-8 w-full">
            {feed.map((post, idx) => {
              const isNew =
                post.createdAt?.toDate &&
                Date.now() - new Date(post.createdAt.toDate()).getTime() <
                  5 * 60000;
              const liked = post.likes?.includes(user.uid);
              return (
                <div
                  key={post.id}
                  className={`bg-gradient-to-br from-white/10 via-gray-900/30 to-gray-800/30 border border-white/10 rounded-2xl p-0 shadow-2xl relative transition overflow-hidden w-full max-w-full sm:max-w-md mx-auto ${
                    isNew ? "ring-2 ring-white/20" : ""
                  }`}
                >
                  {/* Post Header */}
                  <div className="flex justify-between items-center px-4 pt-4 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center">
                        <FaUserCircle className="text-xl text-white/60" />
                      </div>
                      <span className="font-semibold text-white text-sm">
                        {post.authorName}
                      </span>
                    </div>
                    <time className="text-xs text-gray-400">
                      {post.createdAt?.toDate?.().toLocaleString()}
                    </time>
                  </div>
                  {/* Post Content */}
                  <div className="px-4 pb-3">
                    <p className="text-white text-base whitespace-pre-wrap mb-2">
                      {post.content}
                    </p>
                  </div>
                  {/* Post Actions */}
                  <div className="flex gap-6 px-4 pb-4 items-center border-t border-white/10 pt-2">
                    <button
                      onClick={() => toggleLike(post)}
                      className="flex items-center gap-1 group"
                    >
                      {liked ? (
                        <FaHeart className="text-white group-hover:scale-110 transition" />
                      ) : (
                        <FaRegHeart className="text-white/70 group-hover:scale-110 transition" />
                      )}
                      <span className="text-white text-sm">
                        {post.likes?.length || 0}
                      </span>
                    </button>
                    <button
                      onClick={() => openComments(post)}
                      className="flex items-center gap-1 group"
                    >
                      <FaCommentDots className="text-white/70 group-hover:scale-110 transition" />
                      <span className="text-white text-sm">
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
      className="flex gap-2 mt-4"
      autoComplete="off"
    >
      <div className="flex-1">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full p-3 text-black bg-gray-100 rounded-lg border border-black/10 focus:ring-1 focus:ring-black focus:outline-none resize-none"
          rows={1}
          placeholder="Write a comment..."
          disabled={loading}
        />
      </div>
      <button
        type="submit"
        className="px-4 py-2 text-white bg-black rounded-lg shadow-md hover:bg-black/90 transition"
        disabled={loading}
      >
        {loading ? (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
        ) : (
          "Send"
        )}
      </button>
    </form>
  );
};

// CommentItem component for rendering a single comment
const CommentItem = ({ comment, user, postId, setComments }) => {
  const [replying, setReplying] = useState(false);
  const [liked, setLiked] = useState(comment.likes?.includes(user.uid) || false);
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
      {/* Replies Section */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-2 ml-4 border-l border-black/10 pl-4">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              user={user}
              postId={postId}
              setComments={setComments}
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
          parentId={comment.id}
          onDone={() => setReplying(false)}
        />
      )}
    </div>
  );
};
