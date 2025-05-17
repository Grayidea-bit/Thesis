"""
URL configuration for demoweb project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from project import views

urlpatterns = [
    path('', views.root),
    path('auth/github/login/', views.github_login),
    path('auth/github/callback/', views.github_callback),
    path('repos/', views.get_repos),
    path('repos/<str:owner>/<str:repo>/commits/', views.get_commits),
    path('repos/<str:owner>/<str:repo>/commits/<str:sha>/diff', views.get_commit_diff),
    path('repos/<str:owner>/<str:repo>/overview', views.get_repo_overview, name='repo_overview'),
    path('repos/<str:owner>/<str:repo>/chat', views.chat_with_repo, name='chat_with_repo'),
    path('repos/<str:owner>/<str:repo>/commits/<str:sha>/analyze', views.analyze_commit_diff, name='analyze_commit_diff'),   
]
