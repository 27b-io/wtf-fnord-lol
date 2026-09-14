"""LAB-3634 scratch pytest module: bare asserts are the pytest idiom and must NOT be flagged."""


def add(a, b):
    return a + b


def test_add_positive():
    assert add(1, 2) == 3


def test_add_zero():
    assert add(0, 0) == 0


def test_add_negative(widget_count):
    assert add(widget_count, -3) == 0
    assert widget_count == 3
