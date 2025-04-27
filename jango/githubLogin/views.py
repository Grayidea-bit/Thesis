# views.py
import requests
import json
from urllib.parse import quote
from django.conf import settings
from django.http import JsonResponse, HttpResponseRedirect
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import redirect
from rest_framework.response import Response


class DataCache:
    data = {}

    @classmethod
    def get(cls):
        return cls.data

    @classmethod
    def set(cls, data_list):
        cls.data=data_list


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
    
    frontend_url = f"http://localhost:5173/profile/"
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
    
    repo_names = [repo["name"] for repo in repos_data]

    return JsonResponse({"repositories": repo_names})


# 新增
@csrf_exempt
def repo_commit(request,repo):
    User=request.session.get("username")
    access_token = request.session.get('access_token')
    header = {
        "Authorization":f"token {access_token}",
        "Accept":"application/vnd.github+json",
    }
    url=f"https://api.github.com/repos/{User}/{repo}/commits"
    
    output=requests.get(url,headers=header)
    data=output.json()
    value_list=list()
    num=1
    for i in reversed(data):
        value_dict=dict()
        url_sha = f"https://api.github.com/repos/{User}/{repo}/commits/{i.get("sha")}"
        output_sha = requests.get(url_sha,headers=header)
        data_sha = output_sha.json()
        #抓取sha、message，並自訂版本數
        value_dict["sha"]=data_sha.get("sha")
        value_dict["message"]=data_sha.get("commit").get("message")
        value_dict["version"]=num
        file_list=list()
        #將不重要的資訊移除
        for j in data_sha.get("files"):
            j.pop("blob_url", "Not found")
            j.pop("raw_url", "Not found")
            j.pop("contents_url", "Not found")
            file_list.append(j)
            
        value_dict["files"]=file_list
        value_list.append(value_dict)
        num+=1

    #硬將資料存在後端(之後要改) -> 為repo_commit_particular快速
    DataCache.set(value_list)
    #這邊應該還會加入AI的部分
    '''
    AI(value_list)
    '''
    #才會回傳給前端
    return JsonResponse(value_list,safe=False)

# 新增
@csrf_exempt
def repo_commit_particular(request,repo,commit):
    data=DataCache.get()
    commit_version=commit.split(',')
    value_list=list()
    for i in commit_version:
        for j in data:
            if i==j.get("message"):
                value_list.append(j)
    
    #這邊應該還會加入AI的部分
    '''
    AI(value_list)
    '''
    #才會回傳給前端            
    return JsonResponse(value_list,safe=False)