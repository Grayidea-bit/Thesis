#================================#
# 導入模組和配置日誌
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
from pydantic import BaseModel
from typing import Optional # Optional can be removed if not used elsewhere, but kept for now
# 配置日誌
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

#================================#
# FastAPI 初始化和 CORS 配置
app = FastAPI()

# 允許 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"], # Adjust origin as needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#================================#
# 環境變數載入和驗證
load_dotenv()
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
REDIRECT_URI = "http://localhost:3000" # Make sure this matches your frontend callback URL

# 驗證環境變數
if not all([GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GEMINI_API_KEY]):
    raise ValueError("缺少必要的環境變數，請檢查 .env 文件")

#================================#
# Gemini API 配置和全局變數
genai.configure(api_key=GEMINI_API_KEY)

# 移除服務器端對話歷史存儲，因為我們將依賴客戶端傳遞歷史
# conversation_history: Dict[str, List[Dict[str, str]]] = {} # Removed or commented out
commit_number_cache: Dict[str, Dict[str, int]] = {}
commit_data_cache: Dict[str, List[Dict]] = {} # Cache for commit data

#================================#
# Gemini 模型選擇函數
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

#================================#
# 全局異常處理
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"未捕獲的異常: {str(exc)}", exc_info=True)
    # Ensure CORS headers are included in error responses too
    return JSONResponse(
        status_code=500,
        content={"detail": f"伺服器內部錯誤: {str(exc)}"},
        headers={"Access-Control-Allow-Origin": "http://localhost:3000"}, # Adjust origin
    )

#================================#
# 根路徑
@app.get("/")
async def root():
    return {"message": "Welcome to the GitHub LLM API"}

#================================#
# Commit 數據處理函數
async def get_commit_number_and_list(owner: str, repo: str, access_token: str) -> tuple[Dict[str, int], List[Dict]]:
    """Fetches commits, assigns sequential numbers, and caches results."""
    cache_key = f"{owner}/{repo}"
    if cache_key not in commit_number_cache or cache_key not in commit_data_cache:
        logger.info(f"快取未命中，獲取 commits: {cache_key}")
        commit_number_cache[cache_key] = {}
        commit_data_cache[cache_key] = []
        fetched_commits = []
        async with httpx.AsyncClient() as client:
            page = 1
            while True:
                try:
                    response = await client.get(
                        f"https://api.github.com/repos/{owner}/{repo}/commits",
                        headers={"Authorization": f"Bearer {access_token}"},
                        params={"per_page": 100, "page": page}, # Fetch 100 per page
                    )
                    response.raise_for_status() # Raise exception for 4xx or 5xx status codes
                    page_commits = response.json()
                    if not page_commits:
                        break # No more commits
                    fetched_commits.extend(page_commits)
                    page += 1
                    # Optional: Add a small delay to avoid rate limiting
                    # await asyncio.sleep(0.1)
                except httpx.HTTPStatusError as e:
                    logger.error(f"獲取 commits 失敗: 狀態碼 {e.response.status_code}, 回應 {e.response.text}")
                    # Propagate a more informative error if possible
                    detail = f"Failed to fetch commits: {e.response.status_code}"
                    if e.response.status_code == 404:
                         detail = f"Repository {owner}/{repo} not found or access denied."
                    elif e.response.status_code == 403:
                         detail = "GitHub API rate limit exceeded or token lacks permissions."
                    raise HTTPException(status_code=e.response.status_code, detail=detail)
                except httpx.RequestError as e:
                     logger.error(f"請求 GitHub API 時發生錯誤: {str(e)}")
                     raise HTTPException(status_code=503, detail=f"Error connecting to GitHub API: {str(e)}")

        commit_data_cache[cache_key] = fetched_commits # Store all fetched commits
        if not commit_data_cache[cache_key]:
            logger.info(f"倉庫 {owner}/{repo} 無 commits")
            # Return empty results, don't raise error here
            return {}, []

        # Assign commit numbers (1 for the oldest, N for the newest)
        for i, commit in enumerate(reversed(commit_data_cache[cache_key]), 1):
            commit_number_cache[cache_key][commit["sha"]] = i
        logger.info(f"成功獲取並編號 {len(commit_data_cache[cache_key])} commits for {cache_key}")
    else:
        logger.info(f"快取命中: {cache_key}")

    return commit_number_cache[cache_key], commit_data_cache[cache_key]

#================================#
# GitHub OAuth 登入
@app.get("/auth/github/login")
async def github_login():
    params = {
        "client_id": GITHUB_CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "scope": "repo user", # Request repo and user scope
    }
    github_auth_url = f"https://github.com/login/oauth/authorize?{urllib.parse.urlencode(params)}"
    logger.info(f"Redirecting user to GitHub for authorization: {github_auth_url}")
    return RedirectResponse(github_auth_url)

#================================#
# GitHub OAuth 回呼
@app.get("/auth/github/callback")
async def github_callback(code: str = Query(...)):
    logger.info(f"收到 GitHub callback code: {code[:10]}...") # Log only prefix for security
    async with httpx.AsyncClient() as client:
        try:
            token_response = await client.post(
                "https://github.com/login/oauth/access_token",
                json={
                    "client_id": GITHUB_CLIENT_ID,
                    "client_secret": GITHUB_CLIENT_SECRET,
                    "code": code,
                },
                headers={"Accept": "application/json"}, # Request JSON response
            )
            token_response.raise_for_status() # Check for errors in token exchange
            token_data = token_response.json()
            logger.info(f"GitHub token response received (keys: {token_data.keys()})")
            access_token = token_data.get("access_token")

            if not access_token:
                error = token_data.get("error", "Unknown error")
                error_description = token_data.get("error_description", "No description provided")
                logger.error(f"無法獲取 GitHub access token: {error} - {error_description}")
                raise HTTPException(status_code=400, detail=f"Failed to retrieve access token: {error_description}")

            # Fetch user information using the obtained token
            user_response = await client.get(
                "https://api.github.com/user",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            user_response.raise_for_status() # Check for errors fetching user data
            user_data = user_response.json()
            logger.info(f"成功獲取 GitHub user data for: {user_data.get('login')}")

            # Return token and basic user info to the client
            return {
                "access_token": access_token,
                "user": {
                    "login": user_data.get("login"),
                    "avatar_url": user_data.get("avatar_url"),
                    "html_url": user_data.get("html_url"),
                },
            }
        except httpx.HTTPStatusError as e:
            logger.error(f"GitHub OAuth callback 期間發生 HTTP 錯誤: {e.response.status_code} - {e.response.text}")
            raise HTTPException(status_code=e.response.status_code, detail=f"GitHub API error during OAuth callback: {e.response.text}")
        except httpx.RequestError as e:
            logger.error(f"連接 GitHub 時發生錯誤: {str(e)}")
            raise HTTPException(status_code=503, detail=f"Error connecting to GitHub during OAuth callback: {str(e)}")

#================================#
# 獲取倉庫列表
@app.get("/repos")
async def get_repos(access_token: str = Query(...)):
    logger.info(f"請求獲取用戶倉庫列表 (token ends: ...{access_token[-4:]})")
    async with httpx.AsyncClient() as client:
        try:
            # Fetch repos the authenticated user has access to
            repos_response = await client.get(
                "https://api.github.com/user/repos",
                headers={"Authorization": f"Bearer {access_token}"},
                params={"type": "all", "per_page": 100} # Get all types, up to 100
            )
            repos_response.raise_for_status()
            repos_data = repos_response.json()
            logger.info(f"成功獲取 {len(repos_data)} 個倉庫")

            # --- *** 修改這裡的返回數據結構 *** ---
            # 確保每個 repo 字典都包含 owner 和 login
            repos_to_return = []
            for repo in repos_data:
                if repo and isinstance(repo.get("owner"), dict) and repo["owner"].get("login"):
                    repos_to_return.append({
                        "id": repo.get("id"),
                        "name": repo.get("name"),
                        "full_name": repo.get("full_name"),
                        "private": repo.get("private"),
                        # *** 添加 owner 物件和 login ***
                        "owner": {
                            "login": repo["owner"]["login"]
                        }
                    })
                else:
                    # 如果數據結構不完整，記錄一個警告，並可能跳過這個 repo
                    logger.warning(f"Skipping repo due to missing owner/login data: {repo.get('id')}, Name: {repo.get('name')}")

            return repos_to_return
            # --- *** 修改結束 *** ---

        except httpx.HTTPStatusError as e:
            logger.error(f"獲取倉庫列表失敗: {e.response.status_code} - {e.response.text}")
            detail = "Failed to fetch repositories."
            if e.response.status_code == 401:
                 detail = "Invalid or expired access token."
            elif e.response.status_code == 403:
                 detail = "Access forbidden or rate limit exceeded."
            raise HTTPException(status_code=e.response.status_code, detail=detail)
        except httpx.RequestError as e:
            logger.error(f"請求 GitHub API 時發生錯誤: {str(e)}")
            raise HTTPException(status_code=503, detail=f"Error connecting to GitHub API: {str(e)}")


#================================#
# 獲取指定倉庫的 commits (Simplified - mainly for checking existence, use get_commit_number_and_list for main logic)
@app.get("/repos/{owner}/{repo}/commits")
async def get_repo_commits_basic(owner: str, repo: str, access_token: str = Query(...)):
    logger.info(f"請求獲取倉庫 commits (basic): {owner}/{repo}")
    async with httpx.AsyncClient() as client:
        try:
            # Just fetch the first page to check
            response = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/commits",
                headers={"Authorization": f"Bearer {access_token}"},
                params={"per_page": 5} # Fetch a small number
            )
            response.raise_for_status()
            commits_data = response.json()
            logger.info(f"成功獲取 {len(commits_data)} commits (basic) for {owner}/{repo}")
            # Return basic info for display if needed
            return [{"sha": c["sha"], "message": c.get("commit", {}).get("message", "N/A")[:70] + "...", "date": c.get("commit", {}).get("committer", {}).get("date")} for c in commits_data]
        except httpx.HTTPStatusError as e:
            logger.error(f"獲取 commits (basic) 失敗: {e.response.status_code} - {e.response.text}")
            detail = f"Failed to fetch basic commit info for {owner}/{repo}."
            if e.response.status_code == 404:
                 detail = f"Repository {owner}/{repo} not found or access denied."
            raise HTTPException(status_code=e.response.status_code, detail=detail)
        except httpx.RequestError as e:
             logger.error(f"請求 GitHub API 時發生錯誤: {str(e)}")
             raise HTTPException(status_code=503, detail=f"Error connecting to GitHub API: {str(e)}")

#================================#
# 獲取倉庫初始功能概覽
@app.get("/repos/{owner}/{repo}/overview")
async def get_repo_overview(owner: str, repo: str, access_token: str = Query(...)):
    logger.info(f"請求倉庫概覽: owner={owner}, repo={repo}")
    async with httpx.AsyncClient() as client:
        try:
            # 獲取 commit 列表和序號
            commit_map, commits_data = await get_commit_number_and_list(owner, repo, access_token)
            if not commits_data:
                logger.warning(f"倉庫 {owner}/{repo} 無 commits，無法生成概覽")
                # Return a specific message instead of 404 to distinguish from repo not found
                return {"overview": "此倉庫尚無任何提交記錄，無法生成初始功能概覽。"}
                # raise HTTPException(status_code=404, detail="No commits found in repository") # Original behavior

            # Find the actual first commit (last in the chronological list)
            first_commit = commits_data[-1] # Oldest commit
            first_commit_sha = first_commit["sha"]
            first_commit_number = commit_map.get(first_commit_sha)

            if first_commit_number is None: # Should not happen if commit_map is correct
                logger.error(f"無法在 commit_map 中找到第一次 commit 的序號: SHA {first_commit_sha}")
                raise HTTPException(status_code=500, detail="Internal error: Failed to map first commit SHA")

            logger.info(f"獲取第一次 commit (序號: {first_commit_number}, SHA: {first_commit_sha[:7]}) 的 diff")
            # 獲取第一次 commit 的 diff (Note: first commit diff shows all added files)
            diff_response = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/commits/{first_commit_sha}",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.github.v3.diff", # Request diff format
                },
            )
            diff_response.raise_for_status() # Check for errors
            diff_data = diff_response.text
            logger.info(f"第一次 commit diff data length: {len(diff_data)}")

            # --- Diff Size Limit ---
            MAX_DIFF_SIZE = 50000 # 50k characters limit for the prompt
            if len(diff_data) > MAX_DIFF_SIZE:
                logger.warning(f"第一次 commit diff 過大 ({len(diff_data)} chars), will truncate to {MAX_DIFF_SIZE}")
                diff_data = diff_data[:MAX_DIFF_SIZE] + "\n... (diff truncated due to size limit)"
                # Alternative: Raise error
                # logger.error(f"第一次 commit diff 過大: {len(diff_data)} 字元")
                # raise HTTPException(status_code=400, detail="First commit diff is too large to analyze.")

            # 獲取 README
            readme_content = ""
            readme_url = f"https://api.github.com/repos/{owner}/{repo}/readme"
            try:
                readme_response = await client.get(
                    readme_url,
                    headers={"Authorization": f"Bearer {access_token}", "Accept": "application/vnd.github.raw"}, # Request raw content
                )
                if readme_response.status_code == 200:
                    readme_content = readme_response.text
                    logger.info(f"成功獲取 README (length: {len(readme_content)})")
                else:
                    logger.info(f"獲取 README 失敗或不存在: Status {readme_response.status_code}")
            except httpx.HTTPStatusError as e:
                # 404 is expected if README doesn't exist, log others as warning
                if e.response.status_code != 404:
                    logger.warning(f"獲取 README 時發生錯誤: {e.response.status_code} - {e.response.text}")
            except httpx.RequestError as e:
                 logger.warning(f"連接 GitHub 獲取 README 時發生錯誤: {str(e)}")


            # --- Generate Overview with Gemini ---
            model_name = get_available_model()
            model = genai.GenerativeModel(model_name)
            prompt = f"""
你是一位友好的技術文檔撰寫者。請分析以下 GitHub 倉庫的第一次 commit diff (顯示了所有初始添加的文件) 和 README (如果有的話)。
生成一個簡潔 (約 100-150 字) 的 **程式碼功能大綱**，用**簡單易懂、非技術性**的語言描述這個倉庫的主要目的是什麼，它大概實現了什麼功能。

**重要:** 在你的描述中，明確提及這是基於 "第一次 commit (序號: {first_commit_number})" 的分析。

**分析資料:**

* **第一次 Commit Diff (序號: {first_commit_number}, SHA: {first_commit_sha[:7]}):**
    ```diff
    {diff_data}
    ```

* **README 內容 (如果有的話):**
    ```
    {readme_content if readme_content else "未找到 README 文件。"}
    ```

**輸出格式:** (只需要下面的大綱部分)
## 程式碼功能大綱
[你的 100-150 字概述內容，提及基於第一次 commit 分析]
"""
            logger.info(f"向 Gemini ({model_name}) 發送概覽請求 prompt (截斷預覽): {prompt[:300]}...")
            try:
                response = await model.generate_content_async(prompt) # Use async version
                if not response.text:
                    logger.error("Gemini API for overview returned empty response")
                    raise HTTPException(status_code=500, detail="Gemini API returned empty response for overview")
                overview_text = response.text
                logger.info(f"Gemini 概覽結果 (截斷預覽): {overview_text[:100]}...")

                # Extract content under the specific header
                if "## 程式碼功能大綱" in overview_text:
                     overview = overview_text.split("## 程式碼功能大綱", 1)[-1].strip()
                else:
                     logger.warning("Gemini response did not contain '## 程式碼功能大綱' header, using full response.")
                     overview = overview_text # Fallback to full response if header missing

            except GoogleAPIError as e:
                logger.error(f"Gemini API 錯誤 (overview): {str(e)}")
                raise HTTPException(status_code=500, detail=f"Gemini API failed during overview generation: {str(e)}")
            except Exception as e: # Catch other potential errors during generation
                logger.error(f"生成概覽時發生意外錯誤: {str(e)}", exc_info=True)
                raise HTTPException(status_code=500, detail=f"Unexpected error during overview generation: {str(e)}")


            return {"overview": overview}

        except httpx.HTTPStatusError as e:
            logger.error(f"獲取概覽數據時發生 HTTP 錯誤: {e.response.status_code} - {e.response.text}")
            detail = f"Failed to fetch data for overview: {e.response.status_code}"
            if e.response.status_code == 404:
                 detail = f"Repository {owner}/{repo} not found or access denied."
            raise HTTPException(status_code=e.response.status_code, detail=detail)
        except httpx.RequestError as e:
             logger.error(f"連接 GitHub API 時發生錯誤 (overview): {str(e)}")
             raise HTTPException(status_code=503, detail=f"Error connecting to GitHub API for overview: {str(e)}")
        except HTTPException as e: # Re-raise HTTPExceptions from called functions
            raise e
        except Exception as e:
            logger.error(f"生成倉庫概覽時發生意外錯誤: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Unexpected error generating repository overview: {str(e)}")


#================================#
class ChatRequest(BaseModel):
    commits: List[str] # List of commit SHAs selected by the user
    question: str
    history: List[Dict[str, str]] = [] # Changed to non-optional list for history

@app.post("/repos/{owner}/{repo}/chat")
async def chat_with_repo(
    owner: str,
    repo: str,
    access_token: str = Query(...),
    request: ChatRequest = None, # Receive data from request body
):
    """
    Handles user chat interaction based on selected commits and conversation history.
    """
    # Basic validation
    if not request:
        raise HTTPException(status_code=400, detail="Request body is missing")
    if not request.commits:
        raise HTTPException(status_code=400, detail="No commits specified in the request")
    if not request.question:
        raise HTTPException(status_code=400, detail="Question is missing in the request")
    # Ensure history is a list ( Pydantic v2 might handle default factory better, but explicit check is safe)
    if request.history is None:
        request.history = []

    logger.info(f"收到對話請求: repo={owner}/{repo}, commits={request.commits}, question='{request.question[:50]}...', history_len={len(request.history)}")

    async with httpx.AsyncClient() as client:
        try:
            # Get commit map and data (relies on cache or fetches if needed)
            commit_map, commits_data = await get_commit_number_and_list(owner, repo, access_token)
            if not commits_data:
                logger.warning(f"倉庫 {owner}/{repo} 無 commits，無法處理對話")
                raise HTTPException(status_code=404, detail="No commits found in repository, cannot process chat")

            # --- Collect Diffs for Selected Commits ---
            combined_diff = ""
            diff_commit_details = [] # Store SHA and number for the prompt
            MAX_TOTAL_DIFF_SIZE = 75000 # Limit total diff size for context
            current_diff_size = 0

            for commit_sha in request.commits:
                if commit_sha not in commit_map:
                    logger.warning(f"請求中包含無效的 commit SHA: {commit_sha}, skipping.")
                    continue

                commit_number = commit_map[commit_sha]
                logger.info(f"獲取 commit (序號: {commit_number}, SHA: {commit_sha[:7]}) 的 diff 用於對話")
                try:
                    diff_response = await client.get(
                        f"https://api.github.com/repos/{owner}/{repo}/commits/{commit_sha}",
                        headers={
                            "Authorization": f"Bearer {access_token}",
                            "Accept": "application/vnd.github.v3.diff",
                        },
                    )
                    diff_response.raise_for_status() # Check for HTTP errors
                    diff_data = diff_response.text

                    if current_diff_size + len(diff_data) > MAX_TOTAL_DIFF_SIZE:
                        logger.warning(f"Combined diff size exceeds limit ({MAX_TOTAL_DIFF_SIZE}). Stopping diff collection for commit {commit_sha[:7]}.")
                        break # Stop adding more diffs if limit exceeded

                    logger.info(f"Commit diff (SHA: {commit_sha[:7]}) length: {len(diff_data)}")
                    combined_diff += f"--- Diff for Commit {commit_number} (SHA: {commit_sha[:7]}) ---\n```diff\n{diff_data}\n```\n\n"
                    diff_commit_details.append(f"Commit {commit_number} (SHA: {commit_sha[:7]})")
                    current_diff_size += len(diff_data)

                except httpx.HTTPStatusError as e:
                    logger.error(f"獲取 commit {commit_sha[:7]} diff 失敗: {e.response.status_code} - {e.response.text}. Skipping this commit.")
                    # Decide whether to continue or fail the request
                    continue # Skip this commit and proceed with others
                    # raise HTTPException(status_code=e.response.status_code, detail=f"Failed to fetch diff for commit {commit_sha[:7]}")
                except httpx.RequestError as e:
                     logger.error(f"請求 commit {commit_sha[:7]} diff 時發生錯誤: {str(e)}. Skipping.")
                     continue

            if not combined_diff:
                logger.error("無法為選定的 commits 獲取任何有效的 diff 數據")
                raise HTTPException(status_code=404, detail="Could not retrieve diff data for the selected commits.")

            # --- Prepare Prompt with History and Context ---
            model_name = get_available_model()
            model = genai.GenerativeModel(model_name)

            # Format history for the prompt (using 'user' and 'model' roles)
            formatted_history = []
            for turn in request.history:
                 role = turn.get("role")
                 parts = turn.get("parts")
                 if role and parts:
                     formatted_history.append({"role": role, "parts": [parts]}) # Gemini API expects parts as a list

            # Construct the new turn for the user
            current_turn_user = {"role": "user", "parts": []}

            prompt_context = f"""
你是一個程式碼分析與問答的 AI 助手。
請根據以下提供的 GitHub 倉庫特定提交 (commit) 的 diff 內容，以及之前的對話歷史，來回答使用者最新的問題。

**當前分析的 Commit Diff(s):**
(基於使用者選擇的: {', '.join(diff_commit_details) or 'N/A'})
{combined_diff}
---
"""
            current_turn_user["parts"].append(prompt_context)
            # Append the actual user question
            current_turn_user["parts"].append(f"**使用者最新問題:**\n{request.question}")

            # Combine history and current question for the API call
            # Note: Gemini API expects a list of Content objects (role, parts)
            generation_request_content = formatted_history + [current_turn_user]


            logger.info(f"向 Gemini ({model_name}) 發送對話請求 (History length: {len(formatted_history)}, Prompt context size: {len(prompt_context)})")
            # Log the last part of the request for debugging if needed
            # logger.debug(f"Last part of generation request: {generation_request_content[-1]}")

            try:
                # Use generate_content with the history list
                response = await model.generate_content_async(generation_request_content)

                if not response.candidates or not response.candidates[0].content or not response.candidates[0].content.parts:
                     # Handle cases like safety blocks or empty responses
                     block_reason = response.prompt_feedback.block_reason if response.prompt_feedback else 'Unknown'
                     finish_reason = response.candidates[0].finish_reason if response.candidates else 'Unknown'
                     logger.error(f"Gemini API 返回無有效內容。Block reason: {block_reason}, Finish reason: {finish_reason}")
                     # Provide a more user-friendly error based on reason if possible
                     error_detail = "Gemini API returned an empty or blocked response."
                     if block_reason != 'Unknown' and block_reason != 'BLOCK_REASON_UNSPECIFIED':
                         error_detail = f"Gemini API blocked the response due to: {block_reason}."
                     elif finish_reason != 'Unknown' and finish_reason != 'STOP':
                          error_detail = f"Gemini API finished with reason: {finish_reason}."

                     raise HTTPException(status_code=500, detail=error_detail)

                # Assuming the response structure holds the text in parts[0].text
                answer = response.candidates[0].content.parts[0].text
                logger.info(f"Gemini 回答 (截斷預覽): {answer[:100]}...")

                # --- Update History for Client ---
                # Append the user question (as sent) and model answer (as received)
                # Use the simple format {role: str, parts: str} for client-side history storage
                updated_history = request.history + [
                    {"role": "user", "parts": request.question},
                    {"role": "model", "parts": answer}
                ]

            except GoogleAPIError as e:
                logger.error(f"Gemini API 錯誤 (chat): {str(e)}")
                raise HTTPException(status_code=500, detail=f"Gemini API failed during chat processing: {str(e)}")
            except Exception as e:
                logger.error(f"處理對話時發生意外錯誤: {str(e)}", exc_info=True)
                raise HTTPException(status_code=500, detail=f"An unexpected error occurred during chat processing: {str(e)}")

            # Return the answer and the updated history list
            return {"answer": answer, "history": updated_history}

        except HTTPException as e: # Re-raise HTTPExceptions
             raise e
        except Exception as e: # Catch broader errors during setup/GitHub interaction
             logger.error(f"處理 /chat 請求時發生意外錯誤: {str(e)}", exc_info=True)
             raise HTTPException(status_code=500, detail=f"Unexpected server error during chat request: {str(e)}")


#================================#
# 分析指定 commit 的 diff (This endpoint remains largely unchanged but uses get_commit_number_and_list)
@app.post("/repos/{owner}/{repo}/commits/{sha}/analyze")
async def analyze_commit_diff(owner: str, repo: str, sha: str, access_token: str = Query(...)):
    logger.info(f"收到分析請求: repo={owner}/{repo}, target_sha={sha[:7]}")
    async with httpx.AsyncClient() as client:
        try:
            # Get commit map and data
            commit_map, commits_data = await get_commit_number_and_list(owner, repo, access_token)
            if not commits_data:
                logger.warning(f"倉庫 {owner}/{repo} 無 commits，無法分析")
                raise HTTPException(status_code=404, detail="No commits found in repository, cannot analyze")

            # Validate target SHA and get its number
            target_commit_number = commit_map.get(sha)
            if target_commit_number is None:
                logger.error(f"請求的 SHA {sha} 在倉庫 {owner}/{repo} 的 commit 歷史中未找到或無效")
                raise HTTPException(status_code=404, detail="Invalid or unknown commit SHA provided")

            logger.info(f"目標 commit 序號: {target_commit_number}")

            # --- Collect Diffs up to the Target Commit ---
            combined_diff_for_analysis = ""
            diff_count = 0
            max_diffs_for_context = 10 # Limit how many diffs to include for context to avoid huge prompts
            MAX_ANALYSIS_DIFF_SIZE = 75000 # Limit total size for analysis prompt
            current_total_size = 0
            target_commit_diff_data = "" # Store the specific diff for the target SHA

            # Iterate chronologically (oldest to newest) up to the target commit number
            for commit in commits_data:
                 commit_sha_loop = commit["sha"]
                 commit_number_loop = commit_map.get(commit_sha_loop)

                 if commit_number_loop is None: # Should not happen
                     logger.warning(f"Skipping commit {commit_sha_loop[:7]} during analysis - missing in map.")
                     continue

                 # Only process commits up to and including the target commit
                 if commit_number_loop > target_commit_number:
                      continue

                 # Limit the number of diffs included for broader context
                 if diff_count >= max_diffs_for_context and commit_sha_loop != sha:
                      # Still need to fetch the target commit's diff even if context limit reached
                      if target_commit_diff_data: # Check if target diff already fetched
                           continue # Skip older ones once context limit is hit and target is fetched
                 try:
                    diff_response = await client.get(
                        f"https://api.github.com/repos/{owner}/{repo}/commits/{commit_sha_loop}",
                        headers={
                            "Authorization": f"Bearer {access_token}",
                            "Accept": "application/vnd.github.v3.diff",
                        },
                    )
                    diff_response.raise_for_status()
                    diff_data = diff_response.text

                    if current_total_size + len(diff_data) > MAX_ANALYSIS_DIFF_SIZE and commit_sha_loop != sha:
                        logger.warning(f"Analysis diff context size exceeds limit ({MAX_ANALYSIS_DIFF_SIZE}). Stopping context collection before commit {commit_number_loop}.")
                        # Ensure target diff is still fetched if not already
                        if not target_commit_diff_data and sha == commit_sha_loop:
                             pass # Allow target diff fetch even if size limit hit by context
                        elif target_commit_diff_data: # If target already fetched, break
                             break
                        else: # If target not fetched yet, and this isn't it, skip context add
                             continue


                    # Store the specific diff for the target SHA separately
                    if commit_sha_loop == sha:
                        target_commit_diff_data = diff_data
                        logger.info(f"獲取目標 commit (序號: {commit_number_loop}) diff, length: {len(diff_data)}")

                    # Add to combined diff for context (unless target and context limit hit)
                    if diff_count < max_diffs_for_context or commit_sha_loop == sha:
                         combined_diff_for_analysis += f"--- Diff for Commit {commit_number_loop} (SHA: {commit_sha_loop[:7]}) ---\n```diff\n{diff_data}\n```\n\n"
                         current_total_size += len(diff_data)
                         diff_count += 1

                 except httpx.HTTPStatusError as e:
                    logger.error(f"獲取 commit {commit_sha_loop[:7]} diff for analysis 失敗: {e.response.status_code}. Skipping.")
                    if commit_sha_loop == sha: # If target commit fetch fails, we cannot proceed
                         raise HTTPException(status_code=e.response.status_code, detail=f"Failed to fetch required diff for target commit {sha[:7]}")
                    continue # Skip context commit if fetch fails
                 except httpx.RequestError as e:
                     logger.error(f"請求 commit {commit_sha_loop[:7]} diff for analysis 時發生錯誤: {str(e)}. Skipping.")
                     if commit_sha_loop == sha:
                          raise HTTPException(status_code=503, detail=f"Network error fetching required diff for target commit {sha[:7]}")
                     continue

            if not target_commit_diff_data:
                 # This case should ideally be caught by HTTPStatusError above, but as a fallback:
                 logger.error(f"無法獲取目標 commit {sha[:7]} 的 diff 數據")
                 raise HTTPException(status_code=404, detail=f"Could not retrieve diff data for the target commit {sha[:7]}.")


            # --- Generate Analysis with Gemini ---
            model_name = get_available_model()
            model = genai.GenerativeModel(model_name)
            prompt = f"""
你是是一位資深的程式碼審查 (Code Review) 專家。請仔細分析以下 GitHub 倉庫的 diff 內容，特別是第 {target_commit_number} 次 commit (SHA: {sha[:7]}) 的變更。

**分析目標:**
分析從早期 commits (提供部分上下文) 到**第 {target_commit_number} 次 commit** 的程式碼演進，並重點評估第 {target_commit_number} 次 commit 本身的變更。

**提供的 Diff 內容:**
(包含目標 commit 及最多 {max_diffs_for_context-1} 個之前的 commit 作為上下文)
{combined_diff_for_analysis if combined_diff_for_analysis else "僅提供目標 commit diff。"}

**分析要求:**
請提供以下結構化分析報告：

1.  **## 功能演進概述**
    * 根據提供的 diff 上下文，簡要描述從早期到第 {target_commit_number} 次 commit，程式碼的核心功能或目標可能發生了哪些主要變化或演進？ (約 50-100 字)

2.  **## 第 {target_commit_number} 次 Commit (SHA: {sha[:7]}) 詳細分析**
    * **主要變更**: 這次 commit 具體做了什麼？ (例如：新增了哪個功能？修復了哪個 bug？重構了哪個部分？)
    * **技術細節**: (可選) 如果有明顯的技術實現亮點或值得注意的地方，請指出。
    * **潛在問題或風險**: (若有) 根據變更內容，是否存在明顯的潛在問題、程式碼壞味道 (code smell) 或未來可能的風險？
    * **改進建議**: (若有) 是否有可以讓這次變更更好的建議？ (例如：測試覆蓋、命名、邏輯簡化等)

3.  **## 整體程式碼快照 (基於第 {target_commit_number} 次 commit)**
    * 綜合來看，到了這次 commit，這個程式碼庫大概是用來做什麼的？其主要功能是什麼？(約 50-100 字，類似 /overview 的總結，但基於當前狀態)

**輸出格式:**
請嚴格按照上面的 Markdown 標題 (##) 組織你的回應。語言應專業但易於理解。
"""
            logger.info(f"向 Gemini ({model_name}) 發送分析請求 prompt (Target: {target_commit_number}, SHA: {sha[:7]}, Context Size: {current_total_size})")

            try:
                response = await model.generate_content_async(prompt)
                if not response.text: # Basic check, refined below
                    block_reason = response.prompt_feedback.block_reason if response.prompt_feedback else 'Unknown'
                    finish_reason = response.candidates[0].finish_reason if response.candidates else 'Unknown'
                    logger.error(f"Gemini API for analysis returned no text. Block: {block_reason}, Finish: {finish_reason}")
                    error_detail = "Gemini API returned empty response for analysis."
                    # Add more specific error message if possible
                    if block_reason != 'Unknown' and block_reason != 'BLOCK_REASON_UNSPECIFIED':
                         error_detail = f"Gemini API blocked the analysis response due to: {block_reason}."
                    raise HTTPException(status_code=500, detail=error_detail)

                analysis_text = response.text
                logger.info(f"Gemini 分析結果 (截斷預覽): {analysis_text[:100]}...")

                # Extract the final overview section if possible
                overview = ""
                if "## 整體程式碼快照" in analysis_text:
                    try:
                        # Get text after the last occurrence of the header
                        parts = analysis_text.rsplit("## 整體程式碼快照", 1)
                        if len(parts) > 1:
                             # Further split by next potential header if needed, otherwise take all
                             overview_part = parts[1]
                             overview = overview_part.split("##", 1)[0].strip() # Take text until next header
                        else:
                            logger.warning("Could not reliably extract overview snapshot from analysis.")
                    except Exception as e:
                        logger.warning(f"解析分析報告中的 overview 時出錯: {str(e)}")
                        overview = "" # Fallback

            except GoogleAPIError as e:
                logger.error(f"Gemini API 錯誤 (analysis): {str(e)}")
                raise HTTPException(status_code=500, detail=f"Gemini API failed during analysis: {str(e)}")
            except Exception as e:
                 logger.error(f"生成 commit 分析時發生意外錯誤: {str(e)}", exc_info=True)
                 raise HTTPException(status_code=500, detail=f"Unexpected error during commit analysis: {str(e)}")


            return {
                "sha": sha,
                "commit_number": target_commit_number,
                "diff": target_commit_diff_data, # Return the specific diff of the analyzed commit
                "analysis": analysis_text, # Return the full analysis report
                "overview": overview, # Return the extracted snapshot overview
            }

        except HTTPException as e: # Re-raise HTTPExceptions
             raise e
        except Exception as e:
             logger.error(f"處理 /analyze 請求時發生意外錯誤: {str(e)}", exc_info=True)
             raise HTTPException(status_code=500, detail=f"Unexpected server error during analyze request: {str(e)}")


#================================#
# 啟動伺服器
if __name__ == "__main__":
    import uvicorn
    # Use reload=True for development, but turn off in production
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
    # For production deployment consider using a proper ASGI server like Gunicorn with Uvicorn workers:
    # gunicorn -w 4 -k uvicorn.workers.UvicornWorker main:app -b 0.0.0.0:8000