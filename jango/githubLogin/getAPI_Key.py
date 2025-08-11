from dotenv import load_dotenv
import os
import json
import threading


load_dotenv()  # 若未自動載入
raw_keys = json.loads(os.getenv("GEMINI_API_KEY"))

class ApiKeyManager:
    def __init__(self, keys):
        if not keys:
            raise ValueError("API keys list cannot be empty.")
        self._keys = keys
        self._lock = threading.Lock()
        self._current_index = 0

    def get_next_key(self):
        """Atomically gets the next key and advances the index."""
        with self._lock:
            key = self._keys[self._current_index]
            self._current_index = (self._current_index + 1) % len(self._keys)
            print(f"Using API Key at index: {self._current_index -1 if self._current_index > 0 else len(self._keys) - 1}")
            return key

key_manager = ApiKeyManager(raw_keys)