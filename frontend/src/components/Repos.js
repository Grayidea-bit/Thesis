import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { solarizedlight } from 'react-syntax-highlighter/dist/esm/styles/prism'; // Remove darcula since it's unused
import ReactMarkdown from 'react-markdown';

// Move syntaxStyle outside component to make it available to markdownComponents
const syntaxStyle = solarizedlight;

function Repos() {
  const [repos, setRepos] = useState([]);
  const [commits, setCommits] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [loading, setLoading] = useState(true); // General loading for initial repo fetch
  const [repoLoading, setRepoLoading] = useState(false); // Loading for commits, overview, chat of a selected repo
  const [analysisLoading, setAnalysisLoading] = useState(false); // Loading for diff and analysis
  const [chatLoading, setChatLoading] = useState(false); // Loading for chat submissions


  const [error, setError] = useState(null);
  const [diff, setDiff] = useState(null); // Parsed diff files for current commit
  const [previousDiff, setPreviousDiff] = useState(null); // Parsed diff files for previous commit
  const [analysis, setAnalysis] = useState(null);
  const [commitNumber, setCommitNumber] = useState(null);
  const [previousCommitNumber, setPreviousCommitNumber] = useState(null);
  const [overview, setOverview] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  
  // New state for chat context
  const [contextCommitSha, setContextCommitSha] = useState(null);
  const [contextCommitInfo, setContextCommitInfo] = useState(null); // To store {sha, number, message} for display

  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleApiError = (error, contextMessage = "操作") => {
    // Centralized error handling
    if (error.response) {
      if (error.response.status === 401) {
        console.error(`權杖錯誤 (${contextMessage}):`, error.response.data.detail);
        localStorage.clear();
        navigate('/', { replace: true });
        setError('您的登入已過期或無效，請重新登入。');
        return true;
      }
      if (error.response.status === 429) {
        const retryAfter = error.response.headers['retry-after'] || 60;
        const minutes = Math.ceil(retryAfter / 60);
        const specificMessage = error.response.data.detail || `Gemini API 使用量已達限制，請 ${minutes} 分鐘後再試。`;
        setError(specificMessage);
        console.error(`API 速率限制 (${contextMessage}):`, specificMessage);
        return true;
      }
      const detail = error.response.data?.detail || error.message;
      setError(`執行 ${contextMessage} 失敗：${detail}`);
      console.error(`API 錯誤 (${contextMessage}):`, detail);
    } else {
      setError(`執行 ${contextMessage} 時發生網路或未知錯誤：${error.message}`);
      console.error(`網路/未知錯誤 (${contextMessage}):`, error.message);
    }
    return false; // Indicates error was not a 401 or 429 that was fully handled by this function alone
  };


  useEffect(() => {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken || !user || !user.login) {
      setError('未找到 Access Token 或用戶資訊，請重新登入。');
      setLoading(false);
      navigate('/', { replace: true });
      return;
    }

    let isMounted = true; // Add mounted check to prevent state updates after unmount

    const fetchRepos = async () => {
      if (!isMounted) return; // Skip if component unmounted
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get('http://localhost:8000/repos', {
          params: { access_token: accessToken },
        });
        if (isMounted) { // Only update state if still mounted
          setRepos(response.data);
          setLoading(false);
        }
      } catch (error) {
        if (isMounted) { // Only update state if still mounted
          handleApiError(error, "載入倉庫列表");
          setLoading(false);
        }
      }
    };

    fetchRepos();

    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, []); // Empty dependency array since we only want this to run once on mount

  const fetchCommitsAndOverview = async (owner, repoName) => {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      handleApiError({ response: { status: 401, data: { detail: "Access token not found." } } }, "選擇倉庫");
      return;
    }

    setRepoLoading(true);
    setError(null);
    setDiff(null);
    setPreviousDiff(null);
    setAnalysis(null);
    setCommitNumber(null);
    setPreviousCommitNumber(null);
    setOverview(null);
    setCommits([]);
    setChatHistory([]);
    setContextCommitSha(null); // Clear specific commit context when changing repo
    setContextCommitInfo(null);

    setSelectedRepo({ owner, name: repoName });

    try {
      // Fetch commits
      const commitsResponse = await axios.get(`http://localhost:8000/repos/${owner}/${repoName}/commits`, {
        params: { access_token: accessToken },
      });
      setCommits(commitsResponse.data || []);

      // Fetch overview (can run in parallel or sequentially)
      try {
        const overviewResponse = await axios.get(`http://localhost:8000/repos/${owner}/${repoName}/overview`, {
          params: { access_token: accessToken },
        });
        setOverview(overviewResponse.data.overview);
      } catch (overviewError) {
         // Don't let overview error block commit display
        console.warn("載入倉庫概覽失敗:", overviewError.response?.data?.detail || overviewError.message);
        if (overviewError.response?.status !== 404) { // Don't show error for "no overview" if it's just no commits/README
            handleApiError(overviewError, "載入倉庫概覽");
        } else {
            setOverview("此倉庫可能沒有足夠的初始資訊 (如首次 commit 或 README) 來生成概覽，或者概覽生成失敗。");
        }
      }

    } catch (error) {
      handleApiError(error, "載入 Commits");
      setSelectedRepo(null); // Clear selected repo on major error
    } finally {
      setRepoLoading(false);
    }
  };

  const fetchDiffAndAnalyze = async (owner, repo, sha, commitMessage) => {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      handleApiError({ response: { status: 401, data: { detail: "Access token not found." } } }, "分析 Commit");
      return;
    }
    
    setAnalysisLoading(true);
    setError(null);
    // Clear previous analysis display before loading new one
    setDiff(null);
    setPreviousDiff(null);
    setAnalysis(null);
    setCommitNumber(null);
    setPreviousCommitNumber(null);

    try {
      const response = await axios.post(
        `http://localhost:8000/repos/${owner}/${repo}/commits/${sha}/analyze`,
        {}, // Empty body for POST, params are query params
        { params: { access_token: accessToken } }
      );
      const diffFiles = parseDiffByFile(response.data.diff);
      setDiff(diffFiles);
      if (response.data.previous_diff) {
        const prevDiffFiles = parseDiffByFile(response.data.previous_diff);
        setPreviousDiff(prevDiffFiles);
      } else {
        setPreviousDiff(null);
      }
      setAnalysis(response.data.analysis);
      setCommitNumber(response.data.commit_number);
      setPreviousCommitNumber(response.data.previous_commit_number);
      
      // Set this commit as the context for chat
      setContextCommitSha(sha);
      setContextCommitInfo({ // Store more info for display
        sha: sha,
        number: response.data.commit_number,
        message: commitMessage || `Commit ${sha.substring(0,7)}`
      });

    } catch (error) {
      handleApiError(error, "載入 Diff 或分析");
      setContextCommitSha(null); // Clear context if analysis fails
      setContextCommitInfo(null);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedRepo) {
      setError(!selectedRepo ? '請先選擇一個倉庫。' : '請輸入問題。');
      return;
    }
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      handleApiError({ response: { status: 401, data: { detail: "Access token not found." } } }, "提交問題");
      return;
    }

    const currentQuestion = chatInput;
    setChatInput(''); 
    // Optimistically add user's message
    setChatHistory(prevHistory => [...prevHistory, { type: 'user', content: currentQuestion }]);
    setChatLoading(true);
    setError(null);

    const params = {
        access_token: accessToken,
        question: currentQuestion,
    };
    if (contextCommitSha) { // If a specific commit context is set for chat
        params.target_sha = contextCommitSha;
    }

    try {
      const response = await axios.post(
        `http://localhost:8000/repos/${selectedRepo.owner}/${selectedRepo.name}/chat`,
        {},
        { params: params }
      );
      
      const flatHistory = [];
      if (response.data && response.data.history) {
        response.data.history.forEach(qaPair => {
          if (qaPair.question) { 
            flatHistory.push({ type: 'user', content: qaPair.question });
          }
          if (qaPair.answer !== undefined && qaPair.answer !== null) { 
            flatHistory.push({ type: 'ai', content: qaPair.answer });
          }
        });
      }
      setChatHistory(flatHistory);

    } catch (error) {
      handleApiError(error, "提交聊天問題"); // Remove unused variable assignment
      setChatHistory(prevHistory => {
        const errorMessage = error.response?.data?.detail || error.message || "回答時發生未知錯誤。";
        const newHistory = [...prevHistory];
        return [...newHistory, { type: 'ai', content: `抱歉，回答時發生錯誤：${errorMessage}` }];
      });
    } finally {
      setChatLoading(false);
    }
  };
  
  const handleClearChatContext = () => {
    setContextCommitSha(null);
    setContextCommitInfo(null);
    setError(null); 
  };

  const parseDiffByFile = (diffText) => {
    if (!diffText || typeof diffText !== 'string') return [];
    const files = [];
    let currentFile = null;
    const lines = diffText.split('\n');
    for (const line of lines) {
      if (line.startsWith('diff --git')) {
        if (currentFile) files.push(currentFile);
        const fileMatch = line.match(/diff --git a\/(.+) b\/(.+)/);
        let fileName = "未知檔案";
        if (fileMatch) {
            // Handle cases like a/.dev/null or b/.dev/null for new/deleted files
            const pathA = fileMatch[1];
            const pathB = fileMatch[2];
            if (pathA === '.dev/null' || pathA === '/dev/null') fileName = pathB;
            else if (pathB === '.dev/null' || pathB === '/dev/null') fileName = pathA;
            else fileName = pathA === pathB ? pathB : `${pathA} -> ${pathB}`;
        }
        currentFile = { header: line, rawContent: [], displayFileName: fileName };
      } else if (currentFile) {
        currentFile.rawContent.push(line);
      }
    }
    if (currentFile) files.push(currentFile);
    
    return files.map(file => {
        let displayHeader = file.header;
        const aPathMatch = file.header.match(/a\/([^\s]+)/);
        const bPathMatch = file.header.match(/b\/([^\s]+)/);
        const pathA = aPathMatch ? aPathMatch[1] : null;
        const pathB = bPathMatch ? bPathMatch[1] : null;

        if (file.header.includes(' new file mode')) {
            displayHeader = `新增檔案: ${pathB || file.displayFileName.split(' -> ').pop()}`;
        } else if (file.header.includes(' delete file mode')) {
            displayHeader = `刪除檔案: ${pathA || file.displayFileName.split(' -> ')[0]}`;
        } else if (file.header.includes(' rename from ')) {
             displayHeader = `重命名: ${pathA} 至 ${pathB}`;
        } else if (file.header.includes(' copy from ')) {
            displayHeader = `複製: ${pathA} 至 ${pathB}`;
        } else if (pathA && pathB && pathA === pathB) {
            displayHeader = `修改檔案: ${pathA}`;
        } else if (pathA && pathB) { // Fallback for modified if paths differ (e.g. mode change only)
            displayHeader = `修改檔案: ${pathA} (可能僅模式變更至 ${pathB})`;
        }
         else {
            displayHeader = file.displayFileName || "變更的檔案"; // Fallback
        }
        return { ...file, displayHeader: displayHeader, content: file.rawContent.join('\n') };
    });
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/', { replace: true });
  };

  if (loading) return <div style={styles.centeredMessage}>loading...</div>;
  
  if (error && repos.length === 0 && !selectedRepo) {
    return (
      <div style={styles.centeredMessage}>
        <div style={{ color: 'red', marginBottom: '20px' }}>錯誤: {error}</div>
        <button onClick={handleLogout} style={styles.button}>重新登入</button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1>GitHub Commit Analysis</h1>
        {user?.login && (
          <div style={styles.userInfo}>
            <span>歡迎, {user.login}</span>
            <img src={user.avatar_url} alt="avatar" style={styles.avatar} />
            <button onClick={handleLogout} style={{...styles.button, ...styles.logoutButton}}>登出</button>
          </div>
        )}
      </header>

      {error && !chatLoading && <div style={styles.errorBanner}>錯誤: {error} <button onClick={() => setError(null)} style={{marginLeft: '10px', background: 'none', border: '1px solid white', color: 'white', borderRadius: '3px', cursor: 'pointer'}}>關閉</button></div>}

      <main style={styles.mainContent}>
        <aside style={styles.sidebar}>
          <h2>Repos</h2>
          {repos.length === 0 && !loading && <p>未找到任何倉庫。</p>}
          <ul style={styles.repoList}>
            {repos.map((repo) => (
              <li 
                key={repo.id} 
                style={{
                    ...styles.repoListItem, 
                    ...(selectedRepo?.name === repo.name ? styles.selectedRepoItem : {})
                }}
                onClick={() => fetchCommitsAndOverview(repo.owner.login, repo.name)}
              >
                {repo.name}
                {repoLoading && selectedRepo?.name === repo.name && <span style={styles.loadingIndicator}> (載入中...)</span>}
              </li>
            ))}
          </ul>
        </aside>

        <section style={styles.contentArea}>
          {!selectedRepo && <p style={styles.placeholderText}>請從左側選擇一個倉庫以查看 Commits 和進行分析。</p>}
          
          {repoLoading && !commits.length && <div style={styles.centeredMessage}>載入 Commits 中...</div>}

          {selectedRepo && !repoLoading && (
            <div>
              <h2>{selectedRepo.owner}/{selectedRepo.name}</h2>
              
              {overview && (
                <div style={styles.card}>
                  <h3>程式碼功能概覽 (由 Gemini 提供)</h3>
                  <ReactMarkdown children={overview} components={markdownComponents}/>
                </div>
              )}

              {contextCommitInfo && (
                <div style={{ ...styles.card, backgroundColor: '#e6f7ff', borderLeft: '5px solid #1890ff', marginBottom: '15px' }}>
                  <p style={{margin: '0 0 10px 0'}}>
                    聊天上下文已設定為: <strong>Commit {contextCommitInfo.number || contextCommitInfo.sha.substring(0,7)}</strong> ({contextCommitInfo.message})
                  </p>
                  <button onClick={handleClearChatContext} style={{...styles.button, backgroundColor: '#ffc107', color: '#333'}}>
                    清除聊天上下文 (恢復為最新 Commit)
                  </button>
                </div>
              )}

              <div style={{ ...styles.card, marginTop: '20px' }}>
                <h3>talk to Gemini (關於 {contextCommitInfo ? `Commit ${contextCommitInfo.number || contextCommitInfo.sha.substring(0,7)}` : selectedRepo.name})</h3>
                <div style={styles.chatHistory}>
                  {chatHistory.length === 0 && <p style={{color: '#777', textAlign: 'center', padding: '20px 0'}}>對話歷史為空</p>}
                  {chatHistory.map((item, index) => (
                    <div key={index} style={item.type === 'user' ? styles.chatUserMessage : styles.chatAiMessage}>
                      <ReactMarkdown children={`**${item.type === 'user' ? '你' : 'Gemini'}:** ${item.content}`} components={markdownComponents} />
                    </div>
                  ))}
                  {chatLoading && <div style={{...styles.chatAiMessage, fontStyle: 'italic', color: '#555'}}>Gemini 正在思考...</div>}
                </div>
                <form onSubmit={handleChatSubmit} style={styles.chatForm}>
                  <textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={`輸入關於 ${contextCommitInfo ? `Commit ${contextCommitInfo.number || contextCommitInfo.sha.substring(0,7)}` : selectedRepo.name} 的問題...`}
                    style={styles.chatTextarea}
                    disabled={chatLoading || repoLoading}
                    rows="3"
                  />
                  <button type="submit" style={styles.button} disabled={chatLoading || repoLoading || !chatInput.trim()}>
                    {chatLoading ? '傳送中...' : '傳送'}
                  </button>
                </form>
              </div>


              <h3 style={{marginTop: '30px'}}>Commits 列表</h3>
              {commits.length === 0 && !repoLoading && <p>此倉庫沒有 Commits。</p>}
              <ul style={styles.commitList}>
                {commits.map((commit) => (
                  <li key={commit.sha} style={styles.commitListItem}>
                    <div style={{ fontWeight: 'bold' }}>{commit.commit.message || '無提交訊息'}</div>
                    <div style={styles.commitMeta}>
                      由 {commit.commit.author.name} 於{' '}
                      {new Date(commit.commit.author.date).toLocaleString()} 提交 ({commit.sha.substring(0,7)})
                    </div>
                    <button
                      onClick={() => fetchDiffAndAnalyze(selectedRepo.owner, selectedRepo.name, commit.sha, commit.commit.message)}
                      style={{...styles.button, ...styles.viewChangesButton}}
                      disabled={analysisLoading && contextCommitSha === commit.sha} 
                    >
                      {analysisLoading && contextCommitSha === commit.sha ? '分析中...' : '查看變更與分析'}
                    </button>
                  </li>
                ))}
              </ul>
              
              {analysisLoading && <div style={styles.centeredMessage}>載入分析中...</div>}

              {diff && !analysisLoading && (
                <div style={{ marginTop: '30px' }}>
                  <h3>程式碼變更與分析 (Commit {commitNumber || contextCommitSha?.substring(0,7)})</h3>
                  
                  {previousDiff && (
                    <div style={styles.card}>
                      <h4>前一個 Commit (第 {previousCommitNumber || 'N/A'} 次) 的變更摘要</h4>
                       {previousDiff.map((file, index) => (
                        <div key={`prev-${index}`} style={styles.diffFileContainer}>
                          <h5 style={styles.diffFileHeader}>{file.displayHeader}</h5>
                          <SyntaxHighlighter language="diff" style={syntaxStyle} customStyle={styles.syntaxHighlighter} showLineNumbers wrapLines>
                            {file.content}
                          </SyntaxHighlighter>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={styles.card}>
                    <h4>當前 Commit (第 {commitNumber || 'N/A'} 次) 的變更</h4>
                    {diff.map((file, index) => (
                      <div key={`curr-${index}`} style={styles.diffFileContainer}>
                        <h5 style={styles.diffFileHeader}>{file.displayHeader}</h5>
                        <SyntaxHighlighter language="diff" style={syntaxStyle} customStyle={styles.syntaxHighlighter} showLineNumbers wrapLines>
                          {file.content}
                        </SyntaxHighlighter>
                      </div>
                    ))}
                  </div>

                  {analysis && (
                    <div style={{...styles.card, backgroundColor: '#f0f8ff'}}>
                      <h3 style={{marginTop: 0}}>變更分析 (由 Gemini 提供)</h3>
                      <ReactMarkdown children={analysis} components={markdownComponents} />
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setDiff(null);
                      setPreviousDiff(null);
                      setAnalysis(null);
                      setCommitNumber(null);
                      setPreviousCommitNumber(null);
                    }}
                    style={{...styles.button, backgroundColor: '#6c757d', marginTop: '20px'}}
                  >
                    關閉 Diff 與分析顯示
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

const styles = {
  container: { padding: '0', maxWidth: '100%', margin: '0 auto', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#f4f7f6' },
  header: { backgroundColor: '#2c3e50', color: 'white', padding: '15px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  userInfo: { display: 'flex', alignItems: 'center' },
  avatar: { width: '40px', height: '40px', borderRadius: '50%', marginLeft: '10px', border: '2px solid #ecf0f1' },
  mainContent: { display: 'flex', flexGrow: 1, overflow: 'hidden' /* Prevent main content from causing page scroll */ },
  sidebar: { width: '300px', backgroundColor: '#ffffff', padding: '20px', borderRight: '1px solid #e0e0e0', overflowY: 'auto', flexShrink: 0 },
  contentArea: { flexGrow: 1, padding: '20px', overflowY: 'auto' },
  repoList: { listStyle: 'none', padding: 0 },
  repoListItem: { padding: '12px 15px', margin: '8px 0', background: '#f9f9f9', borderRadius: '5px', cursor: 'pointer', transition: 'background-color 0.2s ease, color 0.2s ease', border: '1px solid #eee', wordBreak: 'break-all' },
  selectedRepoItem: { backgroundColor: '#007bff', color: 'white', fontWeight: 'bold' },
  commitList: { listStyle: 'none', padding: 0 },
  commitListItem: { padding: '15px', margin: '10px 0', background: '#ffffff', borderRadius: '5px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  commitMeta: { fontSize: '0.9em', color: '#555', margin: '5px 0 10px 0', wordBreak: 'break-all' },
  button: { padding: '10px 18px', border: 'none', borderRadius: '5px', cursor: 'pointer', backgroundColor: '#007bff', color: 'white', transition: 'background-color 0.2s ease', fontSize: '0.95em' },
  logoutButton: { backgroundColor: '#e74c3c', marginLeft: '15px' },
  viewChangesButton: { backgroundColor: '#28a745', marginTop: '10px' },
  card: { backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', marginBottom: '20px' },
  diffFileContainer: { marginBottom: '20px', border: '1px solid #ddd', borderRadius: '5px', overflow: 'hidden' },
  diffFileHeader: { margin: 0, padding: '10px 15px', backgroundColor: '#f7f7f7', borderBottom: '1px solid #ddd', wordBreak: 'break-all', fontSize: '0.9em', fontWeight: '600' },
  syntaxHighlighter: { maxHeight: '400px', overflowY: 'auto', padding: '15px', margin:0, fontSize: '14px', lineHeight: '1.6', borderRadius: '0 0 5px 5px' },
  centeredMessage: { padding: '30px', textAlign: 'center', fontSize: '1.1em', color: '#555' },
  placeholderText: { textAlign: 'center', color: '#777', fontSize: '1.2em', marginTop: '50px' },
  errorBanner: { backgroundColor: '#d9534f', color: 'white', padding: '12px', textAlign: 'center', marginBottom: '15px', borderRadius: '5px' },
  loadingIndicator: { fontStyle: 'italic', color: '#777' }, 
  chatHistory: { maxHeight: '400px', overflowY: 'auto', marginBottom: '15px', padding: '15px', border: '1px solid #e0e0e0', borderRadius: '8px', background: '#fdfdfd', display: 'flex', flexDirection: 'column', gap: '12px' /* Added gap for spacing */ },
  chatUserMessage: { alignSelf: 'flex-end', textAlign: 'left', /* User messages also left-aligned text for readability */ padding: '10px 14px', backgroundColor: '#e6f7ff', borderRadius: '12px 12px 0 12px', marginLeft: 'auto', maxWidth: '80%', wordWrap: 'break-word', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
  chatAiMessage: { alignSelf: 'flex-start', textAlign: 'left', padding: '10px 14px', backgroundColor: '#f0f2f5', borderRadius: '12px 12px 12px 0', marginRight: 'auto', maxWidth: '80%', wordWrap: 'break-word', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' },
  chatForm: { display: 'flex', gap: '10px', alignItems: 'flex-start' },
  chatTextarea: { flexGrow: 1, padding: '10px', border: '1px solid #ccc', borderRadius: '5px', resize: 'vertical', minHeight: '50px', fontFamily: 'inherit', fontSize:'1em' },
};

const markdownComponents = {
    code({node, inline, className, children, ...props}) {
        const match = /language-(\w+)/.exec(className || '');
        return !inline && match ? (
        <SyntaxHighlighter
            children={String(children).replace(/\n$/, '')}
            style={syntaxStyle} // Now syntaxStyle is in scope
            language={match[1]}
            PreTag="div"
            customStyle={{margin: '0.5em 0', padding: '0.8em', overflowX: 'auto', borderRadius:'5px', fontSize: '0.9em'}}
            {...props}
        />
        ) : (
        <code className={className} style={{backgroundColor: 'rgba(27,31,35,.07)', padding: '.2em .4em', margin: '0', fontSize: '85%', borderRadius: '3px'}} {...props}>
            {children}
        </code>
        );
    },
    h1: ({node, children, ...props}) => <h1 style={{fontSize: '1.8em', marginTop:'0.8em', marginBottom:'0.4em', borderBottom: '1px solid #ccc', paddingBottom: '0.2em'}} {...props}>{children || 'Heading 1'}</h1>,
    h2: ({node, children, ...props}) => <h2 style={{fontSize: '1.5em', marginTop:'0.7em', marginBottom:'0.35em', borderBottom: '1px solid #eee', paddingBottom: '0.15em'}} {...props}>{children || 'Heading 2'}</h2>,
    h3: ({node, children, ...props}) => <h3 style={{fontSize: '1.3em', marginTop:'0.6em', marginBottom:'0.3em'}} {...props}>{children || 'Heading 3'}</h3>,
    ul: ({node, ...props}) => <ul style={{paddingLeft: '25px', listStyleType: 'disc', marginBottom: '0.8em', marginLeft: '0.5em'}} {...props} />, // Added marginLeft for better indent
    ol: ({node, ...props}) => <ol style={{paddingLeft: '25px', listStyleType: 'decimal', marginBottom: '0.8em', marginLeft: '0.5em'}} {...props} />, // Added marginLeft
    p: ({node, ...props}) => <p style={{lineHeight: '1.7', margin: '0 0 0.8em 0', whiteSpace: 'pre-wrap', wordWrap: 'break-word'}} {...props} />, 
    blockquote: ({node, ...props}) => <blockquote style={{borderLeft: '4px solid #007bff', paddingLeft: '15px', marginLeft: '0', color: '#444', backgroundColor: '#f8f9fa', fontStyle:'italic', margin: '0.8em 0'}} {...props} />, // Added margin
    a: ({node, children, ...props}) => <a style={{color: '#0056b3', textDecoration: 'underline'}} {...props}>{children || 'Link'}</a>,
    table: ({node, ...props}) => <table style={{borderCollapse: 'collapse', width: '100%', marginBottom: '1em', boxShadow: '0 0 5px rgba(0,0,0,0.05)'}} {...props} />,
    th: ({node, ...props}) => <th style={{border: '1px solid #ddd', padding: '10px', backgroundColor: '#f0f2f5', textAlign: 'left', fontWeight: '600'}} {...props} />,
    td: ({node, ...props}) => <td style={{border: '1px solid #ddd', padding: '10px', textAlign: 'left'}} {...props} />,
};

export default Repos;
