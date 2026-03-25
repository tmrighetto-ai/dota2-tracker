/**
 * Módulo Principal - Inicialização e Controle do Dashboard
 */

const FALLBACK_DATA = {
    profile: {
        personaname: "Jogador de Exemplo",
        avatarfull: "https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg",
        account_id: "000000000"
    },
    mmr_estimate: { estimate: 'N/A' },
    heroes: [
        { hero_id: 1,  games: 150, win: 90 },
        { hero_id: 2,  games: 120, win: 70 },
        { hero_id: 8,  games: 100, win: 55 },
        { hero_id: 11, games: 80,  win: 40 },
        { hero_id: 22, games: 60,  win: 35 }
    ],
    matches: [
        // CORREÇÃO 1: Adicionados net_worth e item_0~item_5 que estavam faltando
        {
            match_id: 7634521098, hero_id: 1,
            start_time: 1710328000, duration: 2400,
            kills: 12, deaths: 3, assists: 15,
            net_worth: 22000, hero_damage: 25000,
            radiant_win: true, player_slot: 0,
            item_0: 1, item_1: 46, item_2: 0,
            item_3: 0, item_4: 0, item_5: 0
        }
    ]
};

let globalMatches = null;
let globalHeroConstants = null;
let globalItemConstants = null;
let globalAccountId = null;

document.addEventListener('DOMContentLoaded', () => {
    const searchForm   = document.getElementById('search-form');
    const accountInput = document.getElementById('account-id');

    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const rawId = accountInput.value.trim();
        if (!rawId) return;

        showLoader(true);
        try {
            const accountId = await processId(rawId);
            loadDashboard(accountId);
        } catch (error) {
            showLoader(false);
            showError(`⚠️ ${error.message}`);
        }
    });

    window.addEventListener('pageChange', () => {
        updateDisplay(globalHeroConstants, globalItemConstants);
    });

    // Verifica se tem um ID salvo na URL (ex: #id=88376774)
    // Isso mantém o login ao atualizar a página
    const savedId = getSavedAccountId();
    if (savedId) {
        accountInput.value = savedId;
        loadDashboard(savedId);
    } else {
        // Se não tem ID salvo, verifica retorno do Steam OpenID
        verificarRetornoSteam();
    }

}); // ← fecha o DOMContentLoaded

/**
 * Salva o Account ID na URL (hash) para manter o login ao atualizar.
 * Ex: index.html#id=88376774
 */
function salvarAccountIdNaUrl(accountId) {
    window.location.hash = `id=${accountId}`;
}

/**
 * Lê o Account ID salvo na URL.
 * Retorna o ID ou null se não tiver.
 */
function getSavedAccountId() {
    const hash = window.location.hash;
    const match = hash.match(/#id=(\d+)/);
    return match ? match[1] : null;
}

/**
 * Remove o ID da URL e recarrega a tela de boas-vindas.
 * Chamada pelo botão "Sair" no header.
 */
function logout() {
    // Limpa a URL
    history.replaceState(null, '', window.location.pathname);

    // Esconde os botões COMPARTILHAR e SAIR
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) btnLogout.classList.add('hidden');
    const btnShare = document.getElementById('btn-share');
    if (btnShare) btnShare.classList.add('hidden');

    // Limpa variáveis globais
    globalMatches = null;
    globalHeroConstants = null;
    globalItemConstants = null;
    globalAccountId = null;

    // Esconde todas as seções de dados
    const secoes = [
        'profile-section', 'turbo-summary', 'turbo-performance',
        'heroes-section', 'counters-section', 'items-recommend',
        'simulator-section', 'metas-section', 'friends-section', 'matches-section'
    ];
    secoes.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    // Esconde erro/info
    hideError();

    // Limpa o campo de busca
    document.getElementById('account-id').value = '';

    // Mostra a tela de boas-vindas
    const welcomeEl = document.getElementById('welcome-section');
    if (welcomeEl) welcomeEl.classList.remove('hidden');
}

/**
 * Aceita 3 formatos:
 * 1. URL completa: steamcommunity.com/profiles/76561198xxxxxxx
 * 2. URL com nome: steamcommunity.com/id/thiaGoGO
 * 3. ID numérico de 64 bits: 76561198xxxxxxx
 */
async function processId(input) {
    input = input.trim();

    // Formato 1: URL com ID numérico
    // Ex: https://steamcommunity.com/profiles/76561198049642502
    const profileMatch = input.match(/profiles\/(\d+)/);
    if (profileMatch) {
        const steam64 = BigInt(profileMatch[1]);
        return (steam64 - BigInt('76561197960265728')).toString();
    }

    // Formato 2: URL com nome personalizado
    // Ex: https://steamcommunity.com/id/thiaGoGO
    const vanityMatch = input.match(/\/id\/([^\/]+)/);
    if (vanityMatch) {
        return await resolverVanityName(vanityMatch[1]);
    }

    // Formato 3: ID numérico de 64 bits colado direto
    if (input.length > 10 && /^\d+$/.test(input)) {
        const steam64 = BigInt(input);
        return (steam64 - BigInt('76561197960265728')).toString();
    }

    // Formato 4: Já é um Account ID de 32 bits
    return input;
}

/**
 * Resolve nome personalizado Steam para Account ID.
 * Tenta múltiplos métodos em sequência até um funcionar.
 */
async function resolverVanityName(nome) {

    // Método 1: PlayerDB — API gratuita feita para resolver nomes Steam
    try {
        const resp = await fetch(`https://playerdb.co/api/player/steam/${encodeURIComponent(nome)}`);
        if (resp.ok) {
            const data = await resp.json();
            if (data.success && data.data && data.data.player && data.data.player.id) {
                const steam64 = BigInt(data.data.player.id);
                return (steam64 - BigInt('76561197960265728')).toString();
            }
        }
    } catch (e) {
        console.warn('Método 1 (PlayerDB) falhou:', e);
    }

    // Método 2: Proxy CORS — acessa perfil Steam XML e extrai o ID
    const steamXmlUrl = `https://steamcommunity.com/id/${nome}/?xml=1`;
    const proxies = [
        `https://api.allorigins.win/get?url=${encodeURIComponent(steamXmlUrl)}`,
        `https://corsproxy.io/?url=${encodeURIComponent(steamXmlUrl)}`
    ];

    for (const proxyUrl of proxies) {
        try {
            const resp = await fetch(proxyUrl, { signal: AbortSignal.timeout(5000) });
            if (!resp.ok) continue;
            let xml;
            // allorigins /get retorna JSON com campo "contents"
            if (proxyUrl.includes('allorigins')) {
                const json = await resp.json();
                xml = json.contents || '';
            } else {
                xml = await resp.text();
            }
            const steamIdMatch = xml.match(/<steamID64>(\d+)<\/steamID64>/);
            if (steamIdMatch) {
                const steam64 = BigInt(steamIdMatch[1]);
                return (steam64 - BigInt('76561197960265728')).toString();
            }
        } catch (e) {
            console.warn('Proxy falhou:', e);
        }
    }

    // Método 3: OpenDota search — busca pelo nome
    try {
        const results = await apiFetch(
            `https://api.opendota.com/api/search?q=${encodeURIComponent(nome)}`
        );
        if (results && results.length > 0) {
            if (results.length === 1) {
                return results[0].account_id.toString();
            }
            const nomes = results.slice(0, 5).map((r, i) =>
                `${i + 1}. ${r.personaname} (ID: ${r.account_id})`
            ).join('\n');
            const escolha = prompt(
                `Vários jogadores encontrados para "${nome}".\nDigite o número:\n${nomes}`
            );
            const idx = parseInt(escolha) - 1;
            if (idx >= 0 && idx < results.length) {
                return results[idx].account_id.toString();
            }
            return results[0].account_id.toString();
        }
    } catch (e) {
        console.warn('Método 3 (OpenDota search) falhou:', e);
    }

    // Nenhum método funcionou
    throw new Error(
        `Não foi possível resolver "${nome}". ` +
        'Tente colar o link com números: steamcommunity.com/profiles/76561198XXXXXXXX ' +
        'ou abra o Dota 2 e copie seu Friend ID.'
    );
}

/**
 * Carrega todos os dados do dashboard em paralelo.
 * Foco total em partidas Turbo (game_mode=23).
 */
async function loadDashboard(accountId) {
    showLoader(true);
    hideError();

    // Esconde a tela de boas-vindas
    const welcomeEl = document.getElementById('welcome-section');
    if (welcomeEl) welcomeEl.classList.add('hidden');

    try {
        // Pede ao OpenDota para sincronizar os dados do jogador
        refreshPlayer(accountId);

        // Busca dados base em paralelo (sem paginação pesada)
        const [
            profile, heroConstants, itemConstants,
            turboHeroes, turboWL, turboTotals,
            recentMatches, peers, heroStats
        ] = await Promise.all([
            fetchPlayerProfile(accountId),
            fetchHeroConstants(),
            fetchItemConstants(),
            fetchTurboHeroes(accountId),
            fetchTurboWinLoss(accountId),
            fetchTurboTotals(accountId),
            fetchRecentMatches(accountId),
            fetchPeers(accountId),
            fetchPublicHeroStats()
        ]);

        // Busca partidas Turbo separadamente (usa paginação, pode demorar)
        let turboMatches = null;
        try {
            turboMatches = await fetchTurboMatches(accountId);
        } catch (e) {
            console.warn('Erro ao buscar partidas Turbo:', e);
        }

        if (!profile || !profile.profile) {
            throw new Error(
                "Não foi possível carregar o perfil. Pode ser: " +
                "perfil privado, ID inválido, ou limite da API OpenDota excedido. " +
                "Se funcionava antes, aguarde alguns minutos e tente novamente."
            );
        }

        // ===== MONTAGEM DAS PARTIDAS TURBO =====
        // A rota /matches?game_mode=23 pode vir VAZIA mesmo tendo partidas Turbo
        // (OpenDota não indexou). Já o /recentMatches SEMPRE traz dados completos
        // (kills, GPM, dano, etc.) direto da Valve.
        // Estratégia: priorizar recentMatches filtradas por Turbo como fonte principal.

        // Passo 1: Filtrar partidas Turbo das recentMatches (fonte mais confiável)
        const recentTurbo = (recentMatches || []).filter(m => m.game_mode === 23);

        // Passo 2: Montar mapa por match_id das recentMatches Turbo
        const recentMap = {};
        recentTurbo.forEach(m => { recentMap[m.match_id] = m; });

        // Passo 3: Se turboMatches da API trouxe dados, enriquecer com recentMatches
        // e adicionar partidas que só existem nas recentMatches
        let matchesFinais = [];

        if (turboMatches && turboMatches.length > 0) {
            // Usa turboMatches como base mas substitui pelas recentMatches quando possível
            const matchIds = new Set();
            turboMatches.forEach(m => {
                const enriched = recentMap[m.match_id] || m;
                matchesFinais.push(enriched);
                matchIds.add(m.match_id);
            });
            // Adiciona partidas Turbo das recentes que não estavam na lista
            recentTurbo.forEach(m => {
                if (!matchIds.has(m.match_id)) matchesFinais.push(m);
            });
        } else {
            // /matches não retornou nada — usa recentMatches Turbo como fonte principal
            matchesFinais = recentTurbo;
        }

        // Se ainda não tem nenhuma partida Turbo, usa TODAS as recentes como fallback
        const usandoTodas = matchesFinais.length === 0;
        if (usandoTodas) {
            matchesFinais = recentMatches || [];
        }

        // Separar partidas com detalhes completos (para cálculos de KDA/GPM/dano)
        const matchesComDetalhes = matchesFinais.filter(
            m => m.kills > 0 || m.deaths > 0 || m.assists > 0 || m.gold_per_min > 0
        );
        const temDetalhes = matchesComDetalhes.length > 0;

        // Ordena por data (mais recente primeiro)
        matchesFinais.sort((a, b) => (b.start_time || 0) - (a.start_time || 0));

        // Salva nas variáveis globais
        globalAccountId = accountId;
        globalMatches = matchesFinais;
        globalHeroConstants = heroConstants;
        globalItemConstants = itemConstants;

        // Heróis: usa dados da API se disponíveis, senão calcula das partidas
        const turboHeroesComDados = turboHeroes?.filter(h => h.games > 0) || [];
        const herosFinal = turboHeroesComDados.length > 0
            ? turboHeroesComDados
            : derivarHeroesDasPartidas(matchesFinais);

        // Win/Loss: usa API se disponível, senão calcula de TODAS as turbo
        // (win/loss não precisa de detalhes, só player_slot + radiant_win)
        let winLossFinal = turboWL;
        if (!winLossFinal || (winLossFinal.win === 0 && winLossFinal.lose === 0)) {
            winLossFinal = calcularWinLoss(matchesFinais);
        }

        // Totals (KDA, GPM, etc): verifica se a API trouxe dados REAIS
        // A API pode retornar array com itens mas todos com sum=0 (não parseadas)
        let totalsFinal = turboTotals;
        const totalsTemDados = totalsFinal && totalsFinal.length > 0 &&
            totalsFinal.some(t => t.n > 0 && t.sum > 0);

        if (!totalsTemDados) {
            // Calcula manualmente das partidas que TÊM detalhes
            const fonteStats = matchesComDetalhes.length > 0 ? matchesComDetalhes : matchesFinais;
            totalsFinal = calcularTotais(fonteStats);
        }

        // Renderiza todas as seções
        renderProfileBanner(profile);
        // Para o summary, passa matchesFinais (para win/loss e sequência)
        // mas totalsFinal já foi calculado só das partidas COM detalhes
        renderTurboSummary(winLossFinal, totalsFinal, matchesFinais);
        // Para o gráfico de desempenho, usa partidas com detalhes quando possível
        const matchesParaGrafico = matchesComDetalhes.length > 0 ? matchesComDetalhes : matchesFinais;
        renderPerformanceChart(matchesParaGrafico, heroConstants);
        renderHeroCards(herosFinal, heroConstants);
        renderCounters(herosFinal, heroConstants);
        initItemRecommendation(herosFinal, heroConstants, itemConstants, heroStats);
        renderFriends(peers || [], heroConstants);
        initFilters(matchesFinais, heroConstants, itemConstants);
        updateDisplay(heroConstants, itemConstants);

        // Mostra todas as seções
        document.getElementById('profile-section').classList.remove('hidden');
        document.getElementById('turbo-summary').classList.remove('hidden');
        document.getElementById('turbo-performance').classList.remove('hidden');
        document.getElementById('heroes-section').classList.remove('hidden');
        document.getElementById('counters-section').classList.remove('hidden');
        document.getElementById('items-recommend').classList.remove('hidden');
        document.getElementById('friends-section').classList.remove('hidden');
        document.getElementById('matches-section').classList.remove('hidden');
        document.getElementById('simulator-section').classList.remove('hidden');
        document.getElementById('metas-section').classList.remove('hidden');
        initSimulator(heroConstants, globalItemConstants);
        initMetas(heroConstants, globalItemConstants);

        // Salva o ID na URL para manter o login ao atualizar a página
        salvarAccountIdNaUrl(accountId);

        // Mostra os botões COMPARTILHAR e SAIR
        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) btnLogout.classList.remove('hidden');
        const btnShare = document.getElementById('btn-share');
        if (btnShare) btnShare.classList.remove('hidden');

        // Solicita parse das partidas Turbo ao OpenDota em segundo plano.
        // Isso faz com que na PRÓXIMA busca, as rotas /matches e /wl
        // tenham os dados indexados e retornem o histórico completo.
        solicitarParsePartidas(matchesFinais);

        // Aviso sobre dados e como liberar histórico completo
        if (usandoTodas) {
            showInfo(
                'Nenhuma partida Turbo encontrada. Mostrando partidas recentes. ' +
                'Para liberar seu historico completo, ative a opcao no Dota 2: ' +
                '<strong>Configuracoes → Opcoes → Opcoes Avancadas → Expor Dados de Partidas Publicas</strong>. ' +
                'Depois, ' +
                `<a href="https://www.opendota.com/players/${accountId}" target="_blank" style="color:#f5a623;font-weight:700;text-decoration:underline;">` +
                'abra seu perfil no OpenDota</a> e clique em "Refresh".'
            );
        }

    } catch (error) {
        console.error("Erro:", error);
        if (error.message === 'RATE_LIMIT' || error.message.includes('RATE_LIMIT')) {
            showError(
                '⚠️ Limite da API OpenDota excedido! A API gratuita tem um limite diário de chamadas. ' +
                'Aguarde alguns minutos (ou até o reset diário às ~21h de Brasília) e tente novamente. ' +
                'Dica: evite recarregar a página muitas vezes seguidas.'
            );
        } else {
            showError(`⚠️ ${error.message}`);
        }
        // Mostra a tela de boas-vindas novamente em caso de erro
        const welcomeEl2 = document.getElementById('welcome-section');
        if (welcomeEl2) welcomeEl2.classList.remove('hidden');
    } finally {
        showLoader(false);
    }
}

/**
 * Calcula Win/Loss a partir de uma lista de partidas.
 * Usado quando a API não retorna dados filtrados.
 */
function calcularWinLoss(matches) {
    if (!matches || matches.length === 0) return { win: 0, lose: 0 };

    let win = 0, lose = 0;
    matches.forEach(m => {
        const isWin = (m.player_slot < 128 && m.radiant_win) ||
                      (m.player_slot >= 128 && !m.radiant_win);
        if (isWin) win++;
        else lose++;
    });
    return { win, lose };
}

/**
 * Calcula totais (médias) a partir de uma lista de partidas.
 * Imita o formato da rota /totals do OpenDota.
 */
function calcularTotais(matches) {
    if (!matches || matches.length === 0) return [];

    const campos = ['kills', 'deaths', 'assists', 'duration', 'hero_damage', 'gold_per_min', 'xp_per_min'];
    return campos.map(field => {
        let sum = 0;
        let n = 0;
        matches.forEach(m => {
            if (m[field] !== undefined && m[field] !== null) {
                sum += m[field];
                n++;
            }
        });
        return { field, n, sum };
    });
}

/**
 * Mostra uma mensagem informativa (azul) — diferente de erro.
 */
function showInfo(msg) {
    const errorDiv = document.getElementById('error-msg');
    if (errorDiv) {
        errorDiv.innerHTML = `ℹ️ ${msg}`;
        errorDiv.classList.remove('hidden');
        errorDiv.style.borderColor = '#4a90a4';
        errorDiv.style.color = '#8ec8e8';
        errorDiv.style.background = 'rgba(74, 144, 164, 0.1)';
    }
}

/**
 * Deriva estatísticas de heróis a partir das partidas recentes.
 * Usa recentMatches que já funciona, sem precisar de parse.
 */
function derivarHeroesDasPartidas(matches) {
    if (!matches || matches.length === 0) return [];

    const heroMap = {};

    matches.forEach(match => {
        const id = match.hero_id;
        if (!heroMap[id]) {
            heroMap[id] = { hero_id: id, games: 0, win: 0 };
        }
        heroMap[id].games++;

        const isWin = (match.player_slot < 128 && match.radiant_win) ||
                      (match.player_slot >= 128 && !match.radiant_win);
        if (isWin) heroMap[id].win++;
    });

    // Retorna ordenado pelos mais jogados
    return Object.values(heroMap).sort((a, b) => b.games - a.games);
}

/**
 * Renderiza o banner do topo com foto, nome e MMR.
 */
function renderProfileBanner(playerData) {
    const banner  = document.getElementById('player-banner');
    const profile = playerData.profile;

    // CORREÇÃO 3: Leitura correta do MMR — estava quebrando quando o campo não existia
    const mmr = (playerData.mmr_estimate && playerData.mmr_estimate.estimate)
        ? playerData.mmr_estimate.estimate
        : 'Não rankeado';

    banner.innerHTML = `
        <img src="${profile.avatarfull}" class="avatar" alt="Avatar">
        <div class="player-info">
            <h1>${profile.personaname}</h1>
            <p class="mmr-tag">MMR ESTIMADO: ${mmr}</p>
            <p>Account ID: ${profile.account_id}</p>
        </div>
    `;
}

/**
 * Carrega dados fictícios caso a API falhe.
 */
async function loadFallback() {
    const heroConstants = await fetchHeroConstants() || {};
    const itemConstants = await fetchItemConstants() || {};

    globalHeroConstants = heroConstants;
    globalItemConstants = itemConstants;

    renderProfileBanner(FALLBACK_DATA);
    renderHeroCards(FALLBACK_DATA.heroes, heroConstants);
    initFilters(FALLBACK_DATA.matches, heroConstants, itemConstants);
    updateDisplay(heroConstants, itemConstants);

    document.getElementById('profile-section').classList.remove('hidden');
    document.getElementById('heroes-section').classList.remove('hidden');
    document.getElementById('matches-section').classList.remove('hidden');
}

function showLoader(show) {
    const loader = document.getElementById('loader');
    if (loader) {
        if (show) loader.classList.remove('hidden');
        else loader.classList.add('hidden');
    }
}

function showError(msg) {
    const errorDiv = document.getElementById('error-msg');
    if (errorDiv) {
        errorDiv.textContent = msg;
        errorDiv.classList.remove('hidden');
    }
}

function hideError() {
    const errorDiv = document.getElementById('error-msg');
    if (errorDiv) errorDiv.classList.add('hidden');
}/**
 * Solicita ao OpenDota que faça o parse de cada partida Turbo.
 * Isso adiciona as partidas ao banco de dados deles, permitindo que
 * nas próximas buscas as rotas /matches e /wl retornem dados completos.
 * Roda em segundo plano com delay para não estourar rate limit.
 */
async function solicitarParsePartidas(matches) {
    if (!matches || matches.length === 0) return;

    for (let i = 0; i < matches.length; i++) {
        const matchId = matches[i].match_id;
        if (!matchId) continue;

        try {
            await requestMatchParse(matchId);
            console.log(`Parse solicitado: partida ${matchId} (${i + 1}/${matches.length})`);
        } catch (e) {
            // Silencioso — não é crítico
        }

        // Delay de 1.5s entre cada solicitação
        if (i < matches.length - 1) {
            await new Promise(r => setTimeout(r, 1500));
        }
    }
    console.log('Todas as partidas foram enviadas para parse no OpenDota.');
}

/* ============================================
   COMPARTILHAMENTO SOCIAL
   ============================================ */

/**
 * Gera o texto resumo das stats Turbo para compartilhar.
 * Pega os dados diretamente do que está renderizado na tela.
 */
function gerarTextoCompartilhamento() {
    // Pega o nome do jogador
    const nomeEl = document.querySelector('.player-info h1');
    const nome = nomeEl ? nomeEl.textContent : 'Jogador';

    // Pega as stats dos cards renderizados
    const statCards = document.querySelectorAll('.turbo-stat-card');
    let winRate = '—';
    let kda = '—';
    let gpm = '—';
    let xpm = '—';
    let dano = '—';
    let partidas = '—';

    statCards.forEach(card => {
        const label = card.querySelector('.stat-label');
        const value = card.querySelector('.stat-value');
        if (!label || !value) return;

        const labelText = label.textContent.toUpperCase();
        const valueText = value.textContent;

        if (labelText.includes('WIN RATE')) {
            winRate = valueText;
            const sub = card.querySelector('.stat-sub');
            if (sub) partidas = sub.textContent;
        }
        else if (labelText.includes('KDA')) kda = valueText;
        else if (labelText.includes('GPM')) gpm = valueText;
        else if (labelText.includes('XPM')) xpm = valueText;
        else if (labelText.includes('DANO')) dano = valueText;
    });

    // Pega os top 3 heróis
    const heroCards = document.querySelectorAll('.hero-card');
    let topHerois = [];
    heroCards.forEach((card, i) => {
        if (i >= 3) return;
        const heroName = card.querySelector('.hero-card-info h3');
        if (heroName) topHerois.push(heroName.textContent);
    });

    const heroTexto = topHerois.length > 0
        ? topHerois.join(', ')
        : 'Nenhum herói registrado';

    // Link do perfil no Turbo Tracker
    const urlPerfil = window.location.href;

    const texto =
`⚡ TURBO TRACKER — Minhas Stats Turbo ⚡

👤 ${nome}
🏆 Win Rate: ${winRate} ${partidas ? '(' + partidas + ')' : ''}
⚔️ KDA Médio: ${kda}
💰 GPM: ${gpm}
📈 XPM: ${xpm}
💥 Dano Médio: ${dano}

🎮 Top Heróis: ${heroTexto}

Veja suas stats Turbo: ${urlPerfil}
#Dota2 #Turbo #DotaPlus`;

    return texto;
}

/**
 * Abre o modal de compartilhamento e gera o preview do texto.
 */
function abrirCompartilhar() {
    const modal = document.getElementById('share-modal');
    const preview = document.getElementById('share-preview');
    const feedback = document.getElementById('share-feedback');

    // Gera o texto e mostra no preview
    const texto = gerarTextoCompartilhamento();
    preview.textContent = texto;

    // Esconde feedback anterior
    feedback.classList.add('hidden');

    // Mostra o modal
    modal.classList.remove('hidden');
}

/**
 * Fecha o modal de compartilhamento.
 * Se clicar no fundo escuro (overlay), também fecha.
 */
function fecharCompartilhar(event) {
    // Se foi chamada por clique no overlay, fecha
    // Se foi chamada pelo botão X, fecha também
    const modal = document.getElementById('share-modal');
    modal.classList.add('hidden');
}

/**
 * Compartilha no WhatsApp (abre em nova aba).
 */
function compartilharWhatsApp() {
    const texto = gerarTextoCompartilhamento();
    const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
}

/**
 * Compartilha no Twitter/X (abre em nova aba).
 */
function compartilharTwitter() {
    const texto = gerarTextoCompartilhamento();
    // Twitter tem limite de 280 chars, mas o link encurtará automaticamente
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
}

/**
 * Compartilha no Facebook (abre diálogo de compartilhamento).
 */
function compartilharFacebook() {
    const urlPerfil = window.location.href;
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(urlPerfil)}&quote=${encodeURIComponent(gerarTextoCompartilhamento())}`;
    window.open(url, '_blank');
}

/**
 * Compartilha no Reddit (abre formulário de novo post).
 */
function compartilharReddit() {
    const texto = gerarTextoCompartilhamento();
    const url = `https://www.reddit.com/submit?title=${encodeURIComponent('⚡ Minhas Stats Turbo — Dota 2')}&text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
}

/**
 * Compartilha no Telegram (abre em nova aba).
 */
function compartilharTelegram() {
    const texto = gerarTextoCompartilhamento();
    const urlPerfil = window.location.href;
    const url = `https://t.me/share/url?url=${encodeURIComponent(urlPerfil)}&text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
}

/**
 * Copia o texto das stats para a área de transferência.
 */
function copiarTexto() {
    const texto = gerarTextoCompartilhamento();
    const feedback = document.getElementById('share-feedback');

    navigator.clipboard.writeText(texto).then(() => {
        feedback.textContent = '✅ Texto copiado! Cole onde quiser.';
        feedback.classList.remove('hidden');
        // Esconde o feedback após 3 segundos
        setTimeout(() => feedback.classList.add('hidden'), 3000);
    }).catch(() => {
        // Fallback para navegadores que não suportam clipboard API
        const textarea = document.createElement('textarea');
        textarea.value = texto;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);

        feedback.textContent = '✅ Texto copiado! Cole onde quiser.';
        feedback.classList.remove('hidden');
        setTimeout(() => feedback.classList.add('hidden'), 3000);
    });
}

/**
 * Redireciona para o login da Steam via OpenID.
 * Após login, Steam retorna para esta mesma página com o ID na URL.
 */
function loginComSteam() {
    const returnUrl = encodeURIComponent(window.location.href.split('?')[0]);
    const realm     = encodeURIComponent(window.location.origin);

    const steamLoginUrl =
        'https://steamcommunity.com/openid/login' +
        '?openid.ns=http://specs.openid.net/auth/2.0' +
        '&openid.mode=checkid_setup' +
        `&openid.return_to=${returnUrl}` +
        `&openid.realm=${realm}` +
        '&openid.identity=http://specs.openid.net/auth/2.0/identifier_select' +
        '&openid.claimed_id=http://specs.openid.net/auth/2.0/identifier_select';

    window.location.href = steamLoginUrl;
}

/**
 * Ao carregar a página, verifica se Steam retornou com o ID na URL.
 * Ex: ?openid.claimed_id=https://steamcommunity.com/openid/id/76561198049642502
 */
function verificarRetornoSteam() {
    const params = new URLSearchParams(window.location.search);
    const mode   = params.get('openid.mode');

    // Steam retornou com sucesso
    if (mode === 'id_res') {
        // O claimed_id vem como URL, ex:
        // https://steamcommunity.com/openid/id/76561198049642502
        const claimedId = params.get('openid.claimed_id');

        if (claimedId) {
            const match = claimedId.match(/\/openid\/id\/(\d+)/);
            if (match) {
                const steam64   = BigInt(match[1]);
                const accountId = (steam64 - BigInt('76561197960265728')).toString();

                // Limpa a URL sem recarregar a página
                window.history.replaceState({}, document.title, window.location.pathname);

                // Preenche o campo e carrega automaticamente
                document.getElementById('account-id').value = match[1];
                loadDashboard(accountId);
                return;
            }
        }

        // Se chegou aqui, Steam retornou mas sem ID — limpa a URL
        window.history.replaceState({}, document.title, window.location.pathname);
        showError('⚠️ Não foi possível obter o ID da Steam. Tente buscar manualmente.');
    }
}

// ============================================
// FUNDO TEMATICO — Efeito parallax sutil
// ============================================
(function() {
    // Muda o gradiente do fundo conforme o scroll para dar sensacao de profundidade
    let ticking = false;
    window.addEventListener('scroll', function() {
        if (!ticking) {
            window.requestAnimationFrame(function() {
                const scrollY = window.scrollY;
                const docHeight = document.documentElement.scrollHeight - window.innerHeight;
                const progress = docHeight > 0 ? scrollY / docHeight : 0;

                // Move os gradientes radiais conforme o scroll
                const goldY = Math.round(progress * 30);         // dourado desce
                const greenX = Math.round(progress * 15);        // verde se move
                const redX = Math.round(100 - progress * 15);    // vermelho se move
                const blueY = Math.round(70 - progress * 20);    // azul sobe

                document.body.style.setProperty('--bg-gold-y', goldY + '%');
                document.body.style.setProperty('--bg-green-x', greenX + '%');
                document.body.style.setProperty('--bg-red-x', redX + '%');
                document.body.style.setProperty('--bg-blue-y', blueY + '%');

                ticking = false;
            });
            ticking = true;
        }
    });
})();
