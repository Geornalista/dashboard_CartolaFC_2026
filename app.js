document.addEventListener('DOMContentLoaded', () => {
    // Confirmação para saber se o cache foi limpo com sucesso
    console.log("✅ Novo app.js (com aba Cedidos) carregado com sucesso!");

    // --- CONFIGURAÇÕES E DADOS ---
    let ULTIMA_RODADA = 0; 
    const SCOUTS_DESCRICOES = { 'A': 'Assistência', 'CA': 'Cartão Amarelo', 'CV': 'Cartão Vermelho', 'DE': 'Defesa', 'DP': 'Defesa de Pênalti', 'DS': 'Desarme', 'FC': 'Falta Cometida', 'FD': 'Finalização Defendida', 'FF': 'Finalização pra Fora', 'FS': 'Falta Sofrida', 'FT': 'Finalização na Trave', 'G': 'Gol', 'GC': 'Gol Contra', 'GS': 'Gol Sofrido', 'I': 'Impedimento', 'PC': 'Pênalti Cometido', 'PP': 'Pênalti Perdido', 'PS': 'Pênalti Sofrido', 'SG': 'Jogo sem Sofrer Gol', 'V': 'Vitórias' };
    const MESES_ABREV = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

    // --- ELEMENTOS DO DOM E DADOS ---
    const loadingStatus = document.getElementById('loading-status'),
          tabJogadores = document.getElementById('tab-jogadores'),
          tabClubes = document.getElementById('tab-clubes'),
          tabCedidos = document.getElementById('tab-cedidos'),
          contentJogadores = document.getElementById('content-jogadores'),
          contentClubes = document.getElementById('content-clubes'),
          contentCedidos = document.getElementById('content-cedidos'),
          atletasContainer = document.getElementById('atletas-container'),
          clubesContainer = document.getElementById('clubes-container'),
          cedidosContainer = document.getElementById('cedidos-container');

    let dadosAgregados = {}, dadosClubesAgregados = {}, dadosCedidos = {}, todosClubes = {}, todasPosicoes = {}, clubesParticipantes = new Set();
    
    const createNewAthleteEntry = (info) => ({ ...info, pontuacao: { total: 0, mandante: 0, visitante: 0 }, jogos: { total: 0, mandante: 0, visitante: 0 }, scouts: { total: {}, mandante: {}, visitante: {} } });
    const createNewClubEntry = (info) => ({ ...info, pontuacao: { total: 0, mandante: 0, visitante: 0 }, jogos: { total: 0, mandante: 0, visitante: 0 }, scouts: { total: {}, mandante: {}, visitante: {} } });

    // --- LÓGICA DE INTERFACE ---
    function setupTabs() {
        if (tabJogadores) tabJogadores.addEventListener('click', () => switchTab('jogadores'));
        if (tabClubes) tabClubes.addEventListener('click', () => switchTab('clubes'));
        if (tabCedidos) tabCedidos.addEventListener('click', () => switchTab('cedidos'));
    }
    
    function switchTab(activeTab) {
        const isJogadores = activeTab === 'jogadores';
        const isClubes = activeTab === 'clubes';
        const isCedidos = activeTab === 'cedidos';

        if (tabJogadores && contentJogadores) {
            tabJogadores.classList.toggle('active', isJogadores);
            contentJogadores.classList.toggle('active', isJogadores);
        }
        
        if (tabClubes && contentClubes) {
            tabClubes.classList.toggle('active', isClubes);
            contentClubes.classList.toggle('active', isClubes);
        }

        if (tabCedidos && contentCedidos) {
            tabCedidos.classList.toggle('active', isCedidos);
            contentCedidos.classList.toggle('active', isCedidos);
        }

        applyFilters();
    }

    // --- LÓGICA: CARREGAR O JSON PRONTO ---
    async function carregarBancoDeDados() {
        if (loadingStatus) loadingStatus.textContent = 'A carregar dados da nuvem...';
        
        try {
            // Adiciona um timestamp na URL para forçar o download do arquivo JSON mais recente
            const res = await fetch(`dados_cartola.json?t=${new Date().getTime()}`);
            if (!res.ok) throw new Error('Arquivo de dados não encontrado.');
            
            const db = await res.json();
            
            atualizarStatusNaTela(db.status);
            todosClubes = db.clubes;
            
            if (!db.rodadas || db.rodadas.length === 0) {
                if (loadingStatus) loadingStatus.textContent = 'O campeonato ainda não começou.';
                return;
            }

            db.rodadas.forEach(rodada => {
                processaDadosDaRodada(rodada.scout, rodada.partidas);
            });

            if (loadingStatus) loadingStatus.style.display = 'none';
            populateFilters();
            switchTab('jogadores');

        } catch (error) {
            console.error('Erro ao buscar JSON:', error);
            if (loadingStatus) loadingStatus.textContent = 'Aguardando primeira atualização do banco de dados...';
        }
    }

    function atualizarStatusNaTela(statusData) {
        const elStatus = document.getElementById('status-texto');
        const elContainerFecha = document.getElementById('fechamento-container');
        const elDataFecha = document.getElementById('data-fechamento');
        
        let rodada = statusData.rodada_atual || 0;
        if (statusData.status_mercado === 1) rodada -= 1;
        
        const rodadaAtualEl = document.getElementById('rodada-atual');
        if (rodadaAtualEl) rodadaAtualEl.textContent = rodada > 0 ? rodada : '-';

        if (statusData.status_mercado === 1) {
            if (elStatus) {
                elStatus.textContent = 'Aberto';
                elStatus.style.color = '#22c55e';
                elStatus.style.fontWeight = 'bold';
            }
            if (statusData.fechamento && elDataFecha && elContainerFecha) {
                const f = statusData.fechamento;
                const min = f.minuto < 10 ? `0${f.minuto}` : f.minuto;
                const mesAbrev = MESES_ABREV[f.mes - 1] || f.mes;
                elDataFecha.textContent = `${f.dia}/${mesAbrev} às ${f.hora}:${min}`;
                elContainerFecha.style.display = 'block';
            }
        } else {
            if (elStatus) {
                elStatus.textContent = 'Fechado';
                elStatus.style.color = '#ef4444';
                elStatus.style.fontWeight = 'bold';
            }
            if (elContainerFecha) elContainerFecha.style.display = 'none';
        }
    }

    function processaDadosDaRodada(scoutData, partidas) {
        if (!scoutData || !scoutData.atletas || Object.keys(scoutData.atletas).length === 0) return;
        if (scoutData.posicoes) todasPosicoes = scoutData.posicoes;

        const localMapa = {};
        const confrontoMapa = {};
        partidas.forEach(partida => {
            localMapa[partida.clube_casa_id] = 'mandante';
            localMapa[partida.clube_visitante_id] = 'visitante';
            
            confrontoMapa[partida.clube_casa_id] = partida.clube_visitante_id;
            confrontoMapa[partida.clube_visitante_id] = partida.clube_casa_id;
        });

        const clubesQueJogaramNaRodada = new Set(Object.values(scoutData.atletas).map(a => a.clube_id));

        clubesQueJogaramNaRodada.forEach(clubeId => {
            if (!todosClubes[clubeId] || !localMapa[clubeId]) return;
            const local = localMapa[clubeId];
            if (!dadosClubesAgregados[clubeId]) dadosClubesAgregados[clubeId] = createNewClubEntry(todosClubes[clubeId]);
            dadosClubesAgregados[clubeId].jogos.total += 1;
            dadosClubesAgregados[clubeId].jogos[local] += 1;

            // Inicializa a estrutura de Pontos Cedidos para este clube
            if (!dadosCedidos[clubeId]) {
                dadosCedidos[clubeId] = { jogos: { total: 0, mandante: 0, visitante: 0 }, posicoes: {} };
            }
            dadosCedidos[clubeId].jogos.total += 1;
            dadosCedidos[clubeId].jogos[local] += 1;
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

            // --- LÓGICA: PONTOS CEDIDOS ---
            const adversarioId = confrontoMapa[clubeId];
            if (adversarioId && dadosCedidos[adversarioId]) {
                const localAdversario = local === 'mandante' ? 'visitante' : 'mandante';
                const posId = atleta.posicao_id;
                
                if (!dadosCedidos[adversarioId].posicoes[posId]) {
                    dadosCedidos[adversarioId].posicoes[posId] = { total: 0, mandante: 0, visitante: 0 };
                }
                
                dadosCedidos[adversarioId].posicoes[posId].total += atleta.pontuacao;
                dadosCedidos[adversarioId].posicoes[posId][localAdversario] += atleta.pontuacao;
            }
        }
    }

    function populateFilters() {
        const fClubeJogadores = document.getElementById('filtro-clube-jogadores'), 
              fPosJogadores = document.getElementById('filtro-posicao-jogadores'), 
              fScoutJogadores = document.getElementById('filtro-scout-jogadores'), 
              fScoutClubes = document.getElementById('filtro-scout-clubes'),
              fPosCedidos = document.getElementById('filtro-posicao-cedidos');
        
        if (fClubeJogadores && fClubeJogadores.options.length > 1) return;

        Array.from(clubesParticipantes).map(id => todosClubes[id]).filter(Boolean).sort((a, b) => a.nome_fantasia.localeCompare(b.nome_fantasia)).forEach(c => {
            if (fClubeJogadores) fClubeJogadores.innerHTML += `<option value="${c.id}">${c.nome_fantasia}</option>`;
        });
        
        Object.values(todasPosicoes).forEach(p => {
            if (fPosJogadores) fPosJogadores.innerHTML += `<option value="${p.id}">${p.nome}</option>`;
            if (fPosCedidos) fPosCedidos.innerHTML += `<option value="${p.id}">${p.nome}</option>`;
        });

        const scoutOptions = Object.entries(SCOUTS_DESCRICOES).sort((a, b) => a[1].localeCompare(b[1])).map(([sigla, desc]) => `<option value="${sigla}">${desc}</option>`).join('');
        if (fScoutJogadores) fScoutJogadores.innerHTML += scoutOptions; 
        if (fScoutClubes) fScoutClubes.innerHTML += scoutOptions;
    }

    function applyFilters() {
        if (tabJogadores && tabJogadores.classList.contains('active')) { applyFiltersJogadores(); } 
        else if (tabClubes && tabClubes.classList.contains('active')) { applyFiltersClubes(); }
        else if (tabCedidos && tabCedidos.classList.contains('active')) { applyFiltersCedidos(); }
    }

    function applyFiltersJogadores() {
        const elClube = document.getElementById('filtro-clube-jogadores');
        const elPos = document.getElementById('filtro-posicao-jogadores');
        const elLocal = document.getElementById('filtro-local-jogadores');
        const elViewMode = document.querySelector('input[name="view-mode-jogadores"]:checked');
        const elMetrica = document.getElementById('filtro-scout-jogadores');

        if (!elClube || !elPos || !elLocal || !elViewMode || !elMetrica) return;

        const clubeId = elClube.value, posId = elPos.value, local = elLocal.value, viewMode = elViewMode.value, metricaSelecionada = elMetrica.value;
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
        renderAtletas(atletasFiltrados, local, viewMode, metricaSelecionada);
    }
    
    function applyFiltersClubes() {
        const elLocal = document.getElementById('filtro-local-clubes');
        const elViewMode = document.querySelector('input[name="view-mode-clubes"]:checked');
        const elMetrica = document.getElementById('filtro-scout-clubes');

        if (!elLocal || !elViewMode || !elMetrica) return;

        const local = elLocal.value, viewMode = elViewMode.value, metricaSelecionada = elMetrica.value;
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
        renderClubes(clubesFiltrados, local, viewMode, metricaSelecionada);
    }

    function applyFiltersCedidos() {
        const elLocal = document.getElementById('filtro-local-cedidos');
        const elPosId = document.getElementById('filtro-posicao-cedidos');
        
        if (!elLocal || !elPosId) return;

        const local = elLocal.value;
        const posId = elPosId.value;
        
        let cedidosArray = Object.keys(dadosCedidos).map(clubeId => {
            const dados = dadosCedidos[clubeId];
            let pontos = 0;
            
            if (posId !== 'todos') {
                pontos = dados.posicoes[posId] ? dados.posicoes[posId][local === 'todos' ? 'total' : local] : 0;
            } else {
                Object.values(dados.posicoes).forEach(p => {
                    pontos += p[local === 'todos' ? 'total' : local];
                });
            }
            
            const jogos = dados.jogos[local === 'todos' ? 'total' : local];
            const media = jogos > 0 ? pontos / jogos : 0;
            
            return {
                clube: todosClubes[clubeId],
                jogos: jogos,
                pontos: pontos,
                media: media
            };
        }).filter(item => item.jogos > 0);
        
        // Ordenar dos piores (maior média) para os melhores
        cedidosArray.sort((a, b) => b.media - a.media);
        renderCedidos(cedidosArray, posId, local);
    }

    function renderAtletas(atletas, local, viewMode, metricaScout) { 
        if (!atletasContainer) return;
        atletasContainer.innerHTML = '';
        
        if (atletas.length === 0) { 
            atletasContainer.innerHTML = '<p style="text-align:center; color: var(--muted); padding: 20px;">Nenhum atleta encontrado.</p>'; 
            return; 
        }

        for (const atleta of atletas) {
            const key = (local === 'todos') ? 'total' : local; 
            const jogos = atleta.jogos[key]; 
            if (!jogos && local !== 'todos') continue;
            
            let valor, rotulo;
            if (metricaScout === 'pontuacao') { 
                rotulo = 'Pontuação'; 
                valor = atleta.pontuacao[key]; 
            } else { 
                rotulo = SCOUTS_DESCRICOES[metricaScout] || metricaScout; 
                valor = atleta.scouts[key][metricaScout] || 0; 
            }
            
            const valorCalculado = (viewMode === 'media' && jogos > 0) ? (valor / jogos) : valor;
            let valorDisplay = (viewMode === 'media' || metricaScout === 'pontuacao') ? valorCalculado.toFixed(2) : valorCalculado.toFixed(0);
            
            let subtexto = viewMode === 'media' ? `Média em ${jogos} jogos` : `Total em ${jogos} jogos`;
            if (local !== 'todos') subtexto += ` (${local})`;
            
            const itemDiv = document.createElement('div'); 
            itemDiv.className = 'item-lista';
            itemDiv.innerHTML = `<img src="${atleta.foto ? atleta.foto.replace('FORMATO', '140x140') : ''}" alt="Foto" style="border-radius:50%"><div class="info"><h3>${atleta.apelido}</h3><p>${todosClubes[atleta.clube_id]?.nome_fantasia || ''} • ${todasPosicoes[atleta.posicao_id]?.nome || ''}</p></div><div class="metrica"><span class="metrica-label">${rotulo}</span><span class="metrica-valor">${valorDisplay}</span><span class="metrica-subtext">${subtexto}</span></div>`;
            atletasContainer.appendChild(itemDiv);
        }
    }
    
    function renderClubes(clubes, local, viewMode, metricaScout) {
        if (!clubesContainer) return;
        clubesContainer.innerHTML = '';
        
        if (clubes.length === 0) { 
            clubesContainer.innerHTML = '<p style="text-align:center; color: var(--muted); padding: 20px;">Nenhum clube encontrado.</p>'; 
            return; 
        }

        for (const clube of clubes) {
            const key = (local === 'todos') ? 'total' : local;
            const jogos = clube.jogos[key];
            let valor, rotulo;
            
            if (metricaScout === 'pontuacao') { 
                rotulo = 'Pontuação'; 
                valor = clube.pontuacao[key]; 
            } else { 
                rotulo = SCOUTS_DESCRICOES[metricaScout] || metricaScout; 
                valor = clube.scouts[key][metricaScout] || 0; 
            }
            
            const valorCalculado = (viewMode === 'media' && jogos > 0) ? (valor / jogos) : valor;
            let valorDisplay = (viewMode === 'media' || metricaScout === 'pontuacao') ? valorCalculado.toFixed(2) : valorCalculado.toFixed(0);

            const itemDiv = document.createElement('div');
            itemDiv.className = 'item-lista';
            itemDiv.innerHTML = `<img src="${clube.escudos['60x60']}" alt="Escudo do ${clube.nome_fantasia}"><div class="info"><h3>${clube.nome_fantasia}</h3><p>${clube.abreviacao}</p></div><div class="metrica"><span class="metrica-label">${rotulo}</span><span class="metrica-valor">${valorDisplay}</span></div>`;
            clubesContainer.appendChild(itemDiv);
        }
    }

    function renderCedidos(lista, posId, local) {
        if (!cedidosContainer) return;
        cedidosContainer.innerHTML = '';
        
        if (lista.length === 0) { 
            cedidosContainer.innerHTML = '<p style="text-align:center; color: var(--muted); padding: 20px;">Nenhum dado encontrado. As rodadas ainda não ocorreram ou os dados estão vazios.</p>'; 
            return; 
        }
        
        let labelPosicao = posId === 'todos' ? 'Média Cedida (Geral)' : `Média Cedida p/ ${todasPosicoes[posId].nome}`;
        
        for (const item of lista) {
            const subtexto = `Em ${item.jogos} jogos como ${local === 'todos' ? 'Mandante/Visitante' : local}`;
            
            const itemDiv = document.createElement('div');
            itemDiv.className = 'item-lista';
            itemDiv.innerHTML = `
                <img src="${item.clube.escudos['60x60']}" alt="Escudo">
                <div class="info">
                    <h3>${item.clube.nome_fantasia}</h3>
                    <p>Pior adversário para esta posição</p>
                </div>
                <div class="metrica">
                    <span class="metrica-label" style="color: #ef4444;">${labelPosicao}</span>
                    <span class="metrica-valor" style="color: #ef4444;">${item.media.toFixed(2)}</span>
                    <span class="metrica-subtext">${subtexto}</span>
                </div>`;
            cedidosContainer.appendChild(itemDiv);
        }
    }

    // --- INICIALIZAÇÃO ---
    const allFilterElements = document.querySelectorAll('.filtros select, .filtros input');
    allFilterElements.forEach(el => el.addEventListener('change', applyFilters));
    setupTabs();
    
    carregarBancoDeDados();
});
