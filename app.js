document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURAÇÕES E DADOS ---
    let ULTIMA_RODADA = 0; // Será atualizado automaticamente pela API
    const proxyUrl = 'https://corsproxy.io/?'; // Proxy para resolver o problema de CORS
    const API_URLS = {
        STATUS: 'https://api.cartola.globo.com/mercado/status',
        PONTUADOS: 'https://api.cartola.globo.com/atletas/pontuados/',
        PARTIDAS: 'https://api.cartola.globo.com/partidas/',
        CLUBES: 'https://api.cartola.globo.com/clubes'
    };

    const SCOUTS_DESCRICOES = { 'A': 'Assistência', 'CA': 'Cartão Amarelo', 'CV': 'Cartão Vermelho', 'DE': 'Defesa', 'DP': 'Defesa de Pênalti', 'DS': 'Desarme', 'FC': 'Falta Cometida', 'FD': 'Finalização Defendida', 'FF': 'Finalização pra Fora', 'FS': 'Falta Sofrida', 'FT': 'Finalização na Trave', 'G': 'Gol', 'GC': 'Gol Contra', 'GS': 'Gol Sofrido', 'I': 'Impedimento', 'PC': 'Pênalti Cometido', 'PP': 'Pênalti Perdido', 'PS': 'Pênalti Sofrido', 'SG': 'Jogo sem Sofrer Gol', 'V': 'Vitórias' };

    // Array de meses para formatação
    const MESES_ABREV = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

    // --- ELEMENTOS DO DOM E DADOS ---
    const loadingStatus = document.getElementById('loading-status'), tabJogadores = document.getElementById('tab-jogadores'), tabClubes = document.getElementById('tab-clubes'), contentJogadores = document.getElementById('content-jogadores'), contentClubes = document.getElementById('content-clubes'), atletasContainer = document.getElementById('atletas-container'), clubesContainer = document.getElementById('clubes-container');
    let dadosAgregados = {}, dadosClubesAgregados = {}, todosClubes = {}, todasPosicoes = {}, clubesParticipantes = new Set();
    const createNewAthleteEntry = (info) => ({ ...info, pontuacao: { total: 0, mandante: 0, visitante: 0 }, jogos: { total: 0, mandante: 0, visitante: 0 }, scouts: { total: {}, mandante: {}, visitante: {} } });
    const createNewClubEntry = (info) => ({ ...info, pontuacao: { total: 0, mandante: 0, visitante: 0 }, jogos: { total: 0, mandante: 0, visitante: 0 }, scouts: { total: {}, mandante: {}, visitante: {} } });

    // --- LÓGICA DE INTERFACE E BUSCA DE DADOS ---
    function setupTabs() {
        tabJogadores.addEventListener('click', () => switchTab('jogadores'));
        tabClubes.addEventListener('click', () => switchTab('clubes'));
    }
    function switchTab(activeTab) {
        const isJogadores = activeTab === 'jogadores';
        tabJogadores.classList.toggle('active', isJogadores);
        contentJogadores.classList.toggle('active', isJogadores);
        tabClubes.classList.toggle('active', !isJogadores);
        contentClubes.classList.toggle('active', !isJogadores);
        applyFilters();
    }

    // --- NOVA FUNÇÃO: LÊ O STATUS DO MERCADO E RODADA ---
    async function carregarStatusMercado() {
        try {
            const res = await fetch(`${proxyUrl}${API_URLS.STATUS}`);
            if (!res.ok) throw new Error('Falha ao obter status');
            const data = await res.json();

            // 1. Definir Rodada
            // Se mercado aberto (status 1), a rodada_atual na API é a próxima. Pegamos dados até a anterior.
            // Se mercado fechado (status 2), a rodada está acontecendo, tentamos pegar dados dela.
            if (data.status_mercado === 1) {
                ULTIMA_RODADA = data.rodada_atual - 1;
            } else {
                ULTIMA_RODADA = data.rodada_atual;
            }
            
            // Atualiza rodada no Header
            document.getElementById('rodada-atual').textContent = ULTIMA_RODADA > 0 ? ULTIMA_RODADA : '-';

            // 2. Definir Status Visual
            const elStatus = document.getElementById('status-texto');
            const elContainerFecha = document.getElementById('fechamento-container');
            const elDataFecha = document.getElementById('data-fechamento');

            if (data.status_mercado === 1) {
                // Aberto
                elStatus.textContent = 'Aberto';
                elStatus.style.color = '#22c55e'; // Verde
                elStatus.style.fontWeight = 'bold';
                
                if (data.fechamento) {
                    const f = data.fechamento;
                    // Formata minuto para ter dois dígitos (ex: 05)
                    const min = f.minuto < 10 ? `0${f.minuto}` : f.minuto;
                    // Busca a abreviação do mês (mes - 1 pois o array começa em 0)
                    const mesAbrev = MESES_ABREV[f.mes - 1] || f.mes;
                    
                    elDataFecha.textContent = `${f.dia}/${mesAbrev} às ${f.hora}:${min}`;
                    elContainerFecha.style.display = 'block';
                }
            } else {
                // Fechado
                elStatus.textContent = 'Fechado';
                elStatus.style.color = '#ef4444'; // Vermelho
                elStatus.style.fontWeight = 'bold';
                elContainerFecha.style.display = 'none';
            }

        } catch (error) {
            console.error('Erro ao verificar status:', error);
            loadingStatus.textContent = 'Erro ao conectar com API do Cartola.';
            // Fallback: define uma rodada padrão segura caso falhe
            ULTIMA_RODADA = 1; 
        }
    }

    async function fetchAndAggregateData() {
        loadingStatus.textContent = 'Verificando status do mercado...';
        
        // Espera a verificação do mercado para saber qual é a ULTIMA_RODADA
        await carregarStatusMercado();

        if (ULTIMA_RODADA < 1) {
            loadingStatus.textContent = 'O campeonato ainda não começou ou não há dados de rodadas anteriores.';
            return;
        }

        loadingStatus.textContent = 'Carregando lista de clubes...';
        await fetch(`${proxyUrl}${API_URLS.CLUBES}`).then(res => res.json()).then(data => todosClubes = data);
        
        for (let r = 1; r <= ULTIMA_RODADA; r++) {
            loadingStatus.textContent = `Rodada ${r}/${ULTIMA_RODADA}: Processando...`;
            try {
                const [p, s] = await Promise.all([
                    fetch(`${proxyUrl}${API_URLS.PARTIDAS}${r}`), 
                    fetch(`${proxyUrl}${API_URLS.PONTUADOS}${r}`)
                ]);
                if (!p.ok || !s.ok) continue;
                const [partidasData, scoutData] = await Promise.all([p.json(), s.json()]);
                processaDadosDaRodada(scoutData, partidasData.partidas);
            } catch (error) { console.error(`Erro na rodada ${r}:`, error); }
        }
        loadingStatus.style.display = 'none';
        populateFilters();
        switchTab('jogadores');
    }

    function processaDadosDaRodada(scoutData, partidas) {
        if (!scoutData.atletas || Object.keys(scoutData.atletas).length === 0) { return; }
        if (scoutData.posicoes) todasPosicoes = scoutData.posicoes;

        const localMapa = {};
        partidas.forEach(partida => {
            localMapa[partida.clube_casa_id] = 'mandante';
            localMapa[partida.clube_visitante_id] = 'visitante';
        });

        const clubesQueJogaramNaRodada = new Set(Object.values(scoutData.atletas).map(a => a.clube_id));

        clubesQueJogaramNaRodada.forEach(clubeId => {
            if (!todosClubes[clubeId] || !localMapa[clubeId]) return;
            const local = localMapa[clubeId];
            if (!dadosClubesAgregados[clubeId]) dadosClubesAgregados[clubeId] = createNewClubEntry(todosClubes[clubeId]);
            dadosClubesAgregados[clubeId].jogos.total += 1;
            dadosClubesAgregados[clubeId].jogos[local] += 1;
        });

        for (const atletaId in scoutData.atletas) {
            const atleta = scoutData.atletas[atletaId];
            const clubeId = atleta.clube_id;
            const local = localMapa[clubeId];
            if (!local) continue;
            clubesParticipantes.add(clubeId);

            if (!dadosAgregados[atletaId]) dadosAgregados[atletaId] = createNewAthleteEntry(atleta);
            const agregado = dadosAgregados[atletaId];
            agregado.pontuacao.total += atleta.pontuacao;
            agregado.pontuacao[local] += atleta.pontuacao;
            agregado.jogos.total += 1;
            agregado.jogos[local] += 1;
            if (atleta.scout) for (const sigla in atleta.scout) {
                const v = atleta.scout[sigla];
                agregado.scouts.total[sigla] = (agregado.scouts.total[sigla] || 0) + v;
                agregado.scouts[local][sigla] = (agregado.scouts[local][sigla] || 0) + v;
            }

            const clubeAgregado = dadosClubesAgregados[clubeId];
            if (clubeAgregado) {
                clubeAgregado.pontuacao.total += atleta.pontuacao;
                clubeAgregado.pontuacao[local] += atleta.pontuacao;
                if (atleta.scout) for (const sigla in atleta.scout) {
                    const v = atleta.scout[sigla];
                    clubeAgregado.scouts.total[sigla] = (clubeAgregado.scouts.total[sigla] || 0) + v;
                    clubeAgregado.scouts[local][sigla] = (clubeAgregado.scouts[local][sigla] || 0) + v;
                }
            }
        }
    }

    function populateFilters() {
        const fClubeJogadores = document.getElementById('filtro-clube-jogadores'), fPosJogadores = document.getElementById('filtro-posicao-jogadores'), fScoutJogadores = document.getElementById('filtro-scout-jogadores'), fScoutClubes = document.getElementById('filtro-scout-clubes');
        Array.from(clubesParticipantes).map(id => todosClubes[id]).filter(Boolean).sort((a, b) => a.nome_fantasia.localeCompare(b.nome_fantasia)).forEach(c => fClubeJogadores.innerHTML += `<option value="${c.id}">${c.nome_fantasia}</option>`);
        Object.values(todasPosicoes).forEach(p => fPosJogadores.innerHTML += `<option value="${p.id}">${p.nome}</option>`);
        const scoutOptions = Object.entries(SCOUTS_DESCRICOES).sort((a, b) => a[1].localeCompare(b[1])).map(([sigla, desc]) => `<option value="${sigla}">${desc}</option>`).join('');
        fScoutJogadores.innerHTML += scoutOptions; fScoutClubes.innerHTML += scoutOptions;
    }

    function applyFilters() {
        if (tabJogadores.classList.contains('active')) { applyFiltersJogadores(); } 
        else { applyFiltersClubes(); }
    }

    function applyFiltersJogadores() {
        const clubeId = document.getElementById('filtro-clube-jogadores').value, posId = document.getElementById('filtro-posicao-jogadores').value, local = document.getElementById('filtro-local-jogadores').value, viewMode = document.querySelector('input[name="view-mode-jogadores"]:checked').value, metricaSelecionada = document.getElementById('filtro-scout-jogadores').value;
        let atletasFiltrados = Object.values(dadosAgregados);
        if (clubeId !== 'todos') atletasFiltrados = atletasFiltrados.filter(a => a.clube_id == clubeId);
        if (posId !== 'todos') atletasFiltrados = atletasFiltrados.filter(a => a.posicao_id == posId);
        if (local !== 'todos') atletasFiltrados = atletasFiltrados.filter(a => a.jogos[local] > 0);
        if (viewMode === 'soma' && metricaSelecionada !== 'pontuacao') { atletasFiltrados = atletasFiltrados.filter(atleta => (atleta.scouts.total[metricaSelecionada] || 0) > 0); }
        atletasFiltrados.sort((a, b) => {
            const key = (local === 'todos') ? 'total' : local;
            const jogosA = a.jogos[key] || 0, jogosB = b.jogos[key] || 0;
            let valA = (metricaSelecionada === 'pontuacao') ? a.pontuacao[key] : (a.scouts[key][metricaSelecionada] || 0);
            let valB = (metricaSelecionada === 'pontuacao') ? b.pontuacao[key] : (b.scouts[key][metricaSelecionada] || 0);
            if (viewMode === 'media') { valA = jogosA > 0 ? valA / jogosA : 0; valB = jogosB > 0 ? valB / jogosB : 0; }
            return valB - valA;
        });
        renderAtletas(atletasFiltrados);
    }
    
    function applyFiltersClubes() {
        const local = document.getElementById('filtro-local-clubes').value, viewMode = document.querySelector('input[name="view-mode-clubes"]:checked').value, metricaSelecionada = document.getElementById('filtro-scout-clubes').value;
        let clubesFiltrados = Object.values(dadosClubesAgregados);
        if (local !== 'todos') clubesFiltrados = clubesFiltrados.filter(c => c.jogos[local] > 0);
        if (viewMode === 'soma' && metricaSelecionada !== 'pontuacao') { clubesFiltrados = clubesFiltrados.filter(clube => (clube.scouts.total[metricaSelecionada] || 0) > 0); }
        clubesFiltrados.sort((a, b) => {
            const key = (local === 'todos') ? 'total' : local;
            const jogosA = a.jogos[key] || 0, jogosB = b.jogos[key] || 0;
            let valA = (metricaSelecionada === 'pontuacao') ? a.pontuacao[key] : (a.scouts[key][metricaSelecionada] || 0);
            let valB = (metricaSelecionada === 'pontuacao') ? b.pontuacao[key] : (b.scouts[key][metricaSelecionada] || 0);
            if (viewMode === 'media') { valA = jogosA > 0 ? valA / jogosA : 0; valB = jogosB > 0 ? valB / jogosB : 0; }
            return valB - valA;
        });
        renderClubes(clubesFiltrados);
    }

    function renderAtletas(atletas) { 
        atletasContainer.innerHTML = '';
        const local = document.getElementById('filtro-local-jogadores').value, viewMode = document.querySelector('input[name="view-mode-jogadores"]:checked').value, metricaScout = document.getElementById('filtro-scout-jogadores').value;
        if (atletas.length === 0) { atletasContainer.innerHTML = '<p>Nenhum atleta encontrado.</p>'; return; }
        for (const atleta of atletas) {
            const key = (local === 'todos') ? 'total' : local; const jogos = atleta.jogos[key]; if (!jogos && local !== 'todos') continue;
            let valor, rotulo;
            if (metricaScout === 'pontuacao') { rotulo = 'Pontuação'; valor = atleta.pontuacao[key]; } else { rotulo = SCOUTS_DESCRICOES[metricaScout] || metricaScout; valor = atleta.scouts[key][metricaScout] || 0; }
            const valorCalculado = (viewMode === 'media' && jogos > 0) ? (valor / jogos) : valor;
            let valorDisplay;
            if (viewMode === 'media' || metricaScout === 'pontuacao') { valorDisplay = valorCalculado.toFixed(2); } else { valorDisplay = valorCalculado.toFixed(0); }
            let subtexto = viewMode === 'media' ? `Média em ${jogos} jogos` : `Total em ${jogos} jogos`;
            if (local !== 'todos') subtexto += ` (${local})`;
            const itemDiv = document.createElement('div'); itemDiv.className = 'item-lista';
            itemDiv.innerHTML = `<img src="${atleta.foto ? atleta.foto.replace('FORMATO', '140x140') : ''}" alt="Foto de ${atleta.apelido}" style="border-radius:50%"><div class="info"><h3>${atleta.apelido}</h3><p>${todosClubes[atleta.clube_id]?.nome_fantasia || ''} • ${todasPosicoes[atleta.posicao_id]?.nome || ''}</p></div><div class="metrica"><span class="metrica-label">${rotulo}</span><span class="metrica-valor">${valorDisplay}</span><span class="metrica-subtext">${subtexto}</span></div>`;
            atletasContainer.appendChild(itemDiv);
        }
    }
    
    function renderClubes(clubes) {
        clubesContainer.innerHTML = '';
        const local = document.getElementById('filtro-local-clubes').value, viewMode = document.querySelector('input[name="view-mode-clubes"]:checked').value, metricaScout = document.getElementById('filtro-scout-clubes').value;
        if (clubes.length === 0) { clubesContainer.innerHTML = '<p>Nenhum clube encontrado.</p>'; return; }
        for (const clube of clubes) {
            const key = (local === 'todos') ? 'total' : local;
            const jogos = clube.jogos[key];
            let valor, rotulo;
            if (metricaScout === 'pontuacao') { rotulo = 'Pontuação'; valor = clube.pontuacao[key]; } else { rotulo = SCOUTS_DESCRICOES[metricaScout] || metricaScout; valor = clube.scouts[key][metricaScout] || 0; }
            
            const valorCalculado = (viewMode === 'media' && jogos > 0) ? (valor / jogos) : valor;
            let valorDisplay;
            if (viewMode === 'media' || metricaScout === 'pontuacao') { valorDisplay = valorCalculado.toFixed(2); } else { valorDisplay = valorCalculado.toFixed(0); }

            const itemDiv = document.createElement('div');
            itemDiv.className = 'item-lista';
            // A anotação de jogos (subtexto) foi removida do HTML gerado
            itemDiv.innerHTML = `<img src="${clube.escudos['60x60']}" alt="Escudo do ${clube.nome_fantasia}"><div class="info"><h3>${clube.nome_fantasia}</h3><p>${clube.abreviacao}</p></div><div class="metrica"><span class="metrica-label">${rotulo}</span><span class="metrica-valor">${valorDisplay}</span></div>`;
            clubesContainer.appendChild(itemDiv);
        }
    }

    // --- INICIALIZAÇÃO ---
    const allFilterElements = document.querySelectorAll('.filtros select, .filtros input');
    allFilterElements.forEach(el => el.addEventListener('change', applyFilters));
    setupTabs();
    fetchAndAggregateData();
});
