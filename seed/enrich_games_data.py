"""
Enriquece games_data.json com image, rtp e slug vindos da API Cactus (7k.bet.br)
Faz match por nome normalizado (sem acento, lowercase)
"""
import json, re, time, unicodedata
from pathlib import Path

try:
    import requests
except ImportError:
    import subprocess, sys
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'requests', '-q'])
    import requests

GAMES_FILE = Path(__file__).resolve().parent.parent / "games_data.json"
API_BASE   = "https://7k.bet.br/api/casino-games/filter"

def normalize(s: str) -> str:
    s = s.lower().strip()
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    s = re.sub(r'[^a-z0-9 ]', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()

def fetch_all_api_games() -> list:
    games, page, per_page = [], 1, 100
    print("📡 Buscando jogos da API Cactus...")
    while True:
        resp = requests.get(API_BASE, params={
            'term': '', 'categories[]': 'all',
            'page': page, 'per_page': per_page
        }, timeout=15)
        data = resp.json()
        batch = data.get('data', [])
        games.extend(batch)
        print(f"  Página {page}/{data['last_page']} — {len(games)} jogos até agora")
        if page >= data['last_page']:
            break
        page += 1
        time.sleep(0.3)
    print(f"✅ Total API: {len(games)} jogos")
    return games

def build_lookup(api_games: list) -> dict:
    """{ normalized_name: { image, rtp, slug } }"""
    lookup = {}
    for g in api_games:
        key = normalize(g['name'])
        if key not in lookup:
            lookup[key] = {
                'image': g.get('image', ''),
                'rtp':   g.get('rtp', '') or '',
                'slug':  g.get('slug', '') or '',
            }
    return lookup

def enrich(our_games: list, lookup: dict) -> tuple:
    matched, missed = 0, []
    for game in our_games:
        key = normalize(game['nome'])
        if key in lookup:
            game.update(lookup[key])
            matched += 1
        else:
            # Tenta match parcial: qualquer palavra do nome
            words = [w for w in key.split() if len(w) > 3]
            found = None
            for w in words:
                candidates = [k for k in lookup if w in k.split()]
                if len(candidates) == 1:
                    found = candidates[0]
                    break
            if found:
                game.update(lookup[found])
                matched += 1
                print(f"  ~match parcial: '{game['nome']}' → '{found}'")
            else:
                game.setdefault('image', '')
                game.setdefault('rtp', '')
                game.setdefault('slug', '')
                missed.append(game['nome'])
    return matched, missed

def main():
    with open(GAMES_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    our_games = data['games']
    print(f"📂 Nossos jogos: {len(our_games)}")

    api_games = fetch_all_api_games()
    lookup    = build_lookup(api_games)

    matched, missed = enrich(our_games, lookup)

    with open(GAMES_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\n✅ Enriquecidos: {matched}/{len(our_games)}")
    if missed:
        print(f"⚠️  Sem match ({len(missed)}): {', '.join(missed[:10])}")
    print(f"💾 games_data.json salvo!")

if __name__ == '__main__':
    main()


