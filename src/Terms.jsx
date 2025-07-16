import React from "react";
import {
  FaInstagram,
  FaLock,
  FaUserShield,
  FaGavel,
  FaUserSecret,
  FaExclamationTriangle,
  FaSyncAlt,
  FaCheckCircle,
} from "react-icons/fa";

export default function TermsPage() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-black via-gray-900 to-black text-white flex flex-col items-center justify-center font-sans px-2">
      <div className="relative w-full max-w-2xl mx-auto mt-6 mb-8 px-1 sm:px-4">
        {/* Floating Blobs */}
        <div className="absolute -top-20 -left-20 w-32 h-32 sm:w-48 sm:h-48 md:w-60 md:h-60 bg-gradient-to-br from-gray-700 via-gray-900 to-black rounded-full opacity-30 blur-2xl z-0 animate-pulse" />
        <div className="absolute -bottom-20 -right-20 w-32 h-32 sm:w-48 sm:h-48 md:w-60 md:h-60 bg-gradient-to-tr from-gray-700 via-gray-900 to-black rounded-full opacity-30 blur-2xl z-0 animate-pulse" />

        <div className="relative z-10 rounded-xl sm:rounded-2xl md:rounded-3xl shadow-2xl border border-white/10 bg-gradient-to-br from-gray-900/80 via-black/90 to-gray-800/80 backdrop-blur-2xl overflow-hidden">
          {/* Header */}
          <header className="w-full text-center py-6 px-2 sm:py-8 sm:px-6 bg-gradient-to-br from-black/80 via-gray-900/80 to-gray-800/80 border-b border-white/10">
            <h1 className="text-xl sm:text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent drop-shadow-lg mb-2 flex items-center justify-center gap-2 sm:gap-3">
              <FaLock className="inline-block text-white mb-1" /> Terms and
              Conditions
            </h1>
            <p className="text-gray-400 max-w-xl mx-auto text-sm sm:text-base">
              Please read these terms and conditions carefully before using
              American Lycetuff Confessions.
            </p>
          </header>

          <div className="p-3 sm:p-6 md:p-10 space-y-5 sm:space-y-7 md:space-y-8 text-gray-200 text-xs sm:text-sm md:text-base">
            <section>
              <h2 className="text-base sm:text-lg md:text-xl font-bold mb-2 text-white flex items-center gap-2">
                <FaCheckCircle className="text-green-400" /> 1. Acceptance of
                Terms
              </h2>
              <p>
                1.1 By accessing or using American Lycetuff Confessions, you
                agree to be bound by these Terms and Conditions and all
                applicable laws and regulations.
              </p>
              <p>
                1.2 If you do not agree with any of these terms, you are
                prohibited from using or accessing this site.
              </p>
            </section>

            <section>
              <h2 className="text-base sm:text-lg md:text-xl font-bold mb-2 text-white flex items-center gap-2">
                <FaUserShield className="text-blue-400" /> 2. User Conduct
              </h2>
              <p>
                2.1 You agree to use this platform only for lawful and
                respectful purposes.
              </p>
              <p>
                2.2 You must not submit any content that is abusive, hateful,
                harassing, threatening, defamatory, obscene, or otherwise
                objectionable.
              </p>
              <p>
                2.3 Do not post any personally identifiable information about
                yourself or others.
              </p>
              <p>
                2.4 Confessions containing hate speech, false rumors, or any
                illegal content will be removed and may result in a permanent
                ban.
              </p>
            </section>

            <section>
              <h2 className="text-base sm:text-lg md:text-xl font-bold mb-2 text-white flex items-center gap-2">
                <FaUserSecret className="text-purple-400" /> 3. Content
                Submission
              </h2>
              <p>
                3.1 All confessions are submitted anonymously and cannot be
                edited or deleted once posted.
              </p>
              <p>
                3.2 By submitting a confession, you grant us the right to use,
                display, and moderate your content as necessary.
              </p>
            </section>

            <section>
              <h2 className="text-base sm:text-lg md:text-xl font-bold mb-2 text-white flex items-center gap-2">
                <FaUserSecret className="text-pink-400" /> 3a. Identity
                Disclosure (Optional)
              </h2>
              <p>
                3a.1 If you choose to reveal your Instagram username, you confirm
                its accuracy and accept full responsibility for any consequences.
              </p>
              <p>
                3a.2 Once your confession is posted, your identity cannot be
                removed or hidden. The platform is not responsible for any
                outcomes resulting from identity disclosure.
              </p>
            </section>

            <section>
              <h2 className="text-base sm:text-lg md:text-xl font-bold mb-2 text-white flex items-center gap-2">
                <FaGavel className="text-yellow-400" /> 4. Moderation and
                Reporting
              </h2>
              <p>
                4.1 Confessions may be reported by users and reviewed by
                moderators.
              </p>
              <p>
                4.2 We reserve the right to remove any confession that violates
                these terms or is deemed inappropriate.
              </p>
              <p>
                4.3 Repeated violations may result in a permanent ban from the
                platform.
              </p>
            </section>

            <section>
              <h2 className="text-base sm:text-lg md:text-xl font-bold mb-2 text-white flex items-center gap-2">
                <FaLock className="text-gray-300" /> 5. Privacy
              </h2>
              <p>
                5.1 We do not collect personally identifiable information with
                your confession.
              </p>
              <p>
                5.2 Your IP address and device information may be logged for
                moderation and security purposes only.
              </p>
              <p>
                5.3 All confessions are anonymous and cannot be traced back to
                you.
              </p>
            </section>

            <section>
              <h2 className="text-base sm:text-lg md:text-xl font-bold mb-2 text-white flex items-center gap-2">
                <FaExclamationTriangle className="text-red-400" /> 6. Disclaimer
              </h2>
              <p>
                6.1 The views and opinions expressed in confessions are those of
                the users and do not reflect the views of American Lycetuff
                Confessions or its administrators.
              </p>
              <p>
                6.2 We are not responsible for any consequences resulting from
                the use of this platform.
              </p>
            </section>

            <section>
              <h2 className="text-base sm:text-lg md:text-xl font-bold mb-2 text-white flex items-center gap-2">
                <FaSyncAlt className="text-cyan-400" /> 7. Changes to Terms
              </h2>
              <p>
                7.1 We reserve the right to update or modify these Terms and
                Conditions at any time without prior notice.
              </p>
              <p>
                7.2 Your continued use of the platform constitutes acceptance of
                any changes.
              </p>
            </section>

            <section>
              <h2 className="text-base sm:text-lg md:text-xl font-bold mb-2 text-white flex items-center gap-2">
                <FaInstagram className="text-pink-400" /> 8. Contact
              </h2>
              <p>
                8.1 For any questions or concerns regarding these Terms and
                Conditions, please contact us via our{" "}
                <a
                  href="https://www.instagram.com/americanlycetuff_confession/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-300 underline hover:text-blue-400 transition"
                >
                  Instagram page
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
