"""an exception built as a statement and never raised."""


class SomeError(Exception):
    """Wraps a backend error."""


def check(value: int) -> int:
    if value < 0:
        SomeError("x")
    return value * 2
