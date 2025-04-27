from django.urls import path
from .views import  githubCallback, get_user_info, get_repos,repo_commit,repo_commit_particular

urlpatterns = [
    path('callback/', githubCallback, name='Call back'),
    path('getinfo/', get_user_info, name='Info'),
    path('getrepos/', get_repos, name='getrepos'),
    
    # new 
    path('analyze/<str:repo>/',repo_commit,name="getrepo_commit"),
    # new 
    path('analyze/<str:repo>/<str:commit>',repo_commit_particular,name="getrepo_commit"),
]
