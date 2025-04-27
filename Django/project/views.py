from django.http import JsonResponse, HttpResponseRedirect
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET
import urllib.parse
import httpx

def root(request):
    return JsonResponse({"message": "Welcome to the GitHub LLM API"})

async def github_login(request):
    params = {
        "client_id": settings.GITHUB_CLIENT_ID,
        "redirect_uri": "http://localhost:3000",
        "scope": "repo user",
    }
    url = f"https://github.com/login/oauth/authorize?{urllib.parse.urlencode(params)}"
    return HttpResponseRedirect(url)

async def github_callback(request):
    code = request.GET.get("code")
    if not code:
        return JsonResponse({"error": "GitHub code not provided"}, status=400)
    
    # 用於交換 GitHub code 為 access token
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
            },
            headers={"Accept": "application/json"},
        )
        data = resp.json()
        access_token = data.get("access_token")
        if not access_token:
            return JsonResponse({"error": "Failed to get token"}, status=400)
        
        # 使用 access token 獲取用戶資料
        user_resp = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        user_data = user_resp.json()
        
        return JsonResponse({
            "access_token": access_token,
            "user": {
                "login": user_data.get("login"),
                "avatar_url": user_data.get("avatar_url"),
                "html_url": user_data.get("html_url"),
            },
        })

@require_GET
async def get_repos(request):
    access_token = request.GET.get("access_token")
    if not access_token:
        return JsonResponse({"error": "Missing access token"}, status=400)

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://api.github.com/user/repos",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        if resp.status_code != 200:
            return JsonResponse({"error": "Failed to fetch repos"}, status=resp.status_code)
        return JsonResponse(resp.json(), safe=False)

@require_GET
async def get_commits(request, owner, repo):
    access_token = request.GET.get("access_token")
    if not access_token:
        return JsonResponse({"error": "Missing access token"}, status=400)

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}/commits",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        if resp.status_code != 200:
            return JsonResponse({"error": "Failed to fetch commits"}, status=resp.status_code)
        return JsonResponse(resp.json(), safe=False)

@require_GET
async def get_commit_diff(request, owner, repo, sha):
    access_token = request.GET.get("access_token")
    if not access_token:
        return JsonResponse({"error": "Missing access token"}, status=400)

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"https://api.github.com/repos/{owner}/{repo}/commits/{sha}",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github.v3.diff"
            }
        )
        if resp.status_code != 200:
            return JsonResponse({"error": f"Failed to fetch commit diff: {resp.text}"}, status=resp.status_code)

        if len(resp.text) > 100000:
            return JsonResponse({"error": "Diff too large, please select a smaller commit"}, status=400)

        return JsonResponse({"sha": sha, "diff": resp.text})