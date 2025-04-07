from django.urls import path
from . import views

#urlConfig
urlpatterns = [
    path("hello/",views.sayHello)
]