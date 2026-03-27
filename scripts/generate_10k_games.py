#!/usr/bin/env python3
"""Generate ~10K realistic games programmatically. No LLM, runs in <1s."""
import json, random, re, hashlib
from pathlib import Path
from itertools import product

GAMES_FILE = Path(__file__).resolve().parent.parent / "games_data.json"
OUTPUT_FILE = Path(__file__).resolve().parent.parent / "games_data_10k.json"

# ─── SLOT NAME COMPONENTS ─────────────────────────────────
ANIMALS = ["Wolf","Eagle","Buffalo","Lion","Panther","Tiger","Rhino","Mustang","Hawk","Bear",
           "Cobra","Dragon","Phoenix","Falcon","Jaguar","Gorilla","Stallion","Shark","Raven","Ox",
           "Serpent","Scorpion","Stag","Bison","Coyote","Leopard","Viper","Crane","Mantis","Puma",
           "Moose","Lynx","Condor","Barracuda","Chameleon","Pelican","Toucan","Flamingo","Dolphin","Whale"]

POWER = ["Gold","King","Strike","Rush","Fury","Blaze","Storm","Thunder","Crown","Fortune",
         "Reign","Rampage","Legends","Megaways","Bonanza","Ways","Deluxe","Jackpot","Supreme","Ultra",
         "Wild","Platinum","Fire","Power","Frenzy","Glory","Empire","Rising","Unleashed","X"]

MYTH_FIGURES = ["Zeus","Athena","Hades","Odin","Thor","Loki","Freya","Anubis","Ra","Isis",
                "Medusa","Poseidon","Ares","Hermes","Apollo","Artemis","Bastet","Horus","Osiris","Set",
                "Cleopatra","Pharaoh","Caesar","Spartacus","Achilles","Hercules","Perseus","Midas","Kronos","Atlas"]

MYTH_POWER = ["Riches","Treasures","Fortune","Quest","Legacy","Wrath","Realm","Fury","Kingdom","Temple",
              "Throne","Curse","Rise","Fall","Trials","Conquest","Odyssey","Saga","Chronicle","Awakening"]

THEMES = ["Aztec","Egyptian","Viking","Celtic","Samurai","Pirate","Jungle","Desert","Arctic","Mystic",
          "Crystal","Shadow","Golden","Royal","Ancient","Enchanted","Forbidden","Hidden","Sacred","Lost",
          "Emerald","Ruby","Sapphire","Diamond","Jade","Obsidian","Amber","Opal","Topaz","Pearl"]

FEATURES = ["Gems","Riches","Fortune","Quest","Treasures","Spins","Wilds","Bonus","Cash","Wins",
            "Luck","Stars","Dreams","Magic","Blitz","Blast","Drop","Burst","Cascade","Twist"]

BOOK_OF = ["Dead","Shadows","Fallen","Ra","Gods","Kings","Secrets","Gold","Power","Destiny",
           "Demons","Legends","Ages","Realms","Tombs","Sands","Flames","Stars","Wolves","Dragons"]

SWEET = ["Bonanza","Rush","Paradise","Fiesta","Kingdom","Land","Dream","Carnival","Explosion","Stack",
         "Crush","Frenzy","Mania","Bliss","Delight","Surprise","Party","Treats","Craze","World"]
SWEET_PREFIX = ["Sweet","Sugar","Candy","Fruity","Berry","Honey","Choco","Cookie","Cake","Lollipop"]

MEGA = ["Ways","Wins","Spins","Lines","Stars","Gems","Gold","Cash","Coins","Diamonds"]
MEGA_PREFIX = ["Mega","Super","Hyper","Ultra","Turbo","Max","Giga","Power","Infinity","Nitro"]

PROVIDERS_SLOT = ["PG Soft","Pragmatic Play","NetEnt","Play'n GO","Microgaming","Hacksaw Gaming",
    "Push Gaming","Relax Gaming","Big Time Gaming","Yggdrasil","Red Tiger","Nolimit City",
    "ELK Studios","Blueprint Gaming","Betsoft","Habanero","BGaming","Spinomenal","Evoplay","Thunderkick",
    "Wazdan","Endorphina","iSoftBet","Kalamba Games","Peter & Sons","Booming Games","Amatic","Novomatic","IGT"]

PROVIDERS_CRASH = ["Spribe","Turbo Games","SmartSoft Gaming","Gaming Corps","BGaming",
    "Caleta Gaming","Aviatrix","Upgaming","Galaxsys","Evoplay","OneTouch"]

PROVIDERS_LIVE = ["Evolution","Pragmatic Play Live","Ezugi","Vivo Gaming","SA Gaming",
    "BetGames.TV","Lucky Streak","Authentic Gaming","XPG"]

# ─── DESCRIPTION TEMPLATES ────────────────────────────────
DESC_ANIMAL = [
    "Slot selvagem com o poderoso {a}. Multiplicadores, rodadas grátis e símbolos wild em ação.",
    "Aventura na selva com o {a}. Gráficos incríveis, bônus e grandes prêmios.",
    "O {a} domina os rolos neste slot emocionante com recursos de free spins e multiplicadores.",
    "Sinta a força do {a} neste caça-níquel com wilds expansivos e jackpot progressivo.",
]
DESC_MYTH = [
    "{f} revela seus segredos neste slot épico. Rodadas grátis, multiplicadores e prêmios lendários.",
    "Entre no reino de {f}. Slot com gráficos cinematográficos, bônus e respins.",
    "A lenda de {f} ganha vida com wilds, scatters e um bônus de free spins épico.",
]
DESC_THEME = [
    "Explore o mundo {t} neste slot com {fe} e grandes multiplicadores.",
    "Aventura {t} com {fe}, rodadas grátis e bônus especiais.",
    "Descubra os segredos {t} com {fe}, wilds e scatters misteriosos.",
]
DESC_BOOK = [
    "Slot estilo Book com tema de {b}. Símbolos expansivos nas rodadas grátis e grande potencial de prêmio.",
    "Abra o livro e descubra os segredos de {b}. Free spins com símbolos especiais expansivos.",
]
DESC_SWEET = [
    "Slot doce e colorido com tema de {s}. Cascade wins, multiplicadores crescentes e bônus saboroso.",
    "Mergulhe no mundo dos doces com {s}. Tumble feature, free spins e grandes prêmios.",
]
DESC_MEGA = [
    "Slot turbinado com mecânica {m}. Milhares de formas de ganhar a cada spin.",
    "Ação intensa com {m}. Multiplicadores, avalanche de prêmios e potencial máximo explosivo.",
]

# ─── CRASH GAMES ──────────────────────────────────────────
CRASH_PREFIX = ["Aviator","Rocket","Balloon","Spaceman","JetX","Plinko","Mines","Dice","Keno","HiLo",
    "Limbo","Goal","Tower","Crash","Turbo","Comet","Orbit","Launch","Boost","Blitz"]
CRASH_SUFFIX = ["X","Pro","Max","Turbo","Classic","Deluxe","3D","VIP","Mini","Plus",
    "Rush","Fury","Blast","Ultra","Mega","Extreme","Supreme","Elite","Prime","Gold"]
DESC_CRASH = [
    "Jogo crash de multiplicador crescente. Faça cash out antes do crash e multiplique seus ganhos.",
    "Aposte e acompanhe o multiplicador subir. Quanto mais esperar, maior o prêmio — mas cuidado com o crash!",
    "Jogo instantâneo de risco e recompensa. Multiplicadores que podem chegar a 1000x ou mais.",
    "Adrenalina pura neste jogo de cash out. Defina seu auto-cashout ou arrisque tudo no multiplicador.",
]

# ─── LIVE GAMES ───────────────────────────────────────────
LIVE_TYPES = {
    "Blackjack": (["Classic","VIP","Speed","Infinite","Party","Brazilian","Platinum","Diamond",
        "Silver","Gold","Power","Lightning","Fortune","Royal","Premium","Elite","Salon","Grand",
        "Lucky","Free Bet","Surrender","Switch","Perfect Pairs","Side Bet City"],
        ["Mesa de blackjack ao vivo com dealer profissional. Faça 21 e ganhe com odds reais.",
         "Blackjack com crupiê real em tempo real. Seguro, split, double down e side bets disponíveis."]),
    "Roulette": (["European","American","French","Lightning","Speed","Auto","Brazilian","VIP",
        "Immersive","Double Ball","Quantum","Mega","Instant","Gold","Platinum","Turkish","Arabic",
        "XXXtreme","Power Up","Grand","Lucky","Fortune","Royal","Diamond"],
        ["Roleta ao vivo com dealer real. Aposte em números, cores, pares e ímpares com emoção.",
         "Gire a roleta com crupiê profissional. Apostas internas, externas e especiais disponíveis."]),
    "Baccarat": (["Squeeze","Speed","No Commission","Dragon Tiger","VIP","Salon Privé","Super 6",
        "Lightning","Fortune","Golden","Crystal","Royal","Diamond","Platinum","Premium","Grand",
        "Lucky","Classic","Turbo","Progressive","Mini","Punto Banco"],
        ["Baccarat ao vivo com crupiê profissional. Aposte no jogador, banqueiro ou empate.",
         "Mesa de bacará em tempo real. Squeeze, side bets e estatísticas ao vivo."]),
    "Game Show": (["Crazy Time","Monopoly Live","Dream Catcher","Deal or No Deal","Lightning Dice",
        "Mega Ball","Football Studio","Cash or Crash","Funky Time","Sweet Bonanza CandyLand",
        "Adventures Beyond Wonderland","Gonzo's Treasure Hunt","Stock Market","Boom City","Extra Chilli Epic"],
        ["Game show ao vivo com apresentador carismático. Multiplicadores gigantes e prêmios em tempo real.",
         "Show interativo ao vivo com rodadas bônus, multiplicadores e muita diversão."]),
    "Poker": (["Casino Hold'em","Three Card","Caribbean Stud","Texas Hold'em Bonus","Ultimate Texas",
        "Poker Bet Behind","Side Bet City","2 Hand Casino Hold'em"],
        ["Poker ao vivo contra a casa. Aposte, blefe e ganhe com suas melhores mãos.",
         "Mesa de poker com dealer real. Ante, call, raise e side bets disponíveis."]),
}


# ─── HELPERS ──────────────────────────────────────────────
def slug(name):
    s = name.lower()
    for a, b in [('á','a'),('à','a'),('â','a'),('ã','a'),('é','e'),('ê','e'),('í','i'),('ó','o'),('ô','o'),('õ','o'),('ú','u'),('ç','c')]:
        s = s.replace(a, b)
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')

def stable_rtp(name):
    h = int(hashlib.md5(name.encode()).hexdigest()[:8], 16)
    return round(93.0 + (h % 500) / 100, 2)  # 93.00 - 97.99

def stable_pop(name, base=50, spread=40):
    h = int(hashlib.md5(name.encode()).hexdigest()[8:16], 16)
    return max(10, min(100, base + (h % spread) - spread // 2))

def make_aliases(name):
    """Generate Brazilian-style aliases from game name."""
    words = name.lower().split()
    aliases = [name.lower()]
    if len(words) >= 2:
        aliases.append(words[0])
        aliases.append(''.join(w[0] for w in words))  # initials
    return ' '.join(aliases[:5])

def make_game(id, nome, cat, provider, desc, pop, tags):
    s = slug(nome)
    return {
        "id_jogo": str(id), "nome": nome, "provider": provider, "categoria": cat,
        "aliases": make_aliases(nome), "description": desc,
        "popularity": pop, "tags": tags, "slug": s,
        "rtp": stable_rtp(nome) if cat != "esporte" else None,
        "image": f"https://picsum.photos/seed/{s}/400/300",
    }

def main():
    random.seed(42)
    with open(GAMES_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Keep original 154 games only (IDs 1-154)
    original = [g for g in data["games"] if int(g["id_jogo"]) <= 154]
    # Keep football games (generated by add_football_games.py)
    football = [g for g in data["games"] if g.get("categoria") == "esporte" and int(g["id_jogo"]) > 154]

    existing_names = {g["nome"] for g in original + football}
    next_id = max(int(g["id_jogo"]) for g in original + football) + 1
    new_games = []

    def add(nome, cat, provider, desc, pop, tags):
        nonlocal next_id
        if nome in existing_names:
            return
        existing_names.add(nome)
        new_games.append(make_game(next_id, nome, cat, provider, desc, pop, tags))
        next_id += 1

    # ─── GENERATE SLOTS ───────────────────────────────────
    # Template 1: Animal + Power (40×30 = 1200)
    for a, p in product(ANIMALS, POWER):
        add(f"{a} {p}", "slot", random.choice(PROVIDERS_SLOT),
            random.choice(DESC_ANIMAL).format(a=a), stable_pop(f"{a} {p}", 55, 50),
            "SLOT WILD" + (" MEGAWAYS" if "Megaways" in p else ""))

    # Template 2: Myth Figure + Power (30×20 = 600)
    for f, p in product(MYTH_FIGURES, MYTH_POWER):
        add(f"{f} {p}", "slot", random.choice(PROVIDERS_SLOT),
            random.choice(DESC_MYTH).format(f=f), stable_pop(f"{f} {p}", 55, 50), "SLOT MYTH")

    # Template 3: Theme + Feature (30×20 = 600)
    for t, fe in product(THEMES, FEATURES):
        add(f"{t} {fe}", "slot", random.choice(PROVIDERS_SLOT),
            random.choice(DESC_THEME).format(t=t, fe=fe), stable_pop(f"{t} {fe}", 45, 40), "SLOT")

    # Template 4: Book of X (20)
    for b in BOOK_OF:
        add(f"Book of {b}", "slot", random.choice(PROVIDERS_SLOT),
            random.choice(DESC_BOOK).format(b=b), stable_pop(f"Book of {b}", 65, 30), "SLOT BOOK")

    # Template 5: Sweet/Candy (10×20 = 200)
    for sp, ss in product(SWEET_PREFIX, SWEET):
        add(f"{sp} {ss}", "slot", random.choice(PROVIDERS_SLOT),
            random.choice(DESC_SWEET).format(s=f"{sp} {ss}"), stable_pop(f"{sp} {ss}", 50, 40), "SLOT SWEET")

    # Template 6: Mega/Super prefix (10×10 = 100)
    for mp, mg in product(MEGA_PREFIX, MEGA):
        add(f"{mp} {mg}", "slot", random.choice(PROVIDERS_SLOT),
            random.choice(DESC_MEGA).format(m=f"{mp} {mg}"), stable_pop(f"{mp} {mg}", 50, 40), "SLOT MEGA")

    # Template 7: Gates/Rise/Age of X (90)
    for prefix in ["Gates of","Rise of","Age of"]:
        for f in MYTH_FIGURES:
            add(f"{prefix} {f}", "slot", random.choice(PROVIDERS_SLOT),
                random.choice(DESC_MYTH).format(f=f), stable_pop(f"{prefix} {f}", 60, 40), "SLOT MYTH")

    # Template 8: Theme + Animal (30×40 partial = ~400)
    for t in THEMES:
        for a in random.sample(ANIMALS, 14):
            add(f"{t} {a}", "slot", random.choice(PROVIDERS_SLOT),
                random.choice(DESC_ANIMAL).format(a=f"{t} {a}"), stable_pop(f"{t} {a}", 40, 35), "SLOT")

    # Template 9: Wild/Lucky/Magic + Noun (extra ~600)
    EXTRA_PREFIX = ["Wild","Lucky","Magic","Flaming","Blazing","Mighty","Dark","Raging","Frozen","Eternal"]
    EXTRA_NOUN = ["Fortune","Sevens","Fruits","Joker","Bells","Reels","Wilds","Jackpot","Riches","Treasure",
                  "Phoenix","Flames","Nights","Stars","Wheel","Spin","Mystery","Vault","Heist","Arena",
                  "Legends","Quest","Empire","Kingdom","Realm","Throne","Dynasty","Temple","Scroll","Totem",
                  "Scarab","Sphinx","Scepter","Amulet","Chalice","Crown","Shield","Sword","Hammer","Axe",
                  "Orb","Crystal","Rune","Elixir","Potion","Grimoire","Artifact","Relic","Idol","Mask"]
    for ep, en in product(EXTRA_PREFIX, EXTRA_NOUN):
        add(f"{ep} {en}", "slot", random.choice(PROVIDERS_SLOT),
            f"Slot emocionante com tema de {en.lower()}. Recursos especiais, multiplicadores e grandes prêmios.",
            stable_pop(f"{ep} {en}", 45, 40), "SLOT")

    # Template 10: Number-based (777, 888, etc)
    for num in ["777","888","999","365","100","50","40","20","10","5"]:
        for suffix in ["Gold","Platinum","Fire","Stars","Diamonds","Wilds","Fortune","Deluxe","Classic","Mega"]:
            add(f"{num} {suffix}", "slot", random.choice(PROVIDERS_SLOT),
                f"Slot clássico {num} com tema {suffix.lower()}. Nostalgia com recursos modernos e grandes prêmios.",
                stable_pop(f"{num} {suffix}", 40, 30), "SLOT CLASSIC")

    # Template 11: Stacked names (Wolf of Gold, Eye of Ra, etc)
    STACKED_PREFIX = ["Wolf of","Eye of","Heart of","Jewel of","Sword of","Shield of","Hand of","Breath of",
                      "Wings of","Wrath of","Spirit of","Soul of","Claw of","Fang of","Horn of"]
    STACKED_SUFFIX = ["Gold","Fire","Ice","Thunder","Storm","Fortune","Power","Glory","Darkness","Light",
                      "the Nile","the Gods","the Dragon","the Phoenix","the Wild"]
    for sp, ss in product(STACKED_PREFIX, STACKED_SUFFIX):
        add(f"{sp} {ss}", "slot", random.choice(PROVIDERS_SLOT),
            f"Slot épico com tema de {ss.lower()}. Free spins, wilds e multiplicadores impressionantes.",
            stable_pop(f"{sp} {ss}", 50, 40), "SLOT")

    # Template 12: Fruit machines (classic style)
    FRUITS = ["Cherry","Lemon","Orange","Plum","Grape","Melon","Banana","Strawberry","Pear","Apple"]
    FRUIT_SUFFIX = ["7s","Jackpot","Bars","Bells","Stars","Hot","Burst","Spin","Fire","Deluxe",
                    "Classic","Retro","Gold","Diamond","Platinum","Ultra","Mega","Wild","Bonus","Fortune"]
    for fr, fs in product(FRUITS, FRUIT_SUFFIX):
        add(f"{fr} {fs}", "slot", random.choice(PROVIDERS_SLOT),
            f"Slot clássico de frutas com {fr.lower()}. Visual retrô, mecânica simples e prêmios generosos.",
            stable_pop(f"{fr} {fs}", 40, 30), "SLOT CLASSIC FRUIT")

    # Template 13: Cash/Money themed
    CASH_PREFIX = ["Cash","Money","Gold","Coin","Dollar","Bank","Vault","Piggy","Treasure","Jackpot"]
    CASH_SUFFIX = ["Collect","Machine","Train","Tower","Vault","Express","Blitz","Grab","Splash","Burst",
                   "Boom","Rain","Shower","Tornado","Storm","Wave","Flood","Rush","Drop","Spin"]
    for cp2, cs2 in product(CASH_PREFIX, CASH_SUFFIX):
        add(f"{cp2} {cs2}", "slot", random.choice(PROVIDERS_SLOT),
            f"Slot de alta voltagem com tema de dinheiro. {cp2} e {cs2.lower()} com multiplicadores e bônus buy.",
            stable_pop(f"{cp2} {cs2}", 50, 40), "SLOT CASH")

    # Template 14: Adventure/Explorer
    ADV_PREFIX = ["Tomb","Temple","Jungle","Desert","Ocean","Mountain","Cave","Forest","Island","Volcano"]
    ADV_SUFFIX = ["Explorer","Raider","Hunter","Seeker","Adventurer","Runner","Survivor","Diver","Climber","Quest"]
    for ap, as_ in product(ADV_PREFIX, ADV_SUFFIX):
        add(f"{ap} {as_}", "slot", random.choice(PROVIDERS_SLOT),
            f"Aventura emocionante com tema de {ap.lower()}. Explore, descubra tesouros e ganhe multiplicadores enormes.",
            stable_pop(f"{ap} {as_}", 45, 35), "SLOT ADVENTURE")

    # Template 15: Night/Fire/Ice themed
    ELEM_PREFIX = ["Fire","Ice","Night","Dawn","Dusk","Shadow","Light","Thunder","Wind","Earth"]
    ELEM_SUFFIX = ["Queen","Prince","Lord","Warrior","Guardian","Wizard","Shaman","Empress","Titan","Knight",
                   "Blade","Forge","Spell","Charm","Strike","Bolt","Pulse","Wave","Beam","Ray"]
    for ep2, es2 in product(ELEM_PREFIX, ELEM_SUFFIX):
        add(f"{ep2} {es2}", "slot", random.choice(PROVIDERS_SLOT),
            f"Slot místico com o poder de {ep2.lower()}. Wilds, free spins e multiplicadores colossais.",
            stable_pop(f"{ep2} {es2}", 45, 40), "SLOT ELEMENT")

    # Template 16: Country/City themed
    PLACES = ["Rio","Vegas","Monaco","Macau","Tokyo","Cairo","Athens","Rome","London","Dublin",
              "Bangkok","Mumbai","Sydney","Havana","Shanghai","Istanbul","Barcelona","Paris","Berlin","Lima"]
    PLACE_SUFFIX = ["Nights","Dreams","Gold","Fortune","Riches","Heat","Fever","Glow","Royale","Express"]
    for pl, ps in product(PLACES, PLACE_SUFFIX):
        add(f"{pl} {ps}", "slot", random.choice(PROVIDERS_SLOT),
            f"Slot vibrante inspirado em {pl}. Atmosfera única, bônus temáticos e grandes jackpots.",
            stable_pop(f"{pl} {ps}", 50, 40), "SLOT CITY")

    # Template 17: Action verbs (Spin, Win, etc.)
    ACTION = ["Spin","Win","Hit","Pop","Drop","Stack","Roll","Flip","Grab","Snap"]
    ACTION_NOUN = ["Madness","Mania","Fever","Frenzy","Party","Festival","Fiesta","Gala","Carnival","Parade"]
    for ac, an in product(ACTION, ACTION_NOUN):
        add(f"{ac} {an}", "slot", random.choice(PROVIDERS_SLOT),
            f"Slot frenético com mecânica de {ac.lower()}. Ação non-stop, combos e prêmios explosivos.",
            stable_pop(f"{ac} {an}", 45, 35), "SLOT ACTION")

    # Template 18: Myth creature combos
    CREATURES = ["Dragon","Griffin","Hydra","Cerberus","Minotaur","Kraken","Cyclops","Chimera","Pegasus","Werewolf",
                 "Vampire","Demon","Angel","Goblin","Troll","Golem","Djinn","Wraith","Banshee","Leviathan"]
    CREATURE_ACT = ["Fury","Strike","Hunt","Reign","Slayer","Tamer","Keeper","Master","Lord","Rider",
                    "Fire","Gold","Treasure","Quest","Legend","Saga","Rising","Awakening","Revenge","Curse"]
    for cr, ca in product(CREATURES, CREATURE_ACT):
        add(f"{cr} {ca}", "slot", random.choice(PROVIDERS_SLOT),
            f"Slot épico com o {cr.lower()}. Batalhas, multiplicadores e rodadas bônus lendárias.",
            stable_pop(f"{cr} {ca}", 50, 40), "SLOT CREATURE")

    # Template 19: Power + Number
    POWER_N = ["Super","Mega","Ultra","Hyper","Max","Turbo","Giga","Nitro"]
    for pn in POWER_N:
        for num in ["5","10","15","20","25","40","50","100","200","500","1000"]:
            add(f"{pn} {num}", "slot", random.choice(PROVIDERS_SLOT),
                f"Slot {pn.lower()} com {num} linhas de pagamento. Múltiplas formas de ganhar e bônus especiais.",
                stable_pop(f"{pn} {num}", 40, 30), "SLOT CLASSIC")

    # Template 20: Treasure/Lost + Location
    LOST = ["Treasure of","Lost City of","Secrets of","Legends of","Ruins of","Wonders of"]
    LOC = ["Atlantis","Eldorado","Babylon","Troy","Pompeii","Machu Picchu","Angkor","Petra","Olympus",
           "Avalon","Camelot","Asgard","Valhalla","Shangri-La","Alexandria","Carthage","Memphis","Thebes"]
    for lo, lc in product(LOST, LOC):
        add(f"{lo} {lc}", "slot", random.choice(PROVIDERS_SLOT),
            f"Explore os mistérios de {lc} neste slot aventureiro. Tesouros escondidos e grandes prêmios.",
            stable_pop(f"{lo} {lc}", 55, 40), "SLOT ADVENTURE MYTH")

    # Template 21: Multiway combos Animal+Myth
    for a in ANIMALS[:20]:
        for mf in MYTH_FIGURES[:15]:
            add(f"{a} of {mf}", "slot", random.choice(PROVIDERS_SLOT),
                f"Slot temático com {a.lower()} e {mf}. Wilds, scatters e free spins com multiplicadores.",
                stable_pop(f"{a} of {mf}", 45, 35), "SLOT")

    # Template 22: Royal themed
    ROYALS = ["King","Queen","Prince","Princess","Duke","Baron","Count","Knight","Emperor","Empress"]
    ROYAL_OF = ["Gems","Gold","Cards","Spades","Hearts","Diamonds","Clubs","Fortune","Riches","Glory",
                "Fire","Ice","Thunder","Shadows","Light","Stars","Coins","Crowns","Thrones","Swords"]
    for ro, rof in product(ROYALS, ROYAL_OF):
        add(f"{ro} of {rof}", "slot", random.choice(PROVIDERS_SLOT),
            f"Slot real com tema de {rof.lower()}. Símbolos premium, wilds e grande potencial de ganho.",
            stable_pop(f"{ro} of {rof}", 50, 40), "SLOT ROYAL")

    # Template 23: Star/Cosmic themed
    COSMIC = ["Star","Cosmic","Astral","Nova","Nebula","Galaxy","Orbit","Pulsar","Quasar","Comet"]
    COSMIC_SUFFIX = ["Burst","Cluster","Fortune","Gems","Gold","Rush","Spin","Ways","Wilds","X",
                     "Strike","Blaze","Flash","Glow","Shine","Beam","Light","Dust","Trail","Force"]
    for co, cs3 in product(COSMIC, COSMIC_SUFFIX):
        add(f"{co} {cs3}", "slot", random.choice(PROVIDERS_SLOT),
            f"Slot cósmico com tema de {co.lower()}. Efeitos estelares, multiplicadores e bônus galácticos.",
            stable_pop(f"{co} {cs3}", 45, 35), "SLOT SPACE")

    # Template 24: Festive/Party slots
    PARTY = ["Samba","Fiesta","Carnival","Festival","Celebration","Jubilee","Gala","Rave","Disco","Luau"]
    PARTY_SUFFIX = ["Nights","Gold","Fortune","Riches","Spin","Wild","Hot","Fire","Fever","Deluxe",
                    "Party","Spins","Cash","Bonus","Free","Stars","Beats","Rhythm","Groove","Dance"]
    for pa, ps2 in product(PARTY, PARTY_SUFFIX):
        add(f"{pa} {ps2}", "slot", random.choice(PROVIDERS_SLOT),
            f"Slot festivo com tema de {pa.lower()}. Música, cores vibrantes e prêmios que fazem a festa.",
            stable_pop(f"{pa} {ps2}", 50, 40), "SLOT PARTY")

    print(f"  📊 Slots generated: {sum(1 for g in new_games if g['categoria']=='slot')}")

    # ─── GENERATE CRASH ───────────────────────────────────
    for cp, cs in product(CRASH_PREFIX, CRASH_SUFFIX):
        if cp == cs:
            continue
        add(f"{cp} {cs}", "crash", random.choice(PROVIDERS_CRASH),
            random.choice(DESC_CRASH), stable_pop(f"{cp} {cs}", 50, 40), "CRASH INSTANT")

    # More crash with themed names
    CRASH_THEMED = ["Space","Galaxy","Moon","Mars","Neptune","Asteroid","Meteor","Solar","Lunar","Stellar",
                    "Quantum","Neon","Cyber","Pixel","Retro","Hyper","Nitro","Sonic","Flash","Rapid"]
    for ct in CRASH_THEMED:
        for cs2 in ["Crash","X","Launch","Boost","Bet"]:
            add(f"{ct} {cs2}", "crash", random.choice(PROVIDERS_CRASH),
                random.choice(DESC_CRASH), stable_pop(f"{ct} {cs2}", 50, 40), "CRASH INSTANT")

    print(f"  📊 Crash generated: {sum(1 for g in new_games if g['categoria']=='crash')}")

    # ─── GENERATE LIVE ────────────────────────────────────
    for game_type, (variants, descs) in LIVE_TYPES.items():
        for variant in variants:
            if game_type == "Game Show":
                nome = variant
            else:
                nome = f"{variant} {game_type}"
            add(nome, "live", random.choice(PROVIDERS_LIVE),
                random.choice(descs), stable_pop(nome, 60, 35), f"LIVE {game_type.upper()}")

    # More live: provider-specific tables
    LIVE_EXTRAS = ["Table 1","Table 2","Table 3","Table 4","Table 5",
                   "Sala 1","Sala 2","Sala 3","Sala VIP","Sala Platinum",
                   "Brasil","São Paulo","Rio","Brasília","Curitiba","Salvador",
                   "Gold","Silver","Bronze","Diamond","Ruby","Emerald"]
    for mesa in LIVE_EXTRAS:
        for tipo in ["Blackjack","Roulette","Baccarat"]:
            add(f"{mesa} {tipo}", "live", random.choice(PROVIDERS_LIVE),
                f"Mesa de {tipo.lower()} {mesa}. Dealer ao vivo, apostas em tempo real e experiência premium.",
                stable_pop(f"{mesa} {tipo}", 55, 35), f"LIVE {tipo.upper()}")

    print(f"  📊 Live generated: {sum(1 for g in new_games if g['categoria']=='live')}")

    # ─── COMBINE AND SAVE ─────────────────────────────────
    final = original + football + new_games
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump({"games": final}, f, ensure_ascii=False, indent=2)

    cats = {}
    for g in final:
        cats[g.get("categoria", "?")] = cats.get(g.get("categoria", "?"), 0) + 1

    print(f"\n{'='*60}")
    print(f"✅ GERAÇÃO COMPLETA")
    print(f"{'='*60}")
    print(f"📊 Total: {len(final)} games")
    print(f"   Originais: {len(original)}")
    print(f"   Futebol: {len(football)}")
    print(f"   Gerados: {len(new_games)}")
    print(f"📊 Categorias: {cats}")
    print(f"💾 Salvo em: {OUTPUT_FILE}")
    print(f"\n⚡ Próximos passos:")
    print(f"   cp games_data_10k.json games_data.json")
    print(f"   python3 scripts/enrich_games.py")
    print(f"   ./scripts/deploy_full_reset.sh")

if __name__ == "__main__":
    main()

