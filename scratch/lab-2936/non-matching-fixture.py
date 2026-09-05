# LAB-2936 AC3: this file does NOT match the .kody/rules path scope
# (scratch/lab-2936/**/*.ts only matches .ts) — same bare-fetch-shaped
# violation, but in a .py file, so the scratch rule should NOT fire here.
import urllib.request


def load_scratch_fixture(url: str) -> bytes:
    res = urllib.request.urlopen(url)
    return res.read()
