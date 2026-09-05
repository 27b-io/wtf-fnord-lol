"""LAB-2219 probe (d): production-path Python using ``assert`` to validate input.

Not under ``tests/``, not ``test_*.py``. This is the genuine defect the rule exists for
(assertions are stripped under ``python -O``). Expected after the fix: this file IS
flagged by "Don't Use `assert` for Data Validation".
"""


def parse_budget(raw: str) -> int:
    assert raw.isdigit(), "budget must be a non-negative integer string"
    value = int(raw)
    assert value <= 10_000_000, "budget exceeds ceiling"
    return value
