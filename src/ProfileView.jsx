// Public profile view for any user, Instagram-style
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db, auth } from "./firebase";
import { doc, getDoc, collection, query, where, onSnapshot, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { FaUserCircle, FaUserPlus, FaUserMinus, FaPaperPlane, FaTimes } from "react-icons/fa";

const ProfileView = () => {
  const { userId } = useParams();
  const [userData, setUserData] = useState(null);
  const [posts, setPosts] = useState([]);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [startingChat, setStartingChat] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setCurrentUser(auth.currentUser);
    if (!userId) return;
    getDoc(doc(db, "users", userId)).then((docSnap) => {
      if (docSnap.exists()) setUserData({ id: userId, ...docSnap.data() });
    });
    // Fetch posts
    const q = query(collection(db, "posts"), where("authorId", "==", userId));
    const unsubPosts = onSnapshot(q, (snap) => {
      setPosts(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    // Fetch all users for modals
    const unsubAll = onSnapshot(collection(db, "users"), (snap) => {
      setAllUsers(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    // Listen for currentUser following changes
    let unsubCurrent = null;
    if (auth.currentUser) {
      unsubCurrent = onSnapshot(doc(db, "users", auth.currentUser.uid), (snap) => {
        const data = snap.data();
        setIsFollowing((data?.following || []).includes(userId));
      });
    }
    return () => {
      unsubPosts();
      unsubAll();
      if (unsubCurrent) unsubCurrent();
    };
  }, [userId]);

  const handleFollow = async () => {
    await updateDoc(doc(db, "users", currentUser.uid), {
      following: arrayUnion(userId),
    });
    await updateDoc(doc(db, "users", userId), {
      followers: arrayUnion(currentUser.uid),
    });
    setIsFollowing(true);
  };
  const handleUnfollow = async () => {
    await updateDoc(doc(db, "users", currentUser.uid), {
      following: arrayRemove(userId),
    });
    await updateDoc(doc(db, "users", userId), {
      followers: arrayRemove(currentUser.uid),
    });
    setIsFollowing(false);
  };
  const startChat = async () => {
    setStartingChat(true);
    // Find or create conversation
    // ...similar to Profile.jsx logic...
    setStartingChat(false);
    navigate("/messaging", { state: { userId } });
  };

  if (!userData) return <div className="min-h-screen flex items-center justify-center bg-black text-white"><p>Loading profile...</p></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white px-2 py-6 sm:px-4 sm:py-10 flex flex-col items-center font-sans">
      <div className="w-full max-w-2xl mx-auto">
        {/* Profile Header */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 border border-white/10 bg-gradient-to-br from-black/80 via-gray-900/80 to-gray-800/80 rounded-2xl p-6 shadow-2xl w-full">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gray-800 flex items-center justify-center text-3xl font-bold mb-4 sm:mb-0">
            {userData.fullName?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 w-full flex flex-col items-center sm:items-start">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full">
              <h2 className="text-2xl sm:text-3xl font-bold text-white text-center sm:text-left">
                @{userData.username}
              </h2>
              <div className="flex gap-2 mt-3 sm:mt-0">
                {isFollowing ? (
                  <button className="px-4 py-2 text-sm font-semibold bg-red-500 border border-white/10 rounded hover:bg-red-700" onClick={handleUnfollow}><FaUserMinus className="inline mr-1" />Unfollow</button>
                ) : (
                  <button className="px-4 py-2 text-sm font-semibold bg-black border border-white/10 rounded hover:border-white/30" onClick={handleFollow}><FaUserPlus className="inline mr-1" />Follow</button>
                )}
                <button className="px-4 py-2 text-sm font-semibold bg-black border border-white/10 rounded hover:border-white/30 flex items-center gap-1" onClick={startChat} disabled={startingChat}><FaPaperPlane />Message</button>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-6 mt-4 text-sm text-gray-400 items-center sm:items-start">
              <button className="focus:outline-none" onClick={() => setShowFollowers(true)}><span className="text-white font-bold">{userData.followers?.length || 0}</span> Followers</button>
              <button className="focus:outline-none" onClick={() => setShowFollowing(true)}><span className="text-white font-bold">{userData.following?.length || 0}</span> Following</button>
              <p><span className="text-white font-bold">{userData.classStatus}</span> • {userData.branch}</p>
            </div>
            <p className="mt-3 text-gray-300 text-sm text-center sm:text-left w-full">{userData.fullName}</p>
            <p className="text-xs text-gray-400 mt-1 break-all">{userData.email}</p>
          </div>
        </div>
        {/* Followers/Following Modals and Posts (similar to Profile.jsx) */}
        {/* Followers Modal */}
        {showFollowers && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center px-4">
            <div className="bg-gradient-to-br from-white/95 to-gray-200/95 text-black border border-black/10 rounded-2xl max-w-md w-full p-6 relative shadow-2xl">
              <button
                className="absolute top-3 right-3 text-gray-400 hover:text-black"
                onClick={() => setShowFollowers(false)}
                aria-label="Close Followers"
              >
                <FaTimes size={20} />
              </button>
              <h2 className="text-lg font-bold mb-4">Followers</h2>
              {(!userData.followers || userData.followers.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <FaUserCircle className="text-4xl text-gray-300 mb-2" />
                  <p className="text-gray-400 text-sm">No followers yet.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto mb-4">
                  {userData.followers.map((uid) => {
                    const u = allUsers.find((user) => user.id === uid);
                    return u ? (
                      <div key={u.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/10">
                        <button onClick={() => navigate(`/profile/${u.id}`)} className="focus:outline-none">
                          <FaUserCircle className="text-2xl text-black/40" />
                        </button>
                        <div className="flex-1">
                          <div className="font-semibold text-black underline cursor-pointer" onClick={() => navigate(`/profile/${u.id}`)}>{u.username}</div>
                          <div className="text-xs text-gray-500">{u.classStatus} | {u.branch}</div>
                        </div>
                      </div>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          </div>
        )}
        {/* Following Modal */}
        {showFollowing && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center px-4">
            <div className="bg-gradient-to-br from-white/95 to-gray-200/95 text-black border border-black/10 rounded-2xl max-w-md w-full p-6 relative shadow-2xl">
              <button
                className="absolute top-3 right-3 text-gray-400 hover:text-black"
                onClick={() => setShowFollowing(false)}
                aria-label="Close Following"
              >
                <FaTimes size={20} />
              </button>
              <h2 className="text-lg font-bold mb-4">Following</h2>
              {(!userData.following || userData.following.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <FaUserCircle className="text-4xl text-gray-300 mb-2" />
                  <p className="text-gray-400 text-sm">Not following anyone yet.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto mb-4">
                  {userData.following.map((uid) => {
                    const u = allUsers.find((user) => user.id === uid);
                    return u ? (
                      <div key={u.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/10">
                        <button onClick={() => navigate(`/profile/${u.id}`)} className="focus:outline-none">
                          <FaUserCircle className="text-2xl text-black/40" />
                        </button>
                        <div className="flex-1">
                          <div className="font-semibold text-black underline cursor-pointer" onClick={() => navigate(`/profile/${u.id}`)}>{u.username}</div>
                          <div className="text-xs text-gray-500">{u.classStatus} | {u.branch}</div>
                        </div>
                      </div>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          </div>
        )}
        {/* User's Posts */}
        <div className="flex justify-between items-center mt-8 mb-4">
          <h3 className="text-lg font-semibold text-white">Posts</h3>
        </div>
        {posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8">
            <FaUserCircle className="text-5xl text-gray-700 mb-2" />
            <p className="text-gray-400 text-sm">No posts yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {posts.map((post) => (
              <div key={post.id} className="bg-gradient-to-r from-white/10 via-gray-900/20 to-gray-800/20 border border-white/10 rounded-xl flex flex-row items-center p-0 overflow-hidden shadow">
                <div className="flex-shrink-0 w-24 h-24 bg-gray-900 flex items-center justify-center">
                  <FaUserCircle className="text-3xl text-gray-400" />
                </div>
                <div className="flex-1 p-4 flex flex-col gap-1">
                  <span className="font-semibold text-white text-sm">{userData.username}</span>
                  <span className="text-xs text-gray-400">{post.createdAt?.toDate?.().toLocaleString()}</span>
                  <div className="text-white text-base whitespace-pre-wrap mt-1 break-words">{post.content}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileView;
