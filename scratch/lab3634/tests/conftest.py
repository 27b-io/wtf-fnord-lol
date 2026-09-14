"""LAB-3634 scratch fixture: a bare assert in conftest.py must NOT be flagged by the assert rule."""

import pytest


@pytest.fixture
def widget_count():
    count = 3
    assert count > 0
    return count
