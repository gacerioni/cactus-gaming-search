#!/usr/bin/env python3
"""Generate ~10K games using GPT-4o-mini. Sync + ThreadPool for reliability."""
import json, os, time, random, sys, threading
from pathlib import Path
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / "backend" / ".env")
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
GAMES_FILE = Path(__file__).resolve().parent.parent / "games_data.json"
OUTPUT_FILE = Path(__file__).resolve().parent.parent / "games_data_10k.json"

WORKERS = 5
PER_CALL = 30

PROVS = {
    "slot": ["PG Soft","Pragmatic Play","NetEnt","Play'n GO","Microgaming","Hacksaw Gaming",
             "Push Gaming","Relax Gaming","Big Time Gaming","Yggdrasil","Red Tiger","Nolimit City",
             "ELK Studios","Blueprint Gaming","Betsoft","Habanero","BGaming","Novomatic","IGT","Spinomenal"],
    "crash": ["Spribe","Turbo Games","SmartSoft Gaming","Gaming Corps","BGaming","Caleta Gaming",
              "Aviatrix","Upgaming","Galaxsys","Evoplay"],
    "live": ["Evolution","Pragmatic Play Live","Ezugi","Vivo Gaming","SA Gaming",
             "BetGames.TV","Lucky Streak","Authentic Gaming"],
    "esporte": ["Sportsbet","Betway Sports","Bet365","Sportingbet","1xBet","Betano",
                "Rivalo","KTO","Novibet","Pinnacle","EstrelaBet"],
}

THEMES = [
    ("slot",250,"egípcia faraós pirâmides Anubis Rá múmias escaravelho"),
    ("slot",250,"asiática dragões chineses fortuna lanternas jade koi"),
    ("slot",250,"nórdica vikings Thor Odin Valhalla runas gelo"),
    ("slot",250,"frutas doces candy cristais gemas joias bombons"),
    ("slot",250,"animais selvagens safari búfalo lobo águia leão"),
    ("slot",250,"marítima piratas oceano sereias tubarões tesouro"),
    ("slot",250,"fantasia magos elfos dragões masmorras feitiços"),
    ("slot",200,"velho oeste cowboys ouro saloon bandidos xerife"),
    ("slot",200,"greco-romana Zeus Olympus Hades gladiadores Atena"),
    ("slot",200,"Halloween horror vampiros lobisomens fantasmas"),
    ("slot",200,"espacial galáxias aliens planetas astronautas"),
    ("slot",200,"irlandesa duendes trevos leprechaun arco-íris"),
    ("slot",200,"festa música carnaval disco neon Las Vegas"),
    ("slot",200,"aventura exploradores selva templos mapas tesouro"),
    ("slot",200,"Megaways cascata cluster pays buy bonus multiplicadores"),
    ("slot",200,"brasileira samba carnaval futebol Amazônia festa junina"),
    ("slot",150,"luxo diamantes riqueza mansão champagne Ferrari VIP"),
    ("slot",150,"anime mangá samurai ninja Japão cultura pop"),
    ("slot",150,"mitologia Medusa Fênix Minotauro Kraken Cerbero"),
    ("slot",150,"Natal inverno neve presentes renas trenó festa"),
    ("esporte",250,"Brasileirão Série A Flamengo Palmeiras Corinthians São Paulo Grêmio Inter"),
    ("esporte",250,"Brasileirão Série B e estaduais times regionais"),
    ("esporte",250,"Champions League Europa League Real Madrid Barcelona Bayern PSG Liverpool"),
    ("esporte",200,"Premier League Arsenal Chelsea Tottenham Newcastle"),
    ("esporte",200,"La Liga Serie A italiana Bundesliga Ligue 1"),
    ("esporte",200,"Copa do Mundo Eliminatórias seleções nacionais"),
    ("esporte",200,"NBA Lakers Warriors Celtics Heat Bulls basquete"),
    ("esporte",200,"UFC MMA lutadores brasileiros peso-pesado"),
    ("esporte",200,"NFL Super Bowl futebol americano touchdown"),
    ("esporte",200,"tênis Grand Slam Fórmula 1 vôlei e-sports olimpíadas"),
    ("esporte",200,"Copa Libertadores Sul-Americana Boca River times SA"),
    ("esporte",200,"apostas ao vivo handicap over/under cantos cartões gols"),
    ("crash",170,"aviator foguete balão subida multiplicador cash out"),
    ("crash",170,"espacial corrida velocidade propulsão órbita"),
    ("crash",160,"mines plinko dice keno hi-lo instant games turbo"),
    ("live",250,"blackjack clássico VIP speed infinite party brasileiro"),
    ("live",250,"roleta europeia americana brasileira lightning speed"),
    ("live",250,"baccarat squeeze speed dragon tiger no commission"),
    ("live",250,"game shows Crazy Time Monopoly Dream Catcher roda fortuna"),
    ("live",200,"poker ao vivo Casino Holdem Three Card Caribbean Stud"),
    ("live",200,"Sic Bo Fan Tan loteria ao vivo Andar Bahar dados"),
]

SYS = """Gere jogos ÚNICOS para iGaming BR. JSON {"games":[...]}.
Cada: {"nome":"...","provider":"...","aliases":"apelidos br","description":"1 frase pt-br","popularity":1-100,"tags":"..."}
Nomes criativos variados. Aliases=gírias brasileiras. Sem repetir nomes."""

generated_names = set()
lock = threading.Lock()
stats = {"done": 0, "total": 0, "games": 0}


def gen_call(cat, tema, count, start_id):
    provs = random.sample(PROVS[cat], min(5, len(PROVS[cat])))
    for attempt in range(3):
        try:
            print(f"    📡 Calling API: {cat} {tema[:30]}... ({count} games)...", end="", flush=True)
            r = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": SYS},
                    {"role": "user", "content": f"{count} jogos '{cat}' tema: {tema}. Providers: {', '.join(provs)}."},
                ],
                temperature=0.95, max_tokens=4000,
                response_format={"type": "json_object"},
            )
            data = json.loads(r.choices[0].message.content)
            games = data.get("games", data.get("jogos", []))
            if not isinstance(games, list):
                continue
            result = []
            for g in games:
                name = g.get("nome", "").strip()
                if not name or name in generated_names:
                    continue
                generated_names.add(name)
                g["id_jogo"] = str(start_id + len(result))
                g["categoria"] = cat
                result.append(g)
            stats["done"] += 1
            stats["games"] += len(result)
            pct = int(stats["done"] / stats["total"] * 100)
            print(f"  [{stats['done']}/{stats['total']}] {pct}% | {cat} {tema[:35]}... → {len(result)} (total: {stats['games']})", flush=True)
            return result
        except Exception as e:
            print(f"  ❌ {cat}/{tema[:20]} attempt {attempt+1}: {e}", flush=True)
            time.sleep(2)
    return []


def main():
    with open(GAMES_FILE, "r", encoding="utf-8") as f:
        existing = json.load(f)["games"]
    for g in existing:
        generated_names.add(g["nome"])
    next_id = max(int(g["id_jogo"]) for g in existing) + 1

    # Build call list
    calls = []
    id_off = next_id
    for cat, count, tema in THEMES:
        rem = count
        while rem > 0:
            c = min(rem, PER_CALL)
            calls.append((cat, tema, c, id_off))
            id_off += c
            rem -= c

    stats["total"] = len(calls)
    print(f"📦 Existing: {len(existing)} games")
    print(f"📡 API calls: {len(calls)} with {WORKERS} workers")
    print(f"🎯 Target: ~{sum(c for _, c, _ in THEMES) + len(existing)} games")
    print(flush=True)

    t0 = time.time()
    all_new = []
    for c in calls:
        result = gen_call(*c)
        if result:
            all_new.extend(result)

    elapsed = time.time() - t0

    # Reassign sequential IDs
    for i, g in enumerate(all_new):
        g["id_jogo"] = str(next_id + i)

    final = existing + all_new
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump({"games": final}, f, ensure_ascii=False, indent=2)

    cats = {}
    for g in final:
        cats[g.get("categoria", "?")] = cats.get(g.get("categoria", "?"), 0) + 1

    print(f"\n{'='*60}")
    print(f"✅ COMPLETO em {elapsed:.0f}s ({elapsed/60:.1f}min)")
    print(f"{'='*60}")
    print(f"📊 Total: {len(final)} ({len(existing)} orig + {len(all_new)} new)")
    print(f"📊 Categorias: {cats}")
    print(f"\n⚡ Próximos passos:")
    print(f"   cp games_data_10k.json games_data.json")
    print(f"   python3 scripts/enrich_games.py")
    print(f"   ./scripts/deploy_full_reset.sh")

if __name__ == "__main__":
    main()
generated_names = set()
lock = __import__('threading').Lock()
stats = {"done": 0, "total": 0, "games": 0}

