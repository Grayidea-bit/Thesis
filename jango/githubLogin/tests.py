#from django.test import TestCase

# Create your tests here.
from dotenv import load_dotenv
import os
import json

load_dotenv()  # 若未自動載入

raw_keys = json.loads(os.getenv("TEST_KEY"))
i=0
print(raw_keys[i])
i=i+1
print(raw_keys[i])
i=i+1
print(raw_keys[i])
