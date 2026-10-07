"""LAB-8465 probe: broad handlers that swallow (MUST fire e05301ee)."""

import logging

logger = logging.getLogger(__name__)


def load_config(path: str) -> str:
    try:
        with open(path) as fh:
            return fh.read()
    except Exception:
        pass
    return ""


def fetch_count(client) -> int:
    try:
        return client.count()
    except Exception as e:
        logger.warning("count failed: %s", e)
        return 0
