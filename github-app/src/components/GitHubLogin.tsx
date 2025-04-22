import { useState } from "react";
import "../styles/tailwind.css"

const CLIENT_ID = "Ov23li56CKrX18dJODju"; // from GitHub Developer Settings
const REDIRECT_URI = "http://localhost:8000/github/callback/"; // your Django endpoint

const GitHubLogin = () => {
  const [isLoading, setIsLoading] = useState(false);
  
  // 建立 GitHub OAuth URL
  const githubAuthURL = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
    REDIRECT_URI
  )}&scope=read:user%20user:email%20repo`;

  const handleLogin = () => {
    setIsLoading(true);
    // Redirect user to GitHub login
    window.location.href = githubAuthURL;
  };

  return (
    <div>
      <button
        onClick={handleLogin}
        disabled={isLoading}
        className="flex items-center justify-center gap-2 bg-[#24292F] text-white font-medium py-3 px-8 rounded-lg 
                   shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 
                   focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#24292F] focus:ring-purple-500
                   disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none" 
        aria-label="Sign in with GitHub"
      >
        {isLoading ? (
          <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
        )}
        <span>{isLoading ? "Connecting..." : "Sign in with GitHub"}</span>
      </button>
    </div>
  );
};

export default GitHubLogin;
