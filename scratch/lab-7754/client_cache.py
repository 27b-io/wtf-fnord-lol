"""Per-process cache of backend clients."""

import os
import threading

_owner_pid: int | None = None
_owned_clients: dict[str, object] = {}


def _connect(name: str) -> object:
    return object()  # stands in for an expensive connection


def get_client(name: str) -> object:
    global _owner_pid, _owned_clients
    if _owner_pid != os.getpid():
        # First call in this process, or the first after a fork: drop the parent's clients.
        _owned_clients = {}
        _owner_pid = os.getpid()
    client = _owned_clients.get(name)
    if client is None:
        client = _connect(name)
        _owned_clients[name] = client
    return client


def warm(names: list[str]) -> None:
    threads = [threading.Thread(target=get_client, args=(name,)) for name in names]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
