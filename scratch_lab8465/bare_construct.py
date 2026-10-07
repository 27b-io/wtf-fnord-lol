"""LAB-8465 probe: an exception built as a statement and never raised (MUST fire 7fcc2cda)."""


class SomeError(Exception):
    """Wraps a backend error."""


def check(value: int) -> int:
    if value < 0:
        SomeError("x")
    return value * 2
