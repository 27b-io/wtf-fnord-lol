"""LAB-8465 probe: record the caller's exception, then re-raise it unchanged (must NOT fire e05301ee)."""

from collections.abc import Callable


def run_recorded(body: Callable[[], int]) -> int:
    body_error: BaseException | None = None
    try:
        return body()
    except Exception as e:
        body_error = e
        raise
    finally:
        if body_error is not None:
            print(f"body failed: {type(body_error).__name__}")
