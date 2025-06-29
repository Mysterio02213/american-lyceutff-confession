// Instagram-style profile layout with black/gray theme
import React, { useEffect, useState } from "react";
import { db, auth } from "./firebase";
import { collection, query, where, onSnapshot, getDocs, doc, updateDoc } from "firebase/firestore";
import { FaUserCircle, FaEnvelope, FaUserFriends, FaUserPlus, FaUserMinus } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

const Profile = () => {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    const unsub = onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
      setUser({ id: docSnap.id, ...docSnap.data() });
      setLoading(false);
    });
    return () => unsub();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, "posts"), where("userId", "==", currentUser.uid));
    const unsub = onSnapshot(q, (snap) => {
      setPosts(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    // Followers
    const q1 = query(collection(db, "followers"), where("userId", "==", currentUser.uid));
    const unsub1 = onSnapshot(q1, (snap) => {
      setFollowers(snap.docs.map((doc) => doc.data().followerId));
    });
    // Following
    const q2 = query(collection(db, "followers"), where("followerId", "==", currentUser.uid));
    const unsub2 = onSnapshot(q2, (snap) => {
      setFollowing(snap.docs.map((doc) => doc.data().userId));
    });
    return () => { unsub1(); unsub2(); };
  }, [currentUser]);

  useEffect(() => {
    // Suggestions: users not followed by current user
    const fetchSuggestions = async () => {
      const usersSnap = await getDocs(collection(db, "users"));
      const allUsers = usersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setSuggestions(allUsers.filter(u => u.id !== currentUser.uid && !following.includes(u.id)));
    };
    if (currentUser && following.length) fetchSuggestions();
  }, [currentUser, following]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-gray-300 border-t-black rounded-full animate-spin"></div>
      </div>
    );
  }

  const classBranch = (user.classStatus && user.branch)
    ? `${user.classStatus} | ${user.branch}`
    : 'Not in school';

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white font-sans">
      <div className="max-w-2xl mx-auto py-8 px-2 sm:px-6">
        <div className="flex flex-col sm:flex-row items-center gap-6 mb-8">
          <FaUserCircle className="text-7xl text-white/40" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl font-bold truncate">{user.username || 'User'}</span>
              <span className="text-xs bg-white/10 text-white px-2 py-1 rounded-full">{classBranch}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-300 mb-2">
              <FaEnvelope className="text-base" />
              <span className="truncate">{user.email}</span>
            </div>
            <div className="flex gap-4 text-sm">
              <button onClick={() => setShowFollowers(true)} className="hover:underline">
                <FaUserFriends className="inline mr-1" /> {followers.length} Followers
              </button>
              <button onClick={() => setShowFollowing(true)} className="hover:underline">
                <FaUserPlus className="inline mr-1" /> {following.length} Following
              </button>
            </div>
          </div>
          <button onClick={() => navigate('/edit-profile')} className="bg-white text-black rounded-full px-4 py-2 font-semibold hover:bg-gray-200 transition w-full sm:w-auto">Edit Profile</button>
        </div>
        {/* Suggestions */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-2">Suggestions for you</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {suggestions.length === 0 ? (
              <span className="text-gray-400">No suggestions</span>
            ) : suggestions.map((s) => (
              <button key={s.id} onClick={() => navigate(`/profile/${s.id}`)} className="flex flex-col items-center bg-white/10 rounded-lg p-3 min-w-[100px] hover:bg-white/20 transition">
                <FaUserCircle className="text-3xl text-white/40 mb-1" />
                <span className="text-sm font-semibold truncate max-w-[80px]">{s.username || 'User'}</span>
                <span className="text-xs text-gray-300 truncate max-w-[80px]">{(s.classStatus && s.branch) ? `${s.classStatus} | ${s.branch}` : 'Not in school'}</span>
              </button>
            ))}
          </div>
        </div>
        {/* Posts grid */}
        <div>
          <h2 className="text-lg font-semibold mb-2">Your Posts</h2>
          {posts.length === 0 ? (
            <div className="text-gray-400 py-8 text-center flex flex-col items-center gap-4">
              <span>No posts yet.</span>
              <button
                onClick={() => navigate('/post')}
                className="mt-2 px-6 py-3 rounded-full bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white font-bold text-base shadow-lg border border-white/10 hover:scale-105 hover:bg-white/10 transition"
              >
                Create a Post
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {posts.map((post) => (
                <div key={post.id} className="bg-white/10 rounded-lg aspect-square flex items-center justify-center text-white text-center p-2 truncate">
                  {post.content || <span className="text-gray-400">No content</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Followers Modal */}
      {showFollowers && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-full max-w-xs mx-2">
            <h3 className="font-bold text-lg mb-4 text-black">Followers</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {followers.length === 0 ? (
                <div className="text-gray-400">No followers</div>
              ) : (
                followers.map(fid => (
                  <button key={fid} onClick={() => { setShowFollowers(false); navigate(`/profile/${fid}`); }} className="flex items-center gap-2 w-full p-2 rounded hover:bg-black/5 text-left">
                    <FaUserCircle className="text-xl text-black/40" />
                    <span className="font-semibold text-black truncate">{fid}</span>
                  </button>
                ))
              )}
            </div>
            <button onClick={() => setShowFollowers(false)} className="mt-4 w-full bg-black text-white rounded-full py-2 font-semibold">Close</button>
          </div>
        </div>
      )}
      {/* Following Modal */}
      {showFollowing && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-full max-w-xs mx-2">
            <h3 className="font-bold text-lg mb-4 text-black">Following</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {following.length === 0 ? (
                <div className="text-gray-400">Not following anyone</div>
              ) : (
                following.map(fid => (
                  <button key={fid} onClick={() => { setShowFollowing(false); navigate(`/profile/${fid}`); }} className="flex items-center gap-2 w-full p-2 rounded hover:bg-black/5 text-left">
                    <FaUserCircle className="text-xl text-black/40" />
                    <span className="font-semibold text-black truncate">{fid}</span>
                  </button>
                ))
              )}
            </div>
            <button onClick={() => setShowFollowing(false)} className="mt-4 w-full bg-black text-white rounded-full py-2 font-semibold">Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
