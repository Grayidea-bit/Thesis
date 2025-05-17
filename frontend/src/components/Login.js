import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState(null);
  
  // Ref to ensure the code processing logic runs only once for a given code
  const processingCodeRef = useRef(null); // Stores the code being processed

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const code = query.get('code');

    // --- Scenario 1: URL has a 'code' (coming back from GitHub) ---
    if (code) {
      // Only process if this specific 'code' hasn't been processed yet
      // and if we are not currently in the middle of processing it.
      if (processingCodeRef.current !== code) {
        processingCodeRef.current = code; // Mark this code as being processed
        setError(null); // Clear previous errors
        console.log('前端收到 GitHub code:', code, '- 開始處理...');

        axios
          .get(`http://localhost:8000/auth/github/callback?code=${code}`, {
            headers: { Accept: 'application/json' },
          })
          .then((response) => {
            console.log('後端 /auth/github/callback 回應:', JSON.stringify(response.data, null, 2));
            const { access_token, user } = response.data;
            if (access_token && user && user.login) {
              localStorage.setItem('access_token', access_token);
              localStorage.setItem('user', JSON.stringify(user));
              console.log('成功儲存 access_token 和 user。準備跳轉到 /repos');
              // Successful login, navigate to repos.
              // replace: true is important to remove the ?code=... from history
              navigate('/repos', { replace: true }); 
            } else {
              console.error('後端回應格式錯誤，缺少 access_token 或 user.login:', response.data);
              setError('GitHub 授權成功，但從伺服器獲取用戶資訊失敗，請重試。');
              processingCodeRef.current = null; // Allow reprocessing if format was wrong but code might be reusable (unlikely)
            }
          })
          .catch((err) => {
            console.error('GitHub 回調處理失敗:', {
              status: err.response?.status,
              data: err.response?.data,
              message: err.message,
            });
            let errorMsg = 'GitHub 驗證過程中發生錯誤，請稍後重試。';
            if (err.response?.data?.detail) {
                errorMsg = `GitHub 驗證失敗: ${err.response.data.detail}`;
            } else if(err.message) {
                errorMsg = `GitHub 驗證失敗: ${err.message}`;
            }
            setError(errorMsg);
            processingCodeRef.current = null; // Reset if processing failed, to allow potential retry by user clicking login again
          });
      } else {
        // This means the effect ran again with the same code, possibly due to re-render or strict mode.
        // Or user refreshed the page with the same code in URL.
        // If already processing or processed, do nothing to avoid multiple requests with the same code.
        console.log('偵測到相同的 code，可能正在處理中或已處理，本次跳過。Code:', code);
      }
    } 
    // --- Scenario 2: No 'code' in URL, check if already logged in via localStorage ---
    else {
      const accessToken = localStorage.getItem('access_token');
      const userString = localStorage.getItem('user');
      if (accessToken && userString) {
        try {
          const parsedUser = JSON.parse(userString);
          if (parsedUser && parsedUser.login) {
            console.log('偵測到 localStorage 中有有效登入狀態，跳轉到 /repos');
            navigate('/repos', { replace: true });
          } else {
            // Invalid user data in localStorage, clear it
            console.error('localStorage 中的 user 格式無效，清除登入資訊。', parsedUser);
            localStorage.removeItem('access_token');
            localStorage.removeItem('user');
            // No error set here, user just stays on login page
          }
        } catch (e) {
          console.error('解析 localStorage 中的 user 失敗，清除登入資訊。', e);
          localStorage.removeItem('access_token');
          localStorage.removeItem('user');
          // No error set here
        }
      } else {
        console.log('無 code 且 localStorage 中無有效登入資訊，停留在登入頁面。');
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, navigate]); // Rerun effect if ?code=... changes or navigate function instance changes

  const handleLogin = () => {
    setError(null); // Clear previous errors when initiating a new login
    processingCodeRef.current = null; // Reset processing state for a new login attempt
    console.log('開始 GitHub 登入流程...');
    
    const clientId = process.env.REACT_APP_GITHUB_CLIENT_ID;
    if (!clientId) {
      console.error('錯誤: REACT_APP_GITHUB_CLIENT_ID 未在 .env 文件中設置。');
      setError('前端應用程式配置錯誤，請聯繫管理員。');
      return;
    }
    
    // 確保 redirectUri 與後端以及 GitHub OAuth App 中配置的完全一致
    // 結尾的斜線 '/' 可能很重要，取決於 GitHub OAuth App 的設定
    const redirectUri = 'http://localhost:3000'; 
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo%20user`;
    
    console.log('將跳轉到 GitHub 授權頁面:', githubAuthUrl);
    window.location.href = githubAuthUrl;
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '50px', fontFamily: 'Arial, sans-serif', padding: '20px' }}>
      <div style={{ backgroundColor: '#f8f9fa', padding: '40px', borderRadius: '10px', display: 'inline-block', boxShadow: '0 6px 12px rgba(0,0,0,0.15)' }}>
        <h1 style={{ color: '#343a40', marginBottom: '25px', fontSize: '28px' }}>GitHub Commit 分析器</h1>
        <p style={{color: '#495057', marginBottom: '35px', fontSize: '16px'}}>使用您的 GitHub 帳號登入以分析您的倉庫。</p>
        {error && (
          <div 
            style={{ 
              color: '#721c24', 
              backgroundColor: '#f8d7da', 
              borderColor: '#f5c6cb',
              padding: '12px 20px', 
              marginBottom: '25px', 
              borderRadius: '5px',
              border: '1px solid transparent',
              textAlign: 'left'
            }}
          >
            <strong>錯誤:</strong> {error}
          </div>
        )}
        <button
          onClick={handleLogin}
          style={{
            backgroundColor: '#007bff', // Blue
            color: 'white',
            padding: '12px 30px',
            border: 'none',
            borderRadius: '5px',
            fontSize: '17px',
            cursor: 'pointer',
            transition: 'background-color 0.2s ease-in-out, transform 0.1s ease',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#0056b3'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#007bff'}
          onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
          onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          使用 GitHub 登入
        </button>
      </div>
    </div>
  );
}

export default Login;