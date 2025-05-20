from django.urls import path
from .views import  githubCallback, get_user_info, get_repos, get_commits, get_commit_diff
from . import views
from githubLogin import views

urlpatterns = [
    path('callback/', githubCallback, name='Call back'),
    path('getinfo/', get_user_info, name='Info'),
    path('getrepos/', get_repos, name='getrepos'),
    path('<str:repo>/<str:owner>/commits/', get_commits, name='getcommits'),
    path('<str:repo>/<str:owner>/<str:sha>/compare/', get_commit_diff, name='getDiff'),
    path('repos/<str:owner>/<str:repo>/overview', views.get_repo_overview, name='repo_overview'),
    path('repos/<str:owner>/<str:repo>/chat', views.chat_with_repo, name='chat_with_repo'),
    path('repos/<str:owner>/<str:repo>/commits/<str:sha>/analyze', views.analyze_commit_diff, name='analyze_commit_diff'),
]
