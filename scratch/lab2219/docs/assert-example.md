# Input validation notes (LAB-2219 probe b)

This page exists to reproduce the pattern Kody flagged on cachekit-io/bluesky-thinking#23:
a Python code fence inside a Markdown document. Expected after the rule is scoped to
`**/*.py`: ZERO findings from "Don't Use `assert` for Data Validation" on this file.

```python
def load(cfg):
    assert cfg is not None, "cfg required"
    return cfg
```

The fence above is documentation, not code that runs under `python -O`.
