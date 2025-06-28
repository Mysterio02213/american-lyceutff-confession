// Updated /edit-profile.jsx with SignUp-matching UI and branch/class selection
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";

const BRANCHES = [
  { name: "Canal Bank" },
  { name: "Canal View" },
  { name: "Defence" },
  { name: "Westwood" },
  { name: "Johar Town Boys" },
  { name: "Johar Town Girls" },
  { name: "Johar Town Premier" },
  { name: "Wahdat Road" },
  { name: "Gulshan-E- Ravi 1" },
  { name: "Gulshan-E- Ravi 2" },
  { name: "Gulshan-E- Ravi 3" },
  { name: "Gulshan-E- Ravi 5" },
  { name: "Gulshan-E- Ravi 6" },
  { name: "Sabzazar" },
  { name: "Shah Jamal" },
  { name: "PIA" },
  { name: "Pak Block" },
  { name: "Samanabad" },
  { name: "New Metro City" },
  { name: "Faisalabad" },
  { name: "FMC" },
  { name: "PWD" },
  { name: "AWT" },
  { name: "Bahria Enclave" },
  { name: "Bahria phase 7" },
  { name: "Bharakahu" },
  { name: "Top City" },
  { name: "Kahrian" },
  { name: "Saima Arabian Villas" },
  { name: "Saima Luxury Home" },
  { name: "SNK Premier PECHS Campus" },
];

const CLASS_OPTIONS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "Matric",
  "Pre-O Level",
  "O Level",
  "A Level",
];

const EditProfile = () => {
  const [formData, setFormData] = useState({
    fullName: "",
    username: "",
    branch: "",
    classStatus: "",
  });
  const [branchSearch, setBranchSearch] = useState("");
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return navigate("/login");
      const docSnap = await getDoc(doc(db, "users", user.uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFormData({
          fullName: data.fullName || "",
          username: data.username || "",
          branch: data.branch || "",
          classStatus: data.classStatus || "",
        });
        setBranchSearch(data.branch || "");
      }
    });
    return () => unsub();
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid), formData);
    navigate("/profile");
  };

  const filteredBranches = BRANCHES.filter((b) =>
    b.name.toLowerCase().includes(branchSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white p-6 flex items-center justify-center">
      <div className="w-full max-w-xl bg-gradient-to-br from-gray-900/80 via-black/90 to-gray-800/80 border border-white/10 rounded-2xl p-8">
        <h2 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-white via-gray-300 to-gray-500 bg-clip-text text-transparent">
          Edit Your Profile
        </h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block mb-1 font-semibold">Full Name</label>
            <input
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-black border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gray-400"
              required
            />
          </div>
          <div>
            <label className="block mb-1 font-semibold">Username</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-black border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gray-400"
              required
            />
          </div>
          <div>
            <label className="block mb-1 font-semibold">Branch</label>
            <div className="relative">
              <input
                type="text"
                value={branchSearch || formData.branch}
                onChange={(e) => {
                  setBranchSearch(e.target.value);
                  setFormData((prev) => ({ ...prev, branch: e.target.value }));
                }}
                onFocus={() => setShowBranchDropdown(true)}
                onBlur={() =>
                  setTimeout(() => setShowBranchDropdown(false), 150)
                }
                placeholder="Search or select branch"
                className="w-full px-3 py-2 bg-black border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
              {showBranchDropdown && (
                <div className="absolute z-20 mt-1 w-full bg-black border border-white/10 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredBranches.map((b) => (
                    <div
                      key={b.name}
                      className="p-2 hover:bg-gray-800 cursor-pointer text-sm"
                      onMouseDown={() => {
                        setFormData((prev) => ({ ...prev, branch: b.name }));
                        setBranchSearch(b.name);
                        setShowBranchDropdown(false);
                      }}
                    >
                      {b.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block mb-1 font-semibold">Class</label>
            <select
              name="classStatus"
              value={formData.classStatus}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-black border border-white/10 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              {CLASS_OPTIONS.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-between gap-4 pt-4">
            <button
              type="submit"
              className="flex-1 py-3 rounded-xl font-bold bg-black border border-white/10 hover:border-white/30 hover:scale-105 transition"
            >
              Save Changes
            </button>
            <button
              type="button"
              onClick={() => navigate("/profile")}
              className="flex-1 py-3 rounded-xl font-bold bg-gray-700 hover:bg-gray-600 text-white"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProfile;
