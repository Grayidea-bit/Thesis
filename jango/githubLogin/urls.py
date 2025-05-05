from django.urls import path
from .views import  githubCallback, get_user_info, get_repos, get_commits, get_commit_diff

urlpatterns = [
    path('callback/', githubCallback, name='Call back'),
    path('getinfo/', get_user_info, name='Info'),
    path('getrepos/', get_repos, name='getrepos'),
    path('<str:repo>/<str:owner>/commits/', get_commits, name='getcommits'),
    path('<str:repo>/<str:owner>/<str:sha>/compare/', get_commit_diff, name='getDiff')
]
