// Instagram-style profile layout with black/gray theme
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "./firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

const Profile = () => {
  const [userData, setUserData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return navigate("/login");
      const docSnap = await getDoc(doc(db, "users", user.uid));
      if (docSnap.exists()) setUserData(docSnap.data());
    });
    return () => unsub();
  }, [navigate]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
  };

  if (!userData)
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <p className="text-lg text-gray-400">Loading profile...</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white px-4 py-10">
      <div className="max-w-4xl mx-auto">
        {/* Profile Header */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 border border-white/10 bg-gradient-to-br from-gray-900/80 via-black/90 to-gray-800/80 rounded-2xl p-6 shadow-xl">
          <div className="w-28 h-28 rounded-full bg-gray-700 flex items-center justify-center text-3xl font-bold">
            {userData.fullName?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full">
              <h2 className="text-2xl sm:text-3xl font-bold text-white">
                @{userData.username}
              </h2>
              <div className="flex gap-2 mt-3 sm:mt-0">
                <button
                  className="px-4 py-2 text-sm font-semibold bg-black border border-white/10 rounded hover:border-white/30"
                  onClick={() => navigate("/edit-profile")}
                >
                  Edit Profile
                </button>
                <button
                  className="px-4 py-2 text-sm font-semibold bg-red-700 hover:bg-red-600 rounded"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </div>
            </div>
            <div className="flex gap-6 mt-4 text-sm text-gray-400">
              <p>
                <span className="text-white font-bold">
                  {userData.followers?.length || 0}
                </span>{" "}
                Followers
              </p>
              <p>
                <span className="text-white font-bold">
                  {userData.following?.length || 0}
                </span>{" "}
                Following
              </p>
              <p>
                <span className="text-white font-bold">
                  {userData.classStatus}
                </span>{" "}
                • {userData.branch}
              </p>
            </div>
            <p className="mt-3 text-gray-300 text-sm">{userData.fullName}</p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/10 my-6"></div>

        {/* Placeholder for posts or activity grid */}
        <div className="text-center text-gray-500 text-sm italic mb-8">
          Your posts and activity will show here in future updates.
        </div>

        {/* Back to Home Button */}
        <div className="text-center">
          <button
            onClick={() => navigate("/home")}
            className="px-5 py-2 rounded-lg bg-black border border-white/10 text-white hover:border-white/30 hover:bg-gray-800 transition-all"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;
