# views.py
import requests
from django.conf import settings
from django.http import JsonResponse, HttpResponseRedirect
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import redirect
from rest_framework.response import Response


CLIENT_ID = "Ov23li56CKrX18dJODju"
CLIENT_SECRET = "5a134c65c7348ff8bbdd1735ce5cc29aa40ef281"

def githubCallback(request):
    code = request.GET.get("code")
    if not code:
        return JsonResponse({"error": "Missing code"}, status=400)

    # 用 code 換 access_token
    token_url = "https://github.com/login/oauth/access_token"
    headers = {"Accept": "application/json"}
    data = {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "code": code,
    }

    response = requests.post(token_url, headers=headers, data=data)
    token_json = response.json()
    access_token = token_json.get("access_token")

    if not access_token:
        return JsonResponse({"error": "Failed to get access token"}, status=400)

    # 取得 GitHub 使用者資訊
    user_info = requests.get(
        "https://api.github.com/user",
        headers={"Authorization": f"Bearer {access_token}"}
    ).json()

    # 你可以從這裡拿到名稱、email、頭像等
    username = user_info.get("login")
    avatar_url = user_info.get("avatar_url")
    
    request.session['access_token'] = access_token
    request.session['username'] = username
    request.session['avatar_url'] = avatar_url
    
    frontend_url = f"http://localhost:5173/home/"
    return redirect(frontend_url)


@csrf_exempt
def get_user_info(request):
    # 從 session 取出 access_token
    access_token = request.session.get('access_token')
    
    if not access_token:
        return JsonResponse({"error": "No access token found"}, status=400)

    # 使用 access_token 來獲取使用者資料
    response = requests.get(
        "https://api.github.com/user",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    user_data = response.json()

    # 返回使用者資料
    return JsonResponse({
        "username": user_data.get("login"),
        "avatar_url": user_data.get("avatar_url")
    })
    
@csrf_exempt
def get_repos(request):
    access_token = request.session.get('access_token')
    if not access_token:
        return JsonResponse({"error": "No access token found"}, status=400)
    
    response = requests.get(
        "https://api.github.com/user/repos",
        headers={"Authorization": f"Bearer {access_token}"}
    )
    repos_data = response.json()
    
    #repo_names = [repo["name"] for repo in repos_data]

    #return JsonResponse(repos_data);
    #return JsonResponse({"repositories": repo_names})
    repos_info = [
            {
                "name": repo.get("name"),
                "owner": repo.get("owner", {}).get("login") # Safely access nested owner login
            }
            for repo in repos_data if repo.get("name") and repo.get("owner", {}).get("login") # Ensure data exists
        ]

        # Return the list of repo info
    return JsonResponse({"repositories": repos_info})

@csrf_exempt
def get_commits(request, owner, repo):
    access_token = request.session.get('access_token')
    if not access_token:
        return JsonResponse({"error": "Missing access token"}, status=400)

    response = requests.get(
        f"https://api.github.com/repos/{owner}/{repo}/commits",
        headers={"Authorization": f"Bearer {access_token}",
            "Accept": "application/vnd.github.v3+json"}
    )
    commits_data = response.json();
    commit_info = [
        {
            "name" : commit.get('commit').get('message'),
            "sha" : commit.get('sha')
        }
        for commit in commits_data if commit.get('sha') and commit.get('commit').get('message')
    ]
    #commit_shas = [commit.get('sha') for commit in commits_data if commit.get('sha')]

    return JsonResponse({"commits": commit_info})

@csrf_exempt
def get_commit_diff(request, owner, repo, sha):
    access_token = request.session.get('access_token')
    resp = requests.get(
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