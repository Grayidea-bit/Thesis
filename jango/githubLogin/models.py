from django.db import models

class User(models.Model):
    github_id = models.CharField(max_length=100, unique=True)
    username = models.CharField(max_length=100)
    avatar_url = models.URLField()

    def __str__(self):
        return self.username

class TrackedRepo(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='tracked_repos')
    repo_name = models.CharField(max_length=200)  # e.g. "my-awesome-repo"
    repo_owner = models.CharField(max_length=100) # e.g. "octocat"
    html_url = models.URLField()  # e.g. "https://github.com/octocat/my-awesome-repo"
    tracked_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.repo_owner}/{self.repo_name}"
