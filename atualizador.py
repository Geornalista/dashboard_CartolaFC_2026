import json
import requests
import os
from datetime import datetime

# Cabeçalhos para evitar bloqueio da API
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json'
}

API_URLS = {
    'STATUS': 'https://api.cartola.globo.com/mercado/status',
    'PONTUADOS': 'https://api.cartola.globo.com/atletas/pontuados/',
    'PARTIDAS': 'https://api.cartola.globo.com/partidas/',
    'CLUBES': 'https://api.cartola.globo.com/clubes'
}

def main():
    print(f"[{datetime.now()}] Iniciando atualização dos dados do Cartola...")
    
    banco_de_dados = {
        'atualizado_em': datetime.now().isoformat(),
        'status': {},
        'clubes': {},
        'rodadas': []
    }

    try:
        # 1. Busca o status do mercado
        print("Buscando status...")
        resp_status = requests.get(API_URLS['STATUS'], headers=HEADERS)
        resp_status.raise_for_status()
        status_data = resp_status.json()
        banco_de_dados['status'] = status_data
        
        ultima_rodada = status_data.get('rodada_atual', 0)
        # Se o mercado está aberto, a rodada_atual é a próxima (ainda não aconteceu)
        if status_data.get('status_mercado') == 1:
            ultima_rodada -= 1

        print(f"Última rodada com dados: {ultima_rodada}")

        # 2. Busca os Clubes
        print("Buscando clubes...")
        resp_clubes = requests.get(API_URLS['CLUBES'], headers=HEADERS)
        if resp_clubes.status_code == 200:
            banco_de_dados['clubes'] = resp_clubes.json()

        # 3. Busca Partidas e Pontuações de cada rodada
        if ultima_rodada > 0:
            for r in range(1, ultima_rodada + 1):
                print(f"Buscando dados da rodada {r}...")
                
                # Partidas
                resp_part = requests.get(f"{API_URLS['PARTIDAS']}{r}", headers=HEADERS)
                partidas = resp_part.json() if resp_part.status_code == 200 else {}
                
                # Pontuados
                resp_pont = requests.get(f"{API_URLS['PONTUADOS']}{r}", headers=HEADERS)
                scouts = resp_pont.json() if resp_pont.status_code == 200 else {}
                
                banco_de_dados['rodadas'].append({
                    'rodada': r,
                    'partidas': partidas.get('partidas', []),
                    'scout': scouts
                })

        # 4. Salva tudo num arquivo JSON
        with open('dados_cartola.json', 'w', encoding='utf-8') as f:
            json.dump(banco_de_dados, f, ensure_ascii=False, indent=2)
            
        print("Arquivo 'dados_cartola.json' gerado com sucesso!")

    except Exception as e:
        print(f"Erro ao atualizar dados: {e}")
        exit(1) # Força o erro para o GitHub Actions notar

if __name__ == "__main__":
    main()
