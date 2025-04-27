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
        setError('無法載入倉庫，請重試或重新登入');
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
      const response = await axios.get(`http://localhost:8000/repos/${owner}/${repo}/commits`, {
        params: { access_token: accessToken },
      });
      console.log('Commits 資料:', response.data);
      setCommits(response.data);
      setSelectedRepo(repo);
      setError(null);
      setDiff(null);
    } catch (error) {
      console.error('無法獲取 commits:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      setError('無法載入 Commits，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const fetchDiff = async (owner, repo, sha) => {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      console.error('無 access_token，無法獲取 diff');
      setError('未找到 Access Token，請重新登入');
      navigate('/', { replace: true });
      return;
    }

    try {
      setLoading(true);
      console.log('獲取 diff:', owner, repo, sha);
      const response = await axios.get(`http://localhost:8000/repos/${owner}/${repo}/commits/${sha}/diff`, {
        params: { access_token: accessToken },
      });
      console.log('Diff 資料:', response.data);
      // 解析 diff 按檔案分割
      const diffFiles = parseDiffByFile(response.data.diff);
      setDiff(diffFiles);
      setError(null);
    } catch (error) {
      console.error('無法獲取 diff:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      setError('無法載入 Diff，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  // 解析 diff 按檔案分割
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
    window.location.reload();
  };

  if (loading) return <div style={{ padding: '20px' }}>載入中...</div>;
  if (error) {
    return (
      <div style={{ padding: '20px' }}>
        <div style={{ color: 'red' }}>錯誤: {error}</div>
        <button onClick={handleRetry} style={{ marginRight: '10px' }}>
          重試
        </button>
        <button
          onClick={() => {
            localStorage.clear();
            navigate('/', { replace: true });
          }}
        >
          重新登入
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      <h1>歡迎, {user?.login || '用戶'}</h1>
      <h2>你的倉庫</h2>
      <ul>
        {repos.map((repo) => (
          <li key={repo.id}>
            <a href={repo.html_url} target="_blank" rel="noopener noreferrer">
              {repo.name}
            </a>
            <button onClick={() => fetchCommits(repo.owner.login, repo.name)} style={{ marginLeft: '10px' }}>
              查看 Commits
            </button>
          </li>
        ))}
      </ul>
      {selectedRepo && (
        <div>
          <h3>{selectedRepo} 的 Commits</h3>
          <ul>
            {commits.map((commit) => (
              <li key={commit.sha}>
                <strong>{commit.commit.message || '無提交訊息'}</strong> - 由 {commit.commit.author.name} 於{' '}
                {new Date(commit.commit.author.date).toLocaleString()} 提交
                <button
                  onClick={() => fetchDiff(user.login, selectedRepo, commit.sha)}
                  style={{ marginLeft: '10px' }}
                >
                  查看變更 (Diff)
                </button>
              </li>
            ))}
          </ul>
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
          <button
            onClick={() => setDiff(null)}
            style={{ marginTop: '10px' }}
          >
            關閉 Diff
          </button>
        </div>
      )}
    </div>
  );
}

export default Repos;