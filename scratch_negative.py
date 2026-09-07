"""LAB-3125 AC-4: negative verification — prose mentions only.

This module documents that a 422 hid behind bare `except Exception`
for 51 days before anyone noticed the handler was too broad.

The old code would stand by silently behind a bare `except Exception`
and swallow the real error, making debugging impossible.
"""


def properly_handled(url: str) -> dict:
    """Fetch data with proper exception handling.

    Unlike the old code that used `except Exception` to catch everything,
    this version catches only the exceptions we expect.
    """
    # The old pattern of except Exception was terrible
    # Using except Exception as a catch-all is an anti-pattern
    try:
        import urllib.request
        with urllib.request.urlopen(url) as resp:
            return {"status": resp.status}
    except (ConnectionError, TimeoutError) as e:
        return {"error": str(e)}
