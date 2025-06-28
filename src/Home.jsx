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

  const toggleLike = async (post) => {
    const postRef = doc(db, "posts", post.id);
    const liked = post.likes?.includes(user.uid);
    await updateDoc(postRef, {
      likes: liked ? arrayRemove(user.uid) : arrayUnion(user.uid),
    });
  };

  const openComments = async (post) => {
    const q = query(
      collection(db, `posts/${post.id}/comments`),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setComments(snap.docs.map((doc) => doc.data()));
      setActivePost(post);
    });
    return () => unsub();
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-black via-gray-900 to-black text-white">
      {/* Header */}
      <header className="flex justify-between items-center px-6 py-4 border-b border-white/10 bg-black/60">
        <h1 className="text-xl sm:text-2xl font-bold tracking-wider">
          American Lycetuff Social
        </h1>
        <div className="flex gap-4">
          <button onClick={() => navigate("/profile")}>
            <FaUserCircle className="text-xl" />
          </button>
          <button onClick={handleLogout}>
            <FaSignOutAlt className="text-xl text-red-500 hover:text-red-400" />
          </button>
        </div>
      </header>

      {/* Feed */}
      <main className="px-4 py-6 sm:px-6 max-w-2xl mx-auto">
        {loading ? (
          <p className="text-center text-gray-400">Loading feed...</p>
        ) : feed.length === 0 ? (
          <p className="text-center text-gray-400">No posts yet.</p>
        ) : (
          <div className="space-y-6">
            {feed.map((post) => {
              const isNew =
                post.createdAt?.toDate &&
                Date.now() - new Date(post.createdAt.toDate()).getTime() <
                  5 * 60000;
              const liked = post.likes?.includes(user.uid);
              return (
                <div
                  key={post.id}
                  className={`bg-gray-950 border border-white/10 rounded-xl p-4 relative transition ${
                    isNew ? "ring-2 ring-white/10" : ""
                  }`}
                >
                  <div className="flex justify-between text-sm mb-1">
                    <strong>{post.authorName}</strong>
                    <time className="text-gray-500">
                      {post.createdAt?.toDate?.().toLocaleString()}
                    </time>
                  </div>
                  <p className="text-white text-base whitespace-pre-wrap mb-3">
                    {post.content}
                  </p>
                  <div className="flex gap-4 text-sm items-center">
                    <button
                      onClick={() => toggleLike(post)}
                      className="flex items-center gap-1"
                    >
                      {liked ? (
                        <FaHeart className="text-red-500" />
                      ) : (
                        <FaRegHeart />
                      )}{" "}
                      {post.likes?.length || 0}
                    </button>
                    <button
                      onClick={() => openComments(post)}
                      className="flex items-center gap-1"
                    >
                      <FaCommentDots /> {post.commentsCount || 0} Comments
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Post Button */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
        <button
          className="w-16 h-16 flex items-center justify-center rounded-full bg-black border border-white/10 text-white text-3xl shadow-lg hover:scale-105 transition"
          onClick={() => navigate("/post")}
        >
          <FaPlus />
        </button>
      </div>

      {/* Comments Modal */}
      {activePost && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center px-4">
          <div className="bg-gray-900 text-white border border-white/10 rounded-lg max-w-md w-full p-6 relative">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-white"
              onClick={() => setActivePost(null)}
            >
              <FaTimes size={18} />
            </button>
            <h2 className="text-lg font-semibold mb-4">Comments</h2>
            {comments.length === 0 ? (
              <p className="text-gray-400 text-sm">No comments yet.</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {comments.map((cmt, i) => (
                  <div key={i} className="border-b border-white/10 pb-2">
                    <p className="text-sm font-semibold">{cmt.author}</p>
                    <p className="text-gray-300 text-sm">{cmt.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
