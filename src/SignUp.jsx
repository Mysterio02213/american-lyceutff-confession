import React, { useState } from "react";
import { auth, db } from "./firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import {
  doc,
  setDoc,
  getDocs,
  collection,
  query,
  where,
  addDoc,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import schoolLogo from "/android-chrome-192x192.png"; // logo in project root

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

const SignUp = () => {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [emailPreview, setEmailPreview] = useState("");
  const [password, setPassword] = useState("");
  const [inSchool, setInSchool] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [branchSearch, setBranchSearch] = useState("");
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [checking, setChecking] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [newBranchSuccess, setNewBranchSuccess] = useState(false);
  const [classStatus, setClassStatus] = useState(CLASS_OPTIONS[0]);
  const [instagram, setInstagram] = useState("");
  const navigate = useNavigate();

  React.useEffect(() => {
    if (username.trim()) {
      setEmailPreview(`${username.trim().toLowerCase()}@lycetuffians.com`);
    } else {
      setEmailPreview("");
    }
  }, [username]);

  const checkUsernameExists = async (uname) => {
    const usersRef = collection(db, "users");
    const q = query(
      usersRef,
      where("username", "==", uname.trim().toLowerCase())
    );
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  };

  // Filter branches by search
  const filteredBranches = BRANCHES.filter((b) =>
    b.name.toLowerCase().includes(branchSearch.toLowerCase())
  );

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(null);

    if (!fullName.trim()) {
      setError("Full name is required.");
      return;
    }
    if (!username.trim()) {
      setError("Username is required.");
      return;
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
      setError(
        "Username can only contain letters, numbers, dots, underscores, and hyphens."
      );
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (inSchool && !selectedBranch) {
      setError("Please select your campus/branch.");
      return;
    }
    if (inSchool && !classStatus) {
      setError("Please select your class.");
      return;
    }
    if (!instagram.trim()) {
      setError("Instagram username is required.");
      return;
    }

    setChecking(true);
    const uname = username.trim().toLowerCase();
    const email = `${uname}@lycetuffians.com`;

    if (await checkUsernameExists(uname)) {
      setError("This username/email is already taken.");
      setChecking(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      await setDoc(doc(db, "users", userCredential.user.uid), {
        fullName,
        username: uname,
        email,
        instagram: instagram.trim(),
        inSchool,
        branch: inSchool ? selectedBranch : "",
        classStatus: inSchool ? classStatus : "",
        createdAt: new Date(),
      });
      setSuccess(true);
      setShowFeedback(true);
      setTimeout(() => {
        setShowFeedback(false);
        navigate("/home");
      }, 2000);
    } catch (err) {
      setError(err.message);
      setSuccess(false);
      setShowFeedback(true);
      setTimeout(() => setShowFeedback(false), 4000);
    } finally {
      setChecking(false);
    }
  };

  // Handle new branch submission
  const handleNewBranchSubmit = async (e) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    await addDoc(collection(db, "branchRequests"), {
      name: newBranchName.trim(),
      createdAt: new Date(),
    });
    setNewBranchSuccess(true);
    setTimeout(() => {
      setShowBranchModal(false);
      setNewBranchName("");
      setNewBranchSuccess(false);
    }, 2000);
  };

  // Handle branch dropdown open/close
  const handleBranchInputFocus = () => setShowBranchDropdown(true);
  const handleBranchInputBlur = () =>
    setTimeout(() => setShowBranchDropdown(false), 150);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-black via-gray-900 to-black text-white overflow-x-hidden font-sans flex flex-col items-center justify-center px-2">
      <div className="relative w-full max-w-xl mx-auto mt-6 mb-10">
        {/* School Logo */}
        <div className="flex justify-center mb-4">
          <img
            src={schoolLogo}
            alt="American Lycetuff Logo"
            className="h-20 w-auto sm:h-24 object-contain"
            style={{ maxWidth: "180px" }}
          />
        </div>
        <div className="relative z-10 rounded-2xl sm:rounded-3xl shadow-2xl border border-white/10 bg-gradient-to-br from-gray-900/80 via-black/90 to-gray-800/80 backdrop-blur-2xl overflow-hidden">
          {/* Header */}
          <header className="w-full text-center py-7 px-3 sm:py-10 sm:px-6 bg-gradient-to-br from-black/80 via-gray-900/80 to-gray-800/80 border-b border-white/10">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent drop-shadow-lg mb-2">
              Join American Lycetuff Social
            </h1>
            <p className="text-gray-400 max-w-xl mx-auto text-base sm:text-lg">
              Your email will be:{" "}
              <span className="font-bold">
                {emailPreview || "username@lycetuffians.com"}
              </span>
            </p>
          </header>

          <form
            onSubmit={handleSignUp}
            className="p-4 sm:p-8 md:p-12 space-y-6 sm:space-y-8"
          >
            <div>
              <label className="block mb-1 font-semibold">Full Name:</label>
              <input
                type="text"
                className="w-full rounded-lg p-3 bg-black border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-gray-400"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="Your full name"
              />
            </div>
            <div>
              <label className="block mb-1 font-semibold">
                Instagram Username:
              </label>
              <input
                type="text"
                className="w-full rounded-lg p-3 bg-black border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-gray-400"
                value={instagram}
                onChange={(e) =>
                  setInstagram(e.target.value.replace(/\s/g, ""))
                }
                required
                placeholder="your_instagram (no spaces)"
                autoComplete="off"
              />
              <p className="text-xs text-gray-400 mt-1">
                We'll never share your Instagram. Used for verification only.
              </p>
            </div>
            <div>
              <label className="block mb-1 font-semibold">Username:</label>
              <input
                type="text"
                className="w-full rounded-lg p-3 bg-black border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-gray-400"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
                required
                placeholder="username (no spaces)"
                autoComplete="off"
              />
              <p className="text-xs text-gray-400 mt-1">
                Your email will be:{" "}
                <span className="font-semibold">
                  {emailPreview || "username@lycetuffians.com"}
                </span>
              </p>
            </div>
            <div>
              <label className="block mb-1 font-semibold">Password:</label>
              <input
                type="password"
                className="w-full rounded-lg p-3 bg-black border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-gray-400"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="At least 6 characters"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={inSchool}
                onChange={() => setInSchool(!inSchool)}
                id="inSchool"
                className="accent-gray-500"
              />
              <label htmlFor="inSchool" className="font-semibold">
                I am currently in school
              </label>
            </div>
            {/* Only show branch and class if inSchool is checked */}
            {inSchool && (
              <>
                {/* Branch Field */}
                <div>
                  <label className="block mb-1 font-semibold">
                    Campus/Branch:
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={branchSearch || selectedBranch}
                      onChange={(e) => {
                        setBranchSearch(e.target.value);
                        setSelectedBranch("");
                      }}
                      onFocus={handleBranchInputFocus}
                      onBlur={handleBranchInputBlur}
                      placeholder="Search or select branch"
                      className="w-full rounded-lg p-3 bg-black border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-gray-400 mb-2"
                      autoComplete="off"
                    />
                    {showBranchDropdown && (
                      <div className="max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-black/90 shadow-lg absolute w-full z-20">
                        {filteredBranches.length === 0 && (
                          <div className="p-2 text-gray-400 text-sm">
                            No branches found.
                          </div>
                        )}
                        {filteredBranches.map((b) => (
                          <div
                            key={b.name}
                            className={`p-2 cursor-pointer hover:bg-gray-800 transition rounded ${
                              selectedBranch === b.name
                                ? "bg-gray-700 font-bold"
                                : ""
                            }`}
                            onMouseDown={() => {
                              setSelectedBranch(b.name);
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
                  <button
                    type="button"
                    className="mt-2 text-xs text-white underline hover:text-gray-300"
                    onClick={() => setShowBranchModal(true)}
                  >
                    Can't see your branch?
                  </button>
                  {selectedBranch && (
                    <div className="mt-2 text-green-400 text-xs font-semibold">
                      Selected: {selectedBranch}
                    </div>
                  )}
                </div>
                {/* Class Field */}
                <div>
                  <label className="block mb-1 font-semibold">Class:</label>
                  <select
                    className="w-full rounded-lg p-3 bg-black border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-gray-400"
                    value={classStatus}
                    onChange={(e) => setClassStatus(e.target.value)}
                    required
                  >
                    {CLASS_OPTIONS.map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-gradient-to-r from-black via-gray-900 to-black border border-red-400/30 text-red-200 font-semibold text-sm transition-opacity duration-500">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 rounded-lg bg-gradient-to-r from-black via-gray-900 to-black border border-green-400/30 text-green-200 font-semibold text-sm transition-opacity duration-500">
                Account created! Redirecting...
              </div>
            )}
            <button
              type="submit"
              disabled={checking}
              className="w-full py-3 rounded-xl font-bold tracking-wide transition-all duration-300 flex items-center justify-center gap-2 shadow-lg border border-white/10 bg-gradient-to-br from-black via-gray-900 to-black text-white hover:scale-105 hover:shadow-2xl hover:border-white/30 active:scale-95 disabled:opacity-60"
            >
              {checking ? "Checking..." : "Sign Up"}
            </button>
            <div className="text-center mt-4">
              <span className="text-gray-400 text-sm">
                Already have an account?{" "}
                <a
                  href="/login"
                  className="text-blue-400 font-semibold underline hover:text-blue-200 transition"
                >
                  Login
                </a>
              </span>
            </div>
          </form>
        </div>
      </div>
      {/* Branch Modal */}
      {showBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-gradient-to-br from-black via-gray-900 to-black border border-white/10 rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-auto flex flex-col items-center">
            <h2 className="text-xl font-bold mb-3 text-white">
              Suggest a New Branch
            </h2>
            <form onSubmit={handleNewBranchSubmit} className="w-full">
              <input
                type="text"
                className="w-full rounded-lg p-3 mb-4 bg-black border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-gray-400"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="Enter branch/campus name"
                required
              />
              <button
                type="submit"
                className="w-full py-2 rounded-lg font-bold bg-black border border-white/20 hover:bg-gray-900 transition text-white"
              >
                Submit
              </button>
            </form>
            {newBranchSuccess && (
              <div className="mt-3 text-green-400 text-xs font-semibold">
                Branch request sent!
              </div>
            )}
            <button
              className="mt-4 text-xs text-gray-400 underline hover:text-gray-200"
              onClick={() => setShowBranchModal(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
      <footer className="relative z-10 w-full text-center py-4 sm:py-6 text-gray-500 text-xs sm:text-sm border-t border-white/5 mt-auto px-2">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© {new Date().getFullYear()} American Lycetuff Social.</p>
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-2 py-1 text-transparent bg-clip-text bg-gradient-to-r from-gray-400 via-gray-300 to-gray-500 font-semibold text-xs underline hover:text-gray-300 hover:border-white/30 transition"
            style={{ marginLeft: 2, marginRight: 2 }}
          >
            Terms and Conditions
          </a>
        </div>
      </footer>
    </div>
  );
};

export default SignUp;
