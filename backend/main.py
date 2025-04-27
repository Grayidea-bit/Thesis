from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import httpx
import urllib.parse
import google.generativeai as genai
from google.api_core.exceptions import GoogleAPIError
from typing import Dict, List
import logging

# 配置日誌
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# 允許 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 載入環境變數
load_dotenv()
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
REDIRECT_URI = "http://localhost:3000"

# 驗證環境變數
if not all([GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GEMINI_API_KEY]):
    raise ValueError("缺少必要的環境變數，請檢查 .env 文件")

# 配置 Gemini API
genai.configure(api_key=GEMINI_API_KEY)

# 儲存對話歷史和 commit 數據
conversation_history: Dict[str, List[Dict[str, str]]] = {}
commit_number_cache: Dict[str, Dict[str, int]] = {}
commit_data_cache: Dict[str, List[Dict]] = {}  # 新增 commits 快取

# 獲取可用 Gemini 模型
def get_available_model():
    try:
        models = genai.list_models()
        preferred_models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro']
        available_models = []
        for model in models:
            model_name = model.name.split('/')[-1]
            if 'generateContent' in model.supported_generation_methods:
                available_models.append(model_name)
                if model_name in preferred_models:
                    logger.info(f"選擇優先模型: {model_name}")
                    return model_name
        if available_models:
            logger.info(f"無優先模型，選擇第一個可用模型: {available_models[0]}")
            return available_models[0]
        logger.error(f"未找到支援 generateContent 的模型，可用模型: {available_models}")
        raise HTTPException(status_code=500, detail="No supported Gemini models found")
    except GoogleAPIError as e:
        logger.error(f"無法列出 Gemini 模型: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list Gemini models: {str(e)}")

# 全局異常處理
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"未捕獲的異常: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": f"伺服器內部錯誤: {str(exc)}"},
        headers={"Access-Control-Allow-Origin": "http://localhost:3000"},
    )

# 根路徑
@app.get("/")
async def root():
    return {"message": "Welcome to the GitHub LLM API"}

# 計算 commit 序號並獲取所有 commit
async def get_commit_number_and_list(owner: str, repo: str, access_token: str) -> tuple[Dict[str, int], List[Dict]]:
    cache_key = f"{owner}/{repo}"
    if cache_key not in commit_number_cache or cache_key not in commit_data_cache:
        logger.info(f"快取未命中，獲取 commits: {cache_key}")
        commit_number_cache[cache_key] = {}
        commit_data_cache[cache_key] = []
        async with httpx.AsyncClient() as client:
            page = 1
            while True:
                try:
                    response = await client.get(
                        f"https://api.github.com/repos/{owner}/{repo}/commits",
                        headers={"Authorization": f"Bearer {access_token}"},
                        params={"per_page": 100, "page": page},
                    )
                    if response.status_code != 200:
                        logger.error(f"獲取 commits 失敗: 狀態碼 {response.status_code}, 回應 {response.text}")
                        raise HTTPException(status_code=response.status_code, detail="Failed to fetch commits")
                    page_commits = response.json()
                    if not page_commits:
                        break
                    commit_data_cache[cache_key].extend(page_commits)
                    page += 1
                except httpx.HTTPStatusError as e:
                    logger.error(f"HTTP 錯誤: {str(e)}")
                    raise HTTPException(status_code=e.response.status_code, detail=str(e))
            if not commit_data_cache[cache_key]:
                logger.info(f"倉庫 {owner}/{repo} 無 commits")
                return commit_number_cache[cache_key], []
            for i, commit in enumerate(reversed(commit_data_cache[cache_key]), 1):
                commit_number_cache[cache_key][commit["sha"]] = i
    else:
        logger.info(f"快取命中: {cache_key}")
    return commit_number_cache[cache_key], commit_data_cache[cache_key]

# GitHub OAuth 登入
@app.get("/auth/github/login")
async def github_login():
    params = {
        "client_id": GITHUB_CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "scope": "repo user",
    }
    github_auth_url = f"https://github.com/login/oauth/authorize?{urllib.parse.urlencode(params)}"
    return RedirectResponse(github_auth_url)

# GitHub OAuth 回呼
@app.get("/auth/github/callback")
async def github_callback(code: str = Query(...)):
    logger.info(f"收到 GitHub code: {code}")
    async with httpx.AsyncClient() as client:
        try:
            token_response = await client.post(
                "https://github.com/login/oauth/access_token",
                json={
                    "client_id": GITHUB_CLIENT_ID,
                    "client_secret": GITHUB_CLIENT_SECRET,
                    "code": code,
                },
                headers={"Accept": "application/json"},
            )
            token_data = token_response.json()
            logger.info(f"GitHub token 響應: {token_data}")
            access_token = token_data.get("access_token")

            if not access_token:
                error = token_data.get("error", "Unknown error")
                error_description = token_data.get("error_description", "No description provided")
                logger.error(f"Token 錯誤: {error} - {error_description}")
                raise HTTPException(status_code=400, detail=f"Failed to retrieve access token: {error_description}")

            user_response = await client.get(
                "https://api.github.com/user",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            user_data = user_response.json()
            logger.info(f"GitHub user 數據: {user_data}")

            return {
                "access_token": access_token,
                "user": {
                    "login": user_data.get("login"),
                    "avatar_url": user_data.get("avatar_url"),
                    "html_url": user_data.get("html_url"),
                },
            }
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP 錯誤: {str(e)}")
            raise HTTPException(status_code=e.response.status_code, detail=str(e))

# 獲取倉庫列表
@app.get("/repos")
async def get_repos(access_token: str = Query(...)):
    logger.info(f"收到 access_token: {access_token}")
    async with httpx.AsyncClient() as client:
        try:
            repos_response = await client.get(
                "https://api.github.com/user/repos",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if repos_response.status_code != 200:
                logger.error(f"獲取倉庫失敗: 狀態碼 {repos_response.status_code}, 回應 {repos_response.text}")
                raise HTTPException(status_code=repos_response.status_code, detail="Failed to fetch repos")
            repos_data = repos_response.json()
            logger.info(f"倉庫數據: {len(repos_data)} 個倉庫")
            return repos_data
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP 錯誤: {str(e)}")
            raise HTTPException(status_code=e.response.status_code, detail=str(e))

# 獲取指定倉庫的 commits
@app.get("/repos/{owner}/{repo}/commits")
async def get_commits(owner: str, repo: str, access_token: str = Query(...)):
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/commits",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if response.status_code != 200:
                logger.error(f"獲取 commits 失敗: 回應 {response.text}")
                raise HTTPException(status_code=response.status_code, detail="Failed to fetch commits")
            commits_data = response.json()
            return commits_data
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP 錯誤: {str(e)}")
            raise HTTPException(status_code=e.response.status_code, detail=str(e))

# 獲取倉庫初始功能概覽
@app.get("/repos/{owner}/{repo}/overview")
async def get_repo_overview(owner: str, repo: str, access_token: str = Query(...)):
    logger.info(f"收到概覽請求: owner={owner}, repo={repo}")
    async with httpx.AsyncClient() as client:
        try:
            # 獲取 commit 列表和序號
            commit_map, commits_data = await get_commit_number_and_list(owner, repo, access_token)
            if not commits_data:
                logger.info(f"倉庫 {owner}/{repo} 無 commits")
                raise HTTPException(status_code=404, detail="No commits found in repository")

            # 獲取第一次 commit
            first_commit_sha = commits_data[-1]["sha"]
            first_commit_number = commit_map.get(first_commit_sha, 0)
            if first_commit_number == 0:
                logger.error(f"無法為 SHA {first_commit_sha} 計算序號")
                raise HTTPException(status_code=404, detail="Failed to determine first commit number")

            # 獲取第一次 commit 的 diff
            diff_response = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/commits/{first_commit_sha}",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.github.v3.diff",
                },
            )
            if diff_response.status_code != 200:
                logger.error(f"獲取第一次 commit diff 失敗: {diff_response.text}")
                raise HTTPException(status_code=diff_response.status_code, detail="Failed to fetch first commit diff")
            diff_data = diff_response.text
            logger.info(f"第一次 commit diff (序號: {first_commit_number}): {diff_data[:100]}...")

            # 限制 diff 大小
            if len(diff_data) > 50000:
                logger.error(f"第一次 commit diff 過大: {len(diff_data)} 字元")
                raise HTTPException(status_code=400, detail="First commit diff too large")

            # 獲取 README
            readme_content = ""
            try:
                readme_response = await client.get(
                    f"https://api.github.com/repos/{owner}/{repo}/readme",
                    headers={"Authorization": f"Bearer {access_token}", "Accept": "application/vnd.github.raw"},
                )
                if readme_response.status_code == 200:
                    readme_content = readme_response.text
                else:
                    logger.info(f"無 README 或獲取失敗: {readme_response.text}")
            except httpx.HTTPStatusError as e:
                logger.info(f"獲取 README 失敗: {str(e)}")

            # 使用 Gemini 生成概覽
            model_name = get_available_model()
            model = genai.GenerativeModel(model_name)
            prompt = f"""
你是一個程式碼分析專家，請分析以下 GitHub 倉庫的第一次 commit diff 和 README（如果可用），並提供一個整體的程式碼功能大綱，描述這個倉庫的核心功能和目的。概覽應：
1. 用簡單、友好的語言，適合非技術用戶。
2. 概述程式碼的主要功能（例如，這個程式做什麼？）。
3. 限制在 100-200 字。
4. 明確提及 commit 序號（例如，「第一次 commit (序號: {first_commit_number})」）。

**倉庫上下文**：
- 第一次 commit diff (序號: {first_commit_number})：
{diff_data}
- README（若可用）：
{readme_content}

**輸出格式**：
## 程式碼功能大綱
[你的概覽內容]
"""
            logger.info(f"送往 Gemini 的提示詞 (模型: {model_name}): {prompt[:200]}...")
            try:
                response = model.generate_content(prompt)
                if not response.text:
                    logger.error("Gemini API 返回空回應")
                    raise HTTPException(status_code=500, detail="Gemini API returned empty response")
                overview = response.text
                logger.info(f"Gemini 概覽結果: {overview[:100]}...")
            except GoogleAPIError as e:
                logger.error(f"Gemini API 錯誤: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Gemini API failed: {str(e)}")

            return {"overview": overview}
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP 錯誤: {str(e)}")
            raise HTTPException(status_code=e.response.status_code, detail=f"Failed to fetch data: {str(e)}")
        except Exception as e:
            logger.error(f"意外錯誤: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

# 處理使用者對話
@app.post("/repos/{owner}/{repo}/chat")
async def chat_with_repo(owner: str, repo: str, access_token: str = Query(...), question: str = Query(...)):
    logger.info(f"收到對話請求: owner={owner}, repo={repo}, question={question}")
    async with httpx.AsyncClient() as client:
        try:
            commit_map, commits_data = await get_commit_number_and_list(owner, repo, access_token)
            if not commits_data:
                logger.info(f"倉庫 {owner}/{repo} 無 commits")
                raise HTTPException(status_code=404, detail="No commits found in repository")

            latest_commit_sha = commits_data[0]["sha"]
            latest_commit_number = commit_map.get(latest_commit_sha, 0)
            if latest_commit_number == 0:
                logger.error(f"無法為 SHA {latest_commit_sha} 計算序號")
                raise HTTPException(status_code=404, detail="Failed to determine latest commit number")

            diff_response = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/commits/{latest_commit_sha}",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.github.v3.diff",
                },
            )
            if diff_response.status_code != 200:
                logger.error(f"獲取最新 commit diff 失敗: {diff_response.text}")
                raise HTTPException(status_code=diff_response.status_code, detail="Failed to fetch commit diff")
            diff_data = diff_response.text
            logger.info(f"最新 commit diff (序號: {latest_commit_number}): {diff_data[:100]}...")

            readme_response = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/readme",
                headers={"Authorization": f"Bearer {access_token}", "Accept": "application/vnd.github.raw"},
            )
            readme_content = readme_response.text if readme_response.status_code == 200 else ""

            history_key = f"{owner}/{repo}/{access_token[:10]}"
            if history_key not in conversation_history:
                conversation_history[history_key] = []

            model_name = get_available_model()
            model = genai.GenerativeModel(model_name)
            history_text = "\n".join([f"Q: {item['question']}\nA: {item['answer']}" for item in conversation_history[history_key]])
            prompt = f"""
你是一個程式碼分析助手，請根據以下 GitHub 倉庫的上下文和對話歷史，回答使用者的問題。回答應：
1. 簡潔、清晰，適合技術和非技術用戶。
2. 直接回應問題，並參考倉庫上下文（如 diff 或 README）。
3. 如果問題涉及特定 commit 序號，明確參考該序號（例如，「第 {latest_commit_number} 次 commit」）。
4. 如果問題超出上下文範圍，說明限制並提供合理推測。

**倉庫上下文**：
- 最新 commit diff (序號: {latest_commit_number})：
{diff_data}
- README（若可用）：
{readme_content}

**對話歷史**：
{history_text}

**使用者問題**：
{question}

**輸出格式**：
[你的回答]
"""
            logger.info(f"送往 Gemini 的對話提示詞 (模型: {model_name}): {prompt[:200]}...")
            response = model.generate_content(prompt)
            if not response.text:
                logger.error("Gemini API 返回空回應")
                raise HTTPException(status_code=500, detail="Gemini API returned empty response")
            answer = response.text
            logger.info(f"Gemini 回答: {answer[:100]}...")

            conversation_history[history_key].append({"question": question, "answer": answer})
            if len(conversation_history[history_key]) > 10:
                conversation_history[history_key] = conversation_history[history_key][-10:]

            return {"answer": answer, "history": conversation_history[history_key]}
        except (GoogleAPIError, httpx.HTTPStatusError) as e:
            logger.error(f"錯誤: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to process chat: {str(e)}")

# 獲取從第一次到指定 commit 的所有 diff 並進行分析
@app.post("/repos/{owner}/{repo}/commits/{sha}/analyze")
async def analyze_commit_diff(owner: str, repo: str, sha: str, access_token: str = Query(...)):
    logger.info(f"收到分析請求: owner={owner}, repo={repo}, sha={sha}")
    async with httpx.AsyncClient() as client:
        try:
            commit_map, commits_data = await get_commit_number_and_list(owner, repo, access_token)
            if not commits_data:
                logger.info(f"倉庫 {owner}/{repo} 無 commits")
                raise HTTPException(status_code=404, detail="No commits found in repository")

            target_commit_number = commit_map.get(sha, 0)
            if target_commit_number == 0:
                logger.error(f"無法為 SHA {sha} 計算序號")
                raise HTTPException(status_code=404, detail="Invalid or unknown commit SHA")

            combined_diff = ""
            diff_count = 0
            max_diffs = 5
            current_diff = ""
            for commit in reversed(commits_data):
                commit_sha = commit["sha"]
                commit_number = commit_map.get(commit_sha, 0)
                if commit_number == 0 or commit_number > target_commit_number:
                    continue
                if diff_count >= max_diffs:
                    logger.info(f"達到最大 diff 數量: {max_diffs}")
                    break
                try:
                    diff_response = await client.get(
                        f"https://api.github.com/repos/{owner}/{repo}/commits/{commit_sha}",
                        headers={
                            "Authorization": f"Bearer {access_token}",
                            "Accept": "application/vnd.github.v3.diff",
                        },
                    )
                    if diff_response.status_code != 200:
                        logger.error(f"獲取 commit {commit_sha} diff 失敗: {diff_response.text}")
                        continue
                    diff_data = diff_response.text
                    logger.info(f"Commit diff (序號: {commit_number}): {diff_data[:100]}...")
                    combined_diff += f"第 {commit_number} 次 commit (SHA: {commit_sha}):\n```\n{diff_data}\n```\n\n"
                    diff_count += 1
                    if commit_sha == sha:
                        current_diff = diff_data
                except httpx.HTTPStatusError as e:
                    logger.error(f"獲取 diff 錯誤: {str(e)}")
                    continue

            if not combined_diff:
                logger.error("無有效的 diff 數據")
                raise HTTPException(status_code=404, detail="No valid diffs found for commits")

            if len(combined_diff) > 50000:
                logger.error(f"合併的 diff 過大: {len(combined_diff)} 字元")
                raise HTTPException(status_code=400, detail="Combined diff too large, please select an earlier commit")

            model_name = get_available_model()
            model = genai.GenerativeModel(model_name)
            prompt = f"""
你是一個程式碼審查專家，請分析以下 GitHub 倉庫從第一次到第 {target_commit_number} 次 commit 的所有 diff，提供以下內容：
1. **功能大綱**：概述程式碼從第一次到第 {target_commit_number} 次 commit 的整體功能和目的（100-200 字，簡單語言）。
2. **變更總結**：按 commit 序號總結每個 commit 的主要變更（例如，新增功能、修復錯誤）。
3. **最新 commit 分析**：詳細分析第 {target_commit_number} 次 commit 的變更（例如，技術細節、潛在問題、改進建議）。
4. 使用簡單、友好的語言，適合非技術用戶。

請按 commit 序號組織回應，變更總結以標題分隔（例如，## 第 X 次 commit）。功能大綱放在開頭，標題為 ## 程式碼功能大綱。

Diff 內容：
{combined_diff}
"""
            logger.info(f"送往 Gemini 的分析提示詞 (模型: {model_name}): {prompt[:200]}...")
            try:
                response = model.generate_content(prompt)
                if not response.text:
                    logger.error("Gemini API 返回空回應")
                    raise HTTPException(status_code=500, detail="Gemini API returned empty response")
                analysis = response.text
                logger.info(f"Gemini 分析結果: {analysis[:100]}...")
            except GoogleAPIError as e:
                logger.error(f"Gemini API 錯誤: {str(e)}")
                raise HTTPException(status_code=500, detail=f"Gemini API failed: {str(e)}")

            overview = ""
            if "## 程式碼功能大綱" in analysis:
                try:
                    parts = analysis.split("## 程式碼功能大綱")[1].split("##")
                    overview = parts[0].strip() if parts else ""
                except IndexError:
                    logger.warning("無法解析 overview，格式不符")
                    overview = ""

            return {
                "sha": sha,
                "diff": current_diff,
                "analysis": analysis,
                "overview": overview,
            }
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP 錯誤: {str(e)}")
            raise HTTPException(status_code=e.response.status_code, detail=f"Failed to fetch data: {str(e)}")
        except Exception as e:
            logger.error(f"意外錯誤: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

# 啟動伺服器
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)