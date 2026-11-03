"""Small explicit crawler registry with published OpenAI IP verification."""
import ipaddress
import json
import re
import time
import urllib.request
from pathlib import Path

FEEDS = {
    "GPTBot": "https://openai.com/gptbot.json",
    "ChatGPT-User": "https://openai.com/chatgpt-user.json",
    "OAI-SearchBot": "https://openai.com/searchbot.json",
}
CLAIMED_ONLY = ("ClaudeBot", "PerplexityBot")
MAX_AGE = 48 * 3600


def parse_feed(payload):
    data = json.loads(payload)
    networks = []
    for entry in data["prefixes"]:
        for key in ("ipv4Prefix", "ipv6Prefix"):
            if key in entry:
                networks.append(str(ipaddress.ip_network(entry[key], strict=True)))
    if not networks:
        raise ValueError("crawler feed has no ranges")
    return networks


def refresh(cache_path, now=None):
    now = time.time() if now is None else now
    cache_path = Path(cache_path)
    try:
        cache = json.loads(cache_path.read_text())
    except (FileNotFoundError, ValueError):
        cache = {}
    for name, url in FEEDS.items():
        if now - cache.get(name, {}).get("fetched_at", 0) < 86400:
            continue
        try:
            with urllib.request.urlopen(url, timeout=10) as response:
                payload = response.read(1024 * 1024 + 1)
            if len(payload) > 1024 * 1024:
                raise ValueError("crawler feed too large")
            cache[name] = {"ranges": parse_feed(payload), "fetched_at": now}
        except (OSError, ValueError, KeyError, json.JSONDecodeError):
            pass  # Last-good data stays cached, but becomes stale after 48 hours.
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(cache))
    return cache


def classify(user_agent, address, ranges, now=None):
    now = time.time() if now is None else now
    for name in (*FEEDS, *CLAIMED_ONLY):
        if not re.search(r"(?<![A-Za-z0-9_-])" + re.escape(name) + r"(?![A-Za-z0-9_-])", user_agent, re.I):
            continue
        entry = ranges.get(name, {})
        if name in FEEDS and now - entry.get("fetched_at", 0) <= MAX_AGE:
            try:
                client = ipaddress.ip_address(address)
                if any(client in ipaddress.ip_network(net) for net in entry.get("ranges", [])):
                    return "verified", name
            except ValueError:
                pass
        return "claimed", name
    return "unknown", "unknown"
