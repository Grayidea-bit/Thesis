import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState(null);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const code = query.get('code');

    if (code && !isProcessingRef.current) {
      isProcessingRef.current = true;
      console.log('前端收到 GitHub code:', code);
      axios
        .get(`http://localhost:8000/auth/github/callback?code=${code}`, {
          headers: { Accept: 'application/json' },
        })
        .then((response) => {
          console.log('後端回應:', JSON.stringify(response.data, null, 2));
          const { access_token, user } = response.data;
          if (access_token && user && user.login) {
            localStorage.setItem('access_token', access_token);
            localStorage.setItem('user', JSON.stringify(user));
            console.log('已儲存 access_token 和 user:', { access_token, user });
            navigate('/repos', { replace: true });
          } else {
            console.error('回應格式錯誤，缺少 access_token 或 user.login:', response.data);
            setError('GitHub 驗證失敗，請重試');
          }
        })
        .catch((error) => {
          console.error('GitHub 驗證失敗:', {
            status: error.response?.status,
            data: error.response?.data,
            message: error.message,
          });
          setError(`GitHub 驗證失敗: ${error.message}`);
        });
    } else if (!code) {
      console.log('無 code 參數，檢查登入狀態');
      const accessToken = localStorage.getItem('access_token');
      const user = localStorage.getItem('user');
      if (accessToken && user) {
        try {
          const parsedUser = JSON.parse(user);
          if (parsedUser.login) {
            console.log('檢測到有效登入狀態，跳轉到 /repos');
            navigate('/repos', { replace: true });
          } else {
            console.error('user 格式無效:', user);
            setError('用戶數據無效，請重新登入');
          }
        } catch (e) {
          console.error('解析 user 失敗:', e);
          setError('用戶數據解析失敗，請重新登入');
        }
      } else {
        console.log('無有效登入狀態，保持在登入頁面');
      }
    }
  }, [location, navigate]);

  const handleLogin = () => {
    console.log('開始 GitHub 登入');
    const clientId = process.env.REACT_APP_GITHUB_CLIENT_ID;
    if (!clientId) {
      console.error('未設置 REACT_APP_GITHUB_CLIENT_ID');
      setError('前端環境變數配置錯誤，請聯繫管理員');
      return;
    }
    const redirectUri = 'http://localhost:3000';
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=repo%20user`;
    window.location.href = githubAuthUrl;
  };

  return (
    <div>
      <h1>GitHub LLM App</h1>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <button onClick={handleLogin}>Login with GitHub</button>
    </div>
  );
}

export default Login;