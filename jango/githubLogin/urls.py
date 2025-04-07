from django.urls import path
from .views import  githubCallback, get_user_info, get_repos

urlpatterns = [
    path('callback/', githubCallback, name='Call back'),
    path('getinfo/', get_user_info, name='Info'),
    path('getrepos/', get_repos, name='getrepos')
]
