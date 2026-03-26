#!/usr/bin/env python3
"""
Enrich games_data.json with image, rtp, and slug fields.
- slug: URL-friendly version of the game name
- image: picsum.photos seeded URL (consistent per game)
- rtp: realistic RTP per category (slots ~94-97%, crash ~97%, live ~97-99%, esporte=null)
"""
import json
import re
import random
from pathlib import Path

GAMES_FILE = Path(__file__).resolve().parent.parent / "games_data.json"

# RTP ranges by category (realistic values)
RTP_RANGES = {
    "slot": (94.0, 97.5),
    "crash": (96.0, 99.0),
    "live": (97.0, 99.5),
    "esporte": None,  # sports don't have RTP
}

# Specific RTPs for well-known games (real-world values)
KNOWN_RTPS = {
    "Fortune Tiger": 96.81,
    "Fortune Ox": 96.75,
    "Fortune Mouse": 96.76,
    "Fortune Rabbit": 96.71,
    "Gates of Olympus": 96.50,
    "Gates of Olympus 1000": 96.50,
    "Sweet Bonanza": 96.48,
    "Big Bass Bonanza": 96.71,
    "Aviator": 97.00,
    "Spaceman": 96.50,
    "Sugar Rush": 96.50,
    "Starlight Princess": 96.50,
    "Wolf Gold": 96.01,
    "Book of Dead": 96.21,
    "Gonzo's Quest": 95.97,
    "Starburst": 96.09,
    "Mega Moolah": 88.12,
    "Crazy Time": 96.08,
    "Lightning Roulette": 97.30,
    "Monopoly Live": 96.23,
    "Mines": 97.00,
    "JetX": 97.00,
    "Bonanza": 96.00,
    "The Dog House": 96.51,
    "Money Train 2": 96.40,
    "Money Train 3": 96.10,
    "Wanted Dead or a Wild": 96.38,
    "Razor Shark": 96.70,
    "Reactoonz": 96.51,
    "Moon Princess": 96.00,
    "Rise of Olympus": 96.50,
    "Plinko": 97.00,
    "Dragon Hatch": 96.74,
    "Dead or Alive 2": 96.82,
    "Jammin' Jars": 96.83,
    "Extra Chilli": 96.20,
    "White Rabbit": 97.24,
}


def make_slug(name: str) -> str:
    """Convert game name to URL-friendly slug."""
    slug = name.lower()
    slug = re.sub(r'[àáâãäå]', 'a', slug)
    slug = re.sub(r'[èéêë]', 'e', slug)
    slug = re.sub(r'[ìíîï]', 'i', slug)
    slug = re.sub(r'[òóôõö]', 'o', slug)
    slug = re.sub(r'[ùúûü]', 'u', slug)
    slug = re.sub(r'[ç]', 'c', slug)
    slug = re.sub(r"[''']", '', slug)
    slug = re.sub(r'[^a-z0-9]+', '-', slug)
    slug = slug.strip('-')
    return slug


def get_rtp(game: dict) -> float | None:
    """Get RTP for a game. Uses known values or generates realistic ones."""
    nome = game["nome"]
    categoria = game.get("categoria", "slot")

    # Check known RTPs first
    if nome in KNOWN_RTPS:
        return KNOWN_RTPS[nome]

    # No RTP for sports
    rtp_range = RTP_RANGES.get(categoria)
    if rtp_range is None:
        return None

    # Generate deterministic RTP based on game id
    random.seed(int(game["id_jogo"]) * 17 + 42)
    rtp = round(random.uniform(rtp_range[0], rtp_range[1]), 2)
    return rtp


def get_image_url(slug: str, game_id: str) -> str:
    """Generate a consistent placeholder image URL."""
    return f"https://picsum.photos/seed/{slug}/400/300"


def main():
    with open(GAMES_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    games = data["games"]
    print(f"📦 Enriching {len(games)} games...")

    for game in games:
        slug = make_slug(game["nome"])
        game["slug"] = slug
        game["rtp"] = get_rtp(game)
        game["image"] = get_image_url(slug, game["id_jogo"])

    with open(GAMES_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    # Stats
    cats = {}
    for g in games:
        cat = g.get("categoria", "unknown")
        cats[cat] = cats.get(cat, 0) + 1

    print(f"✅ Done! {len(games)} games enriched.")
    print(f"📊 Categories: {cats}")
    print(f"🖼️  Sample: {games[0]['nome']} → slug={games[0]['slug']}, rtp={games[0]['rtp']}, image={games[0]['image']}")


if __name__ == "__main__":
    main()

