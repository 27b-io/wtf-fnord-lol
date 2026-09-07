"""LAB-3125 AC-3: positive verification — real except Exception: handler."""


def fetch_data(url: str) -> dict:
    """Fetch data from a URL."""
    try:
        import urllib.request
        with urllib.request.urlopen(url) as resp:
            return {"status": resp.status}
    except Exception:
        return {"error": "failed"}
