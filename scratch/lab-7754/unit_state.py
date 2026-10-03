"""Log a unit's state only when it changes."""

import logging

logger = logging.getLogger(__name__)

# The last state this process logged for each unit.
_last_logged: dict[str, str] = {}


def log_state_change(unit: str, state: str) -> None:
    """Log a unit's state only when it differs from the last one this process logged."""
    if _last_logged.get(unit) == state:
        return
    _last_logged[unit] = state
    logger.info("unit %s is now %s", unit, state)
