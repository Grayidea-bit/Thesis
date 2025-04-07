from django.shortcuts import render
from django.http import HttpResponse
# Create your views here.
#request -> response
#request handler
def cal():
    x = 1
    y = 2
    return x+y

def sayHello(request):
    x = cal()
    return render(request, 'hello.html', {"name": "Gray"})


