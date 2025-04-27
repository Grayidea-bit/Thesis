import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { solarizedlight } from 'react-syntax-highlighter/dist/esm/styles/prism';

function Repos() {
  const [repos, setRepos] = useState([]);
  const [commits, setCommits] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [diff, setDiff] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [overview, setOverview] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    const accessToken = localStorage.getItem('access_token');
    console.log('檢查 localStorage:', { accessToken, user });
    if (!accessToken || !user || !user.login) {
      console.error('無效的 access_token 或 user:', { accessToken, user });
      setError('未找到 Access Token 或用戶資訊，請重新登入');
      setLoading(false);
      navigate('/', { replace: true });
      return;
    }

    const fetchRepos = async () => {
      try {
        console.log('使用 token 獲取倉庫:', accessToken);
        const response = await axios.get('http://localhost:8000/repos', {
          params: { access_token: accessToken },
        });
        console.log('倉庫資料:', response.data);
        setRepos(response.data);
        setLoading(false);
      } catch (error) {
        console.error('無法獲取倉庫:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
        setError(`無法載入倉庫：${error.response?.data?.detail || error.message}`);
        setLoading(false);
      }
    };

    fetchRepos();
  }, [navigate]);

  const fetchCommits = async (owner, repo) => {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      console.error('無 access_token，無法獲取 commits');
      setError('未找到 Access Token，請重新登入');
      navigate('/', { replace: true });
      return;
    }

    try {
      setLoading(true);
      console.log('獲取 commits:', owner, repo);
      // 獲取 commits
      const commitsResponse = await axios.get(`http://localhost:8000/repos/${owner}/${repo}/commits`, {
        params: { access_token: accessToken },
      });
      console.log('Commits 資料:', commitsResponse.data);
      setCommits(commitsResponse.data);
      setSelectedRepo({ owner, name: repo });
      setError(null);
      setDiff(null);
      setAnalysis(null);

      // 獨立獲取 overview
      try {
        const overviewResponse = await axios.get(`http://localhost:8000/repos/${owner}/${repo}/overview`, {
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
        setOverview(null); // 允許 commits 顯示，即使概覽失敗
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
      setLoading(false);
    }
  };

  const fetchDiffAndAnalyze = async (owner, repo, sha) => {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      console.error('無 access_token，無法獲取 diff');
      setError('未找到 Access Token，請重新登入');
      navigate('/', { replace: true });
      return;
    }

    try {
      setLoading(true);
      console.log('獲取 diff 和分析:', owner, repo, sha);
      const response = await axios.post(
        `http://localhost:8000/repos/${owner}/${repo}/commits/${sha}/analyze`,
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
    } finally {
      setLoading(false);
    }
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken || !selectedRepo) {
      setError('請選擇一個倉庫並確保已登入');
      return;
    }

    try {
      setLoading(true);
      console.log('提交對話問題:', chatInput);
      const response = await axios.post(
        `http://localhost:8000/repos/${selectedRepo.owner}/${selectedRepo.name}/chat`,
        {},
        { params: { access_token: accessToken, question: chatInput } }
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
      setError(`無法提交問題：${error.response?.data?.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  };

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

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    setDiff(null);
    setAnalysis(null);
    setOverview(null);
    setChatHistory([]);
    window.location.reload();
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/', { replace: true });
  };

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>載入中...</div>;
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

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>歡迎, {user?.login || '用戶'}</h1>
        <button onClick={handleLogout} style={{ padding: '10px 20px' }}>
          登出
        </button>
      </div>
      <h2>你的倉庫</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {repos.map((repo) => (
          <li key={repo.id} style={{ margin: '10px 0' }}>
            <a href={repo.html_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: '#0366d6' }}>
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
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {commits.map((commit) => (
              <li key={commit.sha} style={{ margin: '10px 0' }}>
                <strong>{commit.commit.message || '無提交訊息'}</strong> - 由 {commit.commit.author.name} 於{' '}
                {new Date(commit.commit.author.date).toLocaleString()} 提交
                <button
                  onClick={() => fetchDiffAndAnalyze(selectedRepo.owner, selectedRepo.name, commit.sha)}
                  style={{ marginLeft: '10px', padding: '5px 10px' }}
                >
                  查看變更與分析
                </button>
              </li>
            ))}
          </ul>
          <div style={{ marginTop: '20px', background: '#f9f9f9', padding: '15px', borderRadius: '5px' }}>
            <h3>與 Gemini 對話</h3>
            <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '10px' }}>
              {chatHistory.map((item, index) => (
                <div key={index} style={{ marginBottom: '10px' }}>
                  <strong>你:</strong> {item.question}
                  <br />
                  <strong>Gemini:</strong> {item.answer}
                </div>
              ))}
            </div>
            <form onSubmit={handleChatSubmit}>
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="輸入有關這個倉庫的問題..."
                style={{ width: '100%', minHeight: '60px', marginBottom: '10px', padding: '5px' }}
              />
              <button type="submit" style={{ padding: '10px 20px' }}>
                提交問題
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