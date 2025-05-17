# project/models.py
from django.db import models

class GitHubToken(models.Model):
    username = models.CharField(max_length=100, unique=True)
    token = models.CharField(max_length=255)

    def __str__(self):
        return self.username