#!/usr/bin/env python3
"""
geocode.py — turn a listing's own address into real coordinates via Yandex.

Uses the Yandex Geocoder HTTP API (the project already uses Yandex Maps). Each
listing is geocoded from ITS OWN address, so the point belongs to that listing
and nothing else. Results are validated against the Tomsk agglomeration
envelope and returned with honest provenance ('geocoded' -> classified as
'unknown'/'?' on the map, never faked as a source-confirmed pin).

The API key is read from the environment (YANDEX_GEOCODER_KEY or
VITE_YANDEX_GEOCODER_KEY); it is a secret and must live in backend/.env (chmod
600, gitignored), never in code. Network calls go through an injectable
`fetcher` so the logic is unit-tested fully offline.
"""
import os
import json
import urllib.parse
import urllib.request

from geo_utils import classify_coordinates, detect_city

YANDEX_GEOCODER_URL = "https://geocode-maps.yandex.ru/1.x/"
USER_AGENT = "SofDom/1.0 (rental aggregator)"
DEFAULT_TIMEOUT = 15


def get_api_key() -> str:
    return (
        os.environ.get("YANDEX_GEOCODER_KEY")
        or os.environ.get("VITE_YANDEX_GEOCODER_KEY")
        or os.environ.get("YANDEX_MAPS_KEY")
        or ""
    ).strip()


def _http_get_json(url: str, timeout: int = DEFAULT_TIMEOUT):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        if resp.status != 200:
            raise RuntimeError(f"Yandex geocoder returned HTTP {resp.status}")
        return json.loads(resp.read().decode("utf-8"))


def _normalise_query(address: str) -> str:
    addr = (address or "").strip()
    if not addr:
        return ""
    low = addr.lower()
    if "томск" not in low and "tomsk" not in low:
        addr = f"Томская область, {addr}"
    return addr


def _parse_yandex(payload: dict):
    """Extract (lat, lng, yandex_precision) from a Yandex geocoder response."""
    try:
        members = payload["response"]["GeoObjectCollection"]["featureMember"]
    except (KeyError, TypeError):
        return None
    if not members:
        return None
    try:
        geo = members[0]["GeoObject"]
        pos = geo["Point"]["pos"]  # "<lng> <lat>"
        lng_str, lat_str = pos.split()
        lat = float(lat_str)
        lng = float(lng_str)
    except (KeyError, TypeError, ValueError):
        return None
    precision = ""
    try:
        precision = geo["metaDataProperty"]["GeocoderMetaData"]["precision"]
    except (KeyError, TypeError):
        precision = ""
    return lat, lng, precision


def geocode_address(address: str, fetcher=None, city: str = "Томск", api_key: str = None):
    """Geocode ONE address via Yandex. Returns {lat,lng,precision,source,yandex_precision} or None.

    Only points inside the Tomsk envelope survive classification; anything else
    (not found, out of region, malformed, no key) returns None, never a fake
    point. `fetcher(query)->payload` can be injected for offline tests.
    """
    query = _normalise_query(address)
    if not query:
        return None

    if fetcher is None:
        key = (api_key or get_api_key())
        if not key:
            raise RuntimeError(
                "No Yandex geocoder key: set YANDEX_GEOCODER_KEY in backend/.env"
            )

        def fetcher(q):
            params = urllib.parse.urlencode({
                "apikey": key, "geocode": q, "format": "json",
                "results": 1, "lang": "ru_RU",
            })
            return _http_get_json(f"{YANDEX_GEOCODER_URL}?{params}")

    try:
        payload = fetcher(query)
    except Exception:
        return None

    parsed = _parse_yandex(payload)
    if not parsed:
        return None
    lat, lng, ya_prec = parsed

    resolved_city = detect_city(address, raw_city=city, lat=lat, lng=lng)
    clean_lat, clean_lng, precision = classify_coordinates(
        lat, lng, city=resolved_city, source="geocoded"
    )
    if clean_lat is None or precision == "none":
        return None
    return {
        "lat": clean_lat,
        "lng": clean_lng,
        "precision": precision,
        "source": "geocoded",
        "yandex_precision": ya_prec,
    }
