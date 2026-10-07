"""LAB-8465 probe: a doctest whose expected output is an exception repr (must NOT fire 7fcc2cda)."""


class SomeError(Exception):
    """Wraps a backend error."""


def classify(exc: BaseException) -> SomeError:
    """Classify a backend error.

    >>> error = classify(ConnectionError("x"))
    >>> error
    SomeError('x')
    """
    return SomeError(*exc.args)
