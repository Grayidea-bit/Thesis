
const CLIENT_ID = "Ov23li56CKrX18dJODju"; // from GitHub Developer Settings
const REDIRECT_URI = "http://localhost:8000/github/callback/"; // your Django endpoint

const GitHubLogin = () => {

  const handleLogin = () => {
    const githubAuthURL = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
      REDIRECT_URI
    )}&scope=read:user%20user:email%20repo`;

    // Redirect user to GitHub login
    window.location.href = githubAuthURL;
  };

  return (
    <button
      onClick={handleLogin}
      className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800"
    >
      Login with GitHub
    </button>
  );
};

export default GitHubLogin;
