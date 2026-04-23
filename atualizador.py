import json
import requests
import os
from datetime import datetime

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json'
}

API_URLS = {
    'STATUS': 'https://api.cartola.globo.com/mercado/status',
    'MERCADO': 'https://api.cartola.globo.com/atletas/mercado', # <--- NOVIDADE PARA PEGAR PREÇO E STATUS
    'PONTUADOS': 'https://api.cartola.globo.com/atletas/pontuados/',
    'PARTIDAS': 'https://api.cartola.globo.com/partidas/',
    'CLUBES': 'https://api.cartola.globo.com/clubes'
}

def main():
    print(f"[{datetime.now()}] Iniciando atualização dos dados do Cartola...")
    banco_de_dados = {'atualizado_em': datetime.now().isoformat(), 'status': {}, 'clubes': {}, 'rodadas': [], 'proxima_rodada_partidas': [], 'mercado': {}}

    try:
        resp_status = requests.get(API_URLS['STATUS'], headers=HEADERS)
        resp_status.raise_for_status()
        status_data = resp_status.json()
        banco_de_dados['status'] = status_data
        
        ultima_rodada = status_data.get('rodada_atual', 0)
        if status_data.get('status_mercado') == 1:
            ultima_rodada -= 1

        print("A procurar informações do Mercado atual (Preços e Status)...")
        resp_mercado = requests.get(API_URLS['MERCADO'], headers=HEADERS)
        if resp_mercado.status_code == 200:
            banco_de_dados['mercado'] = resp_mercado.json()

        print("A procurar clubes...")
        resp_clubes = requests.get(API_URLS['CLUBES'], headers=HEADERS)
        if resp_clubes.status_code == 200:
            banco_de_dados['clubes'] = resp_clubes.json()

        if ultima_rodada > 0:
            for r in range(1, ultima_rodada + 1):
                resp_part = requests.get(f"{API_URLS['PARTIDAS']}{r}", headers=HEADERS)
                partidas = resp_part.json() if resp_part.status_code == 200 else {}
                resp_pont = requests.get(f"{API_URLS['PONTUADOS']}{r}", headers=HEADERS)
                scouts = resp_pont.json() if resp_pont.status_code == 200 else {}
                banco_de_dados['rodadas'].append({'rodada': r, 'partidas': partidas.get('partidas', []), 'scout': scouts})

        proxima_rodada = ultima_rodada + 1
        print(f"A procurar partidas da próxima rodada ({proxima_rodada})...")
        resp_prox = requests.get(f"{API_URLS['PARTIDAS']}{proxima_rodada}", headers=HEADERS)
        if resp_prox.status_code == 200:
            banco_de_dados['proxima_rodada_partidas'] = resp_prox.json().get('partidas', [])

        with open('dados_cartola.json', 'w', encoding='utf-8') as f:
            json.dump(banco_de_dados, f, ensure_ascii=False, indent=2)
            
        print("Arquivo 'dados_cartola.json' gerado com sucesso!")
    except Exception as e:
        print(f"Erro ao atualizar dados: {e}")
        exit(1)

if __name__ == "__main__":
    main()
