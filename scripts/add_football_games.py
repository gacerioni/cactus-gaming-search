#!/usr/bin/env python3
"""Add realistic Brazilian football matches to games_data.json. No LLM needed."""
import json, random, re
from pathlib import Path
from itertools import combinations

GAMES_FILE = Path(__file__).resolve().parent.parent / "games_data.json"

SERIE_A = [
    ("Flamengo", "mengao rubro-negro fla urubu", "Rio de Janeiro"),
    ("Palmeiras", "verdao porco palestra alviverde", "São Paulo"),
    ("Corinthians", "timao coringao fiel todo poderoso", "São Paulo"),
    ("São Paulo", "tricolor soberano spfc morumbi", "São Paulo"),
    ("Santos", "peixe santastico alvinegro praiano", "Santos"),
    ("Grêmio", "imortal tricolor gaucho gremista", "Porto Alegre"),
    ("Internacional", "colorado inter beirario", "Porto Alegre"),
    ("Atlético MG", "galo atletico mineiro galao da massa", "Belo Horizonte"),
    ("Cruzeiro", "raposa cabuloso celeste mineirao", "Belo Horizonte"),
    ("Botafogo", "fogao glorioso estrela solitaria", "Rio de Janeiro"),
    ("Fluminense", "flu tricolor carioca po de arroz nense", "Rio de Janeiro"),
    ("Vasco", "vascao gigante da colina cruzmaltino", "Rio de Janeiro"),
    ("Bahia", "tricolor de aco bahea esquadrao", "Salvador"),
    ("Fortaleza", "leao do pici tricolor de aco cearense", "Fortaleza"),
    ("Athletico PR", "furacao cap atletiba", "Curitiba"),
    ("Coritiba", "coxa branca coxa alviverde", "Curitiba"),
    ("Sport", "leao da ilha sport club recife rubro-negro pernambucano", "Recife"),
    ("Ceará", "vozao ceara sporting club alvinegro", "Fortaleza"),
    ("Goiás", "esmeraldino verdao goiano alviverde", "Goiânia"),
    ("Juventude", "ju papo verdao da serra", "Caxias do Sul"),
]

SERIE_B = [
    ("Guarani", "bugre campinas"),
    ("Ponte Preta", "macaca campinas"),
    ("Vila Nova", "tigrao vila goiania"),
    ("CRB", "galo de campina alagoas"),
    ("CSA", "azulao alagoas"),
    ("Sampaio Corrêa", "sampaio bolívia querida maranhao"),
    ("Tombense", "tombense gaviao carcara"),
    ("Operário", "fantasma operario ponta grossa"),
    ("Novorizontino", "tigre novorizontino"),
    ("Mirassol", "leao mirassol"),
    ("ABC", "abecedê alvinegro potiguar"),
    ("Ituano", "galo de itu ituano"),
    ("Chapecoense", "chape verdao do oeste"),
    ("Brusque", "bruscão quadricolor"),
    ("Londrina", "tubarão londrina"),
    ("Náutico", "timbu nautico recife"),
]

ESTADUAIS = {
    "Paulistão": [("Palmeiras","São Paulo"),("Corinthians","Santos"),("São Paulo","Corinthians"),
                  ("Palmeiras","Corinthians"),("Santos","São Paulo"),("Palmeiras","Santos"),
                  ("Red Bull Bragantino","Palmeiras"),("Guarani","Ponte Preta"),("Novorizontino","Ituano")],
    "Carioca": [("Flamengo","Fluminense"),("Vasco","Botafogo"),("Flamengo","Vasco"),
                ("Fluminense","Botafogo"),("Flamengo","Botafogo"),("Vasco","Fluminense")],
    "Mineiro": [("Atlético MG","Cruzeiro"),("Cruzeiro","Atlético MG"),("América MG","Atlético MG"),
                ("Cruzeiro","América MG"),("Tombense","Atlético MG")],
    "Gaúcho": [("Grêmio","Internacional"),("Internacional","Grêmio"),("Grêmio","Juventude"),
               ("Internacional","Juventude"),("Caxias","Grêmio")],
}

PROVIDER = "Sportsbet"



def slug(name):
    s = name.lower()
    s = re.sub(r'[àáâãäå]','a',s); s = re.sub(r'[èéêë]','e',s)
    s = re.sub(r'[ìíîï]','i',s); s = re.sub(r'[òóôõö]','o',s)
    s = re.sub(r'[ùúûü]','u',s); s = re.sub(r'[ç]','c',s)
    return re.sub(r'[^a-z0-9]+','-',s).strip('-')

def make_game(id, nome, aliases, desc, pop, tags):
    return {
        "id_jogo": str(id), "nome": nome, "provider": PROVIDER,
        "categoria": "esporte", "aliases": aliases,
        "description": desc, "popularity": pop,
        "tags": tags, "slug": slug(nome), "rtp": None,
        "image": f"https://picsum.photos/seed/{slug(nome)}/400/300"
    }

def main():
    with open(GAMES_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    existing_names = {g["nome"] for g in data["games"]}
    next_id = max(int(g["id_jogo"]) for g in data["games"]) + 1
    new_games = []

    def add(nome, aliases, desc, pop, tags):
        nonlocal next_id
        if nome in existing_names:
            return
        existing_names.add(nome)
        new_games.append(make_game(next_id, nome, aliases, desc, pop, tags))
        next_id += 1

    # 1. Próximo Jogo - Série A
    for team, aliases_str, city in SERIE_A:
        add(f"{team} - Próximo Jogo",
            f"proximo jogo {team.lower()} {aliases_str} agenda {team.lower()}",
            f"Aposte no próximo jogo do {team} pelo Campeonato Brasileiro. Odds ao vivo, handicap, placar exato e mercados especiais para o {aliases_str.split()[0]}.",
            random.randint(60, 95), "BRASILEIRAO SERIE-A PROXIMO-JOGO AO-VIVO")

    # 2. Confrontos Série A - all combinations
    classicos = {("Flamengo","Fluminense"),("Flamengo","Vasco"),("Palmeiras","Corinthians"),
                 ("Palmeiras","São Paulo"),("São Paulo","Corinthians"),("Grêmio","Internacional"),
                 ("Atlético MG","Cruzeiro"),("Botafogo","Fluminense"),("Botafogo","Vasco"),
                 ("Fluminense","Vasco"),("Flamengo","Botafogo"),("Flamengo","Corinthians"),
                 ("Bahia","Vitória"),("Fortaleza","Ceará"),("Coritiba","Athletico PR"),
                 ("Santos","São Paulo"),("Sport","Santa Cruz")}
    for (t1, a1, c1), (t2, a2, c2) in combinations(SERIE_A, 2):
        is_cl = (t1,t2) in classicos or (t2,t1) in classicos
        if is_cl:
            pop = random.randint(80, 98)
            desc = f"Clássico {t1} vs {t2}! Aposte no grande confronto com odds especiais, handicap asiático, total de gols e mercados exclusivos."
            tags = "BRASILEIRAO CLASSICO AO-VIVO POPULAR"
        else:
            pop = random.randint(40, 70)
            desc = f"{t1} enfrenta {t2} pelo Brasileirão. Aposte com odds ao vivo, placar exato, resultado final e mercados de gols."
            tags = "BRASILEIRAO SERIE-A"
        add(f"{t1} vs {t2}", f"{a1.split()[0]} vs {a2.split()[0]} {t1.lower()} {t2.lower()}", desc, pop, tags)

    # 3. Série B
    for t1, a1 in SERIE_B:
        add(f"{t1} - Próximo Jogo", f"proximo jogo {t1.lower()} {a1} serie b",
            f"Aposte no próximo jogo do {t1} pela Série B do Brasileirão. Odds ao vivo e mercados especiais.",
            random.randint(30, 55), "BRASILEIRAO SERIE-B PROXIMO-JOGO")
    for (t1,a1),(t2,a2) in combinations(SERIE_B[:10], 2):
        add(f"{t1} vs {t2}", f"{a1.split()[0]} vs {a2.split()[0]} serie b",
            f"{t1} contra {t2} pela Série B. Aposte no resultado, gols e placar exato.",
            random.randint(25, 45), "BRASILEIRAO SERIE-B")

    # 4. Estaduais
    for camp, jogos in ESTADUAIS.items():
        for t1, t2 in jogos:
            add(f"{t1} vs {t2} - {camp}", f"{t1.lower()} {t2.lower()} {camp.lower()} estadual",
                f"{t1} enfrenta {t2} pelo {camp}. Aposte no clássico estadual com odds especiais.",
                random.randint(55, 85), f"{camp.upper()} ESTADUAL CLASSICO")

    # 5. Copa do Brasil
    for t1, t2 in [("Flamengo","Athletico PR"),("Palmeiras","Grêmio"),("São Paulo","Fortaleza"),
                   ("Corinthians","Fluminense"),("Atlético MG","Santos"),("Cruzeiro","Botafogo"),
                   ("Vasco","Bahia"),("Internacional","Ceará"),("Flamengo","Palmeiras"),
                   ("Corinthians","São Paulo"),("Grêmio","Cruzeiro"),("Botafogo","Fortaleza")]:
        add(f"{t1} vs {t2} - Copa do Brasil", f"{t1.lower()} {t2.lower()} copa do brasil mata-mata",
            f"{t1} contra {t2} pela Copa do Brasil! Jogo eliminatório. Aposte no classificado, placar e gols.",
            random.randint(70, 92), "COPA-DO-BRASIL ELIMINATORIA POPULAR")

    # 6. Libertadores
    for t1, t2 in [("Flamengo","River Plate"),("Palmeiras","Boca Juniors"),("Atlético MG","Peñarol"),
                   ("São Paulo","Nacional URU"),("Grêmio","Estudiantes"),("Fluminense","Olimpia"),
                   ("Corinthians","Racing"),("Santos","Independiente"),("Internacional","Cerro Porteño"),
                   ("Botafogo","LDU Quito"),("Cruzeiro","Colo-Colo"),("Fortaleza","Junior Barranquilla")]:
        add(f"{t1} vs {t2} - Libertadores", f"{t1.lower()} {t2.lower()} libertadores conmebol america",
            f"{t1} enfrenta {t2} pela Libertadores! O maior torneio da América. Aposte no classificado.",
            random.randint(75, 95), "LIBERTADORES CONMEBOL POPULAR")

    data["games"].extend(new_games)
    with open(GAMES_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"✅ Adicionados {len(new_games)} jogos de futebol!")
    print(f"📊 Total agora: {len(data['games'])} games")

if __name__ == "__main__":
    random.seed(42)
    main()