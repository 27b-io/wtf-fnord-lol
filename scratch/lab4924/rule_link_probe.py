# Scratch fixture: deliberate rule violations so the review bot posts rule findings.
# Close unmerged.

import requests

API_KEY = "my-api-key-for-production"


def call_api():
    headers = {"Authorization": f"Bearer {API_KEY}"}
    return requests.get("https://api.example.com/data", headers=headers)
