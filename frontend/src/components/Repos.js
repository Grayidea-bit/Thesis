import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { solarizedlight } from 'react-syntax-highlighter/dist/esm/styles/prism';

// 配置 API 基礎 URL（建議在 .env 文件中設置，例如 process.env.REACT_APP_API_URL）
const API_BASE_URL = 'http://localhost:8000';

/**
 * Repos 組件：顯示用戶的 GitHub 倉庫、Commits 和對話功能
 * @returns {JSX.Element} 倉庫列表和交互界面
 */
function Repos() {
  const [repos, setRepos] = useState([]);
  const [commits, setCommits] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [selectedCommits, setSelectedCommits] = useState([]); // 跟踪選擇的 commits
  const [loading, setLoading] = useState({ repos: true, commits: false, chat: false }); // 細化加載狀態
  const [error, setError] = useState(null);
  const [diff, setDiff] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [overview, setOverview] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]); // 格式：[{role: "user", parts: "..."}, {role: "model", parts: "..."}]
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  /**
   * 初始化：檢查用戶登錄狀態並獲取倉庫列表
   */
  useEffect(() => {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken || !user || !user.login) {
      console.error('無效的 access_token 或 user:', { accessToken, user });
      setError('未找到 Access Token 或用戶資訊，請重新登入');
      setLoading((prev) => ({ ...prev, repos: false }));
      navigate('/', { replace: true });
      return;
    }

    const fetchRepos = async () => {
      try {
        console.log('使用 token 獲取倉庫:', accessToken);
        const response = await axios.get(`${API_BASE_URL}/repos`, {
          params: { access_token: accessToken },
        });
        console.log('倉庫資料:', response.data);
        setRepos(response.data);
        setLoading((prev) => ({ ...prev, repos: false }));
      } catch (error) {
        console.error('無法獲取倉庫:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
        setError(`無法載入倉庫：${error.response?.data?.detail || error.message}`);
        setLoading((prev) => ({ ...prev, repos: false }));
        if (error.response?.status === 401) {
          localStorage.clear();
          navigate('/', { replace: true });
        }
      }
    };

    fetchRepos();
  }, [navigate]);

  /**
   * 獲取指定倉庫的 commits 和概覽
   * @param {string} owner - 倉庫擁有者的登錄名
   * @param {string} repo - 倉庫名稱
   */
  const fetchCommits = async (owner, repo) => {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      console.error('無 access_token，無法獲取 commits');
      setError('未找到 Access Token，請重新登入');
      navigate('/', { replace: true });
      return;
    }

    try {
      setLoading((prev) => ({ ...prev, commits: true }));
      console.log('獲取 commits:', owner, repo);
      const commitsResponse = await axios.get(`${API_BASE_URL}/repos/${owner}/${repo}/commits`, {
        params: { access_token: accessToken },
      });
      console.log('Commits 資料:', commitsResponse.data);
      setCommits(commitsResponse.data);
      setSelectedRepo({ owner, name: repo });
      setSelectedCommits([]); // 重置選擇的 commits
      setError(null);
      setDiff(null);
      setAnalysis(null);

      try {
        const overviewResponse = await axios.get(`${API_BASE_URL}/repos/${owner}/${repo}/overview`, {
          params: { access_token: accessToken },
        });
        setOverview(overviewResponse.data.overview);
      } catch (overviewError) {
        console.error('無法獲取概覽:', {
          status: overviewError.response?.status,
          data: overviewError.response?.data,
          message: overviewError.message,
        });
        setError(`無法載入概覽：${overviewError.response?.data?.detail || overviewError.message}`);
        setOverview(null);
      }

      setChatHistory([]);
    } catch (error) {
      console.error('無法獲取 commits:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      setError(`無法載入 Commits：${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading((prev) => ({ ...prev, commits: false }));
    }
  };

  /**
   * 獲取指定 commit 的 diff 和分析
   * @param {string} owner - 倉庫擁有者的登錄名
   * @param {string} repo - 倉庫名稱
   * @param {string} sha - Commit 的 SHA
   */
  const fetchDiffAndAnalyze = async (owner, repo, sha) => {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      console.error('無 access_token，無法獲取 diff');
      setError('未找到 Access Token，請重新登入');
      navigate('/', { replace: true });
      return;
    }

    try {
      setLoading((prev) => ({ ...prev, commits: true }));
      console.log('獲取 diff 和分析:', owner, repo, sha);
      const response = await axios.post(
        `${API_BASE_URL}/repos/${owner}/${repo}/commits/${sha}/analyze`,
        {},
        { params: { access_token: accessToken } }
      );
      console.log('Diff 和分析資料:', response.data);
      const diffFiles = parseDiffByFile(response.data.diff);
      setDiff(diffFiles);
      setAnalysis(response.data.analysis);
      setOverview(response.data.overview);
      setError(null);
    } catch (error) {
      console.error('無法獲取 diff 或分析:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      const errorMessage = error.response?.data?.detail
        ? `伺服器錯誤：${error.response.data.detail}`
        : `無法載入 Diff 或分析：${error.message}`;
      setError(errorMessage);
      if (error.response?.status === 401) {
        localStorage.clear();
        navigate('/', { replace: true });
      }
    } finally {
      setLoading((prev) => ({ ...prev, commits: false }));
    }
  };

  /**
   * 處理 commit 選擇
   * @param {string} sha - Commit 的 SHA
   */
  const handleCommitSelection = (sha) => {
    setSelectedCommits((prev) =>
      prev.includes(sha) ? prev.filter((id) => id !== sha) : [...prev, sha]
    );
  };

  /**
   * 提交對話問題
   * @param {Event} e - 表單提交事件
   */
  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken || !selectedRepo) {
      setError('請選擇一個倉庫並確保已登入');
      return;
    }
    if (!selectedCommits.length) {
      setError('請至少選擇一個 Commit 進行對話');
      return;
    }

    try {
      setLoading((prev) => ({ ...prev, chat: true }));
      console.log('提交對話問題:', chatInput, '選擇的 commits:', selectedCommits);
      const response = await axios.post(
        `${API_BASE_URL}/repos/${selectedRepo.owner}/${selectedRepo.name}/chat`,
        {
          commits: selectedCommits,
          question: chatInput,
          history: chatHistory,
        },
        { params: { access_token: accessToken } }
      );
      console.log('對話回應:', response.data);
      setChatHistory(response.data.history);
      setChatInput('');
      setError(null);
    } catch (error) {
      console.error('無法提交問題:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      const errorMessage = error.response?.data?.detail
        ? `無法提交問題：${error.response.data.detail}`
        : `無法提交問題：${error.message}`;
      setError(errorMessage);
      if (error.response?.status === 401) {
        localStorage.clear();
        navigate('/', { replace: true });
      }
    } finally {
      setLoading((prev) => ({ ...prev, chat: false }));
    }
  };

  /**
   * 解析 diff 按文件分組
   * @param {string} diff - 原始 diff 字符串
   * @returns {Array} 按文件分組的 diff 數組
   */
  const parseDiffByFile = (diff) => {
    const files = [];
    let currentFile = null;
    const lines = diff.split('\n');
    for (const line of lines) {
      if (line.startsWith('diff --git')) {
        if (currentFile) files.push(currentFile);
        currentFile = { header: line, content: [] };
      } else if (currentFile) {
        currentFile.content.push(line);
      }
    }
    if (currentFile) files.push(currentFile);
    return files;
  };

  /**
   * 重試當前操作
   */
  const handleRetry = () => {
    setError(null);
    setDiff(null);
    setAnalysis(null);
    setOverview(null);
    setChatHistory([]);
    setSelectedCommits([]);
    if (selectedRepo) {
      fetchCommits(selectedRepo.owner, selectedRepo.name);
    } else {
      window.location.reload();
    }
  };

  /**
   * 登出並清除本地存儲
   */
  const handleLogout = () => {
    localStorage.clear();
    navigate('/', { replace: true });
  };

  // 渲染加載狀態
  if (loading.repos) return <div style={{ padding: '20px', textAlign: 'center' }}>載入倉庫中...</div>;

  // 渲染錯誤狀態
  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ color: 'red', marginBottom: '10px' }}>錯誤: {error}</div>
        <button onClick={handleRetry} style={{ marginRight: '10px', padding: '10px 20px' }}>
          重試
        </button>
        <button onClick={handleLogout} style={{ padding: '10px 20px' }}>
          重新登入
        </button>
      </div>
    );
  }

  // 主渲染
  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>{user?.login || '用戶'}</h1>
        <button onClick={handleLogout} style={{ padding: '10px 20px' }}>
          登出
        </button>
      </div>
      <h2>倉庫列表</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {repos.map((repo) => (
          <li key={repo.id} style={{ margin: '10px 0' }}>
            <a
              href={repo.html_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: 'none', color: '#0366d6' }}
            >
              {repo.name}
            </a>
            <button
              onClick={() => fetchCommits(repo.owner.login, repo.name)}
              style={{ marginLeft: '10px', padding: '5px 10px' }}
            >
              查看 Commits
            </button>
          </li>
        ))}
      </ul>
      {selectedRepo && (
        <div>
          {overview && (
            <div style={{ marginBottom: '20px', background: '#f9f9f9', padding: '15px', borderRadius: '5px' }}>
              <h3>程式碼功能概覽</h3>
              <div style={{ whiteSpace: 'pre-wrap' }}>{overview}</div>
            </div>
          )}
          <h3>{selectedRepo.owner}/{selectedRepo.name} 的 Commits</h3>
          {loading.commits ? (
            <div style={{ textAlign: 'center' }}>載入 Commits 中...</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {commits.map((commit) => (
                <li key={commit.sha} style={{ margin: '10px 0', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={selectedCommits.includes(commit.sha)}
                    onChange={() => handleCommitSelection(commit.sha)}
                    style={{ marginRight: '10px' }}
                  />
                  <div>
                    <strong>{commit.message || '無提交訊息'}</strong> - 由 {commit.commit?.committer?.name || '未知'} 於{' '}
                    {new Date(commit.date).toLocaleString()} 提交
                    <button
                      onClick={() => fetchDiffAndAnalyze(selectedRepo.owner, selectedRepo.name, commit.sha)}
                      style={{ marginLeft: '10px', padding: '5px 10px' }}
                    >
                      查看變更與分析
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div style={{ marginTop: '20px', background: '#f9f9f9', padding: '15px', borderRadius: '5px' }}>
            <h3>與程式碼對話</h3>
            <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '10px' }}>
              {chatHistory.length === 0 ? (
                <div>尚未有對話記錄</div>
              ) : (
                chatHistory.map((item, index) => (
                  <div key={index} style={{ marginBottom: '10px' }}>
                    <strong>{item.role === 'user' ? '你' : 'Gemini'}:</strong> {item.parts}
                  </div>
                ))
              )}
            </div>
            <form onSubmit={handleChatSubmit}>
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="輸入問題..."
                style={{ width: '100%', minHeight: '60px', marginBottom: '10px', padding: '5px' }}
                disabled={loading.chat}
              />
              <button type="submit" style={{ padding: '10px 20px' }} disabled={loading.chat}>
                {loading.chat ? '提交中...' : '提交問題'}
              </button>
            </form>
          </div>
        </div>
      )}
      {diff && (
        <div>
          <h3>程式碼變更 (Diff)</h3>
          {diff.map((file, index) => (
            <div key={index} style={{ marginBottom: '20px' }}>
              <h4>{file.header.split(' ')[2].split('/').pop()}</h4>
              <SyntaxHighlighter
                language="diff"
                style={solarizedlight}
                customStyle={{
                  maxHeight: '400px',
                  overflowY: 'auto',
                  padding: '15px',
                  borderRadius: '5px',
                  fontSize: '14px',
                  lineHeight: '1.5',
                }}
              >
                {file.content.join('\n')}
              </SyntaxHighlighter>
            </div>
          ))}
          {analysis && (
            <div style={{ marginTop: '20px' }}>
              <h3>變更分析 (由 Gemini 提供)</h3>
              <div
                style={{
                  background: '#f9f9f9',
                  padding: '15px',
                  borderRadius: '5px',
                  maxHeight: '400px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {analysis}
              </div>
            </div>
          )}
          <button
            onClick={() => {
              setDiff(null);
              setAnalysis(null);
            }}
            style={{ marginTop: '10px', padding: '10px 20px' }}
          >
            關閉 Diff 與分析
          </button>
        </div>
      )}
    </div>
  );
}

export default Repos;