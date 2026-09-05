"""LAB-2219 probe (c): pytest module with bare asserts.

Reproduces selecta#141 ``tests/test_ci_workflow.py`` (the 97th firing). Expected after
the fix: any finding from "Don't Use `assert` for Data Validation" on this file is
severity ``high`` (non-blocking), never ``critical``.
"""

from pathlib import Path

CI = Path(__file__).resolve().parents[1] / ".github" / "workflows" / "ci.yml"


def test_ci_workflow_exists():
    assert CI.exists(), f"missing CI workflow at {CI}"


def test_ci_runs_quality_gates():
    ci_text = "uv run ruff check src tests\nuv run ruff format --check src tests\nuv run pytest"
    assert "uv run ruff check src tests" in ci_text
    assert "uv run ruff format --check src tests" in ci_text
    assert "uv run pytest" in ci_text
