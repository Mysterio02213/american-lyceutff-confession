import React, { useEffect, useState } from "react";
import { db, auth } from "./firebase";
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  doc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { FaUserCircle, FaSearch, FaUserPlus, FaComments } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

const Social = () => {
  const [tab, setTab] = useState("class");
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [profile, setProfile] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const currentUser = auth.currentUser;
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) return;
    // Fetch current user's profile
    onSnapshot(doc(db, "users", currentUser.uid), (snap) => {
      setProfile(snap.data());
    });
  }, [currentUser]);

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    let q;
    if (tab === "class") {
      q = query(
        collection(db, "users"),
        where("classStatus", "==", profile.classStatus)
      );
    } else if (tab === "branch") {
      q = query(collection(db, "users"), where("branch", "==", profile.branch));
    } else {
      q = query(collection(db, "users"));
    }
    getDocs(q).then((snap) => {
      let list = snap.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((u) => u.id !== currentUser.uid);
      if (tab === "suggestions") {
        list = list.filter((u) => !(profile.following || []).includes(u.id));
      }
      setUsers(list);
      setLoading(false);
    });
  }, [tab, profile, currentUser]);

  // Suggestions: show users not followed
  useEffect(() => {
    if (!profile) return;
    getDocs(collection(db, "users")).then((snap) => {
      const all = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setSuggestions(
        all.filter(
          (u) =>
            u.id !== currentUser.uid &&
            !(profile.following || []).includes(u.id)
        )
      );
    });
  }, [profile, currentUser]);

  const handleFollow = async (uid) => {
    await updateDoc(doc(db, "users", currentUser.uid), {
      following: arrayUnion(uid),
    });
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white font-sans">
      <header className="flex justify-between items-center px-6 py-4 border-b border-white/10 bg-black/90 shadow sticky top-0 z-40 rounded-b-2xl">
        <h1 className="text-xl font-bold text-white">Find Friends</h1>
      </header>
      <div className="max-w-lg mx-auto py-6 px-4">
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab("class")}
            className={`px-4 py-2 rounded-full font-semibold transition-all duration-150 ${
              tab === "class"
                ? "bg-black text-white shadow-lg"
                : "bg-white/10 text-white border border-white/10 hover:bg-white/20"
            }`}
          >
            Class Fellows
          </button>
          <button
            onClick={() => setTab("branch")}
            className={`px-4 py-2 rounded-full font-semibold transition-all duration-150 ${
              tab === "branch"
                ? "bg-black text-white shadow-lg"
                : "bg-white/10 text-white border border-white/10 hover:bg-white/20"
            }`}
          >
            Branch Fellows
          </button>
          <button
            onClick={() => setTab("suggestions")}
            className={`px-4 py-2 rounded-full font-semibold transition-all duration-150 ${
              tab === "suggestions"
                ? "bg-black text-white shadow-lg"
                : "bg-white/10 text-white border border-white/10 hover:bg-white/20"
            }`}
          >
            Suggestions
          </button>
        </div>
        <div className="flex items-center gap-2 mb-4 bg-white/5 border border-white/10 rounded-full px-3 py-2 shadow-inner">
          <FaSearch className="text-white/40" />
          <input
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-400 px-2 text-sm"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center items-center py-10">
              <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
            </div>
          ) : users.filter(
              (u) =>
                u.username?.toLowerCase().includes(search.toLowerCase()) ||
                u.fullName?.toLowerCase().includes(search.toLowerCase())
            ).length === 0 ? (
            <div className="flex flex-col items-center py-10">
              <FaUserCircle className="text-5xl text-gray-700 mb-2" />
              <span className="text-gray-400 text-sm">No users found.</span>
            </div>
          ) : (
            users
              .filter(
                (u) =>
                  u.username?.toLowerCase().includes(search.toLowerCase()) ||
                  u.fullName?.toLowerCase().includes(search.toLowerCase())
              )
              .map((u) => {
                const classBranch =
                  u.classStatus && u.branch
                    ? `${u.classStatus} | ${u.branch}`
                    : "Not in school";
                return (
                  <div
                    key={u.id}
                    className="flex items-center gap-4 bg-gradient-to-r from-white/10 via-gray-900/20 to-gray-800/20 rounded-2xl p-4 border border-white/10 shadow-2xl group transition-all duration-150"
                  >
                    <button
                      onClick={() => navigate(`/profile/${u.id}`)}
                      className="focus:outline-none flex items-center"
                    >
                      <FaUserCircle className="text-3xl text-white/60" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div
                        className="font-semibold text-white underline cursor-pointer truncate"
                        onClick={() => navigate(`/profile/${u.id}`)}
                      >
                        {u.username || "User"}
                      </div>
                      <div className="text-xs text-gray-300 truncate">
                        {classBranch}
                      </div>
                    </div>
                    <button
                      className={`bg-black text-white rounded-full px-3 py-1 text-xs font-semibold border border-white/10 transition shadow ${
                        profile?.following?.includes(u.id)
                          ? "opacity-60 cursor-not-allowed"
                          : "hover:bg-white/10"
                      }`}
                      onClick={() => handleFollow(u.id)}
                      disabled={profile?.following?.includes(u.id)}
                    >
                      {profile?.following?.includes(u.id) ? (
                        "Following"
                      ) : (
                        <>
                          <FaUserPlus className="inline mr-1" />
                          Follow
                        </>
                      )}
                    </button>
                    <button
                      className="ml-2 bg-white/10 border border-white/10 rounded-full px-3 py-1 text-xs font-semibold text-white hover:bg-black hover:text-white transition shadow"
                      onClick={() =>
                        navigate("/messaging", { state: { userId: u.id } })
                      }
                      title="Message"
                    >
                      <FaComments />
                    </button>
                  </div>
                );
              })
          )}
        </div>
      </div>
    </div>
  );
};

export default Social;
