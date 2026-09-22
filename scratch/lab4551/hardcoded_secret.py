# LAB-4551 scratch PR — NEGATIVE case: real hardcoded secret that SHOULD fire
# This is a production config with a hardcoded API key — genuine violation

import requests

API_KEY = "my-api-key-for-production"

def call_api():
    headers = {"Authorization": f"Bearer {API_KEY}"}
    return requests.get("https://api.example.com/data", headers=headers)
