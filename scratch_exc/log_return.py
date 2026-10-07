"""a broad handler that logs and returns a default."""

import logging

logger = logging.getLogger(__name__)


def fetch_count(client) -> int:
    try:
        return client.count()
    except Exception as e:
        logger.warning("count failed: %s", e)
        return 0
