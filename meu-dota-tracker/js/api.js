const BASE_URL = 'https://api.opendota.com/api';

/**
 * Função auxiliar central para todas as chamadas.
 * CORREÇÃO: Aceita status 200 E 304 (cache do navegador).
 */
async function apiFetch(url) {
    // Sem cache-buster — deixa o navegador usar cache quando possível
    // para economizar chamadas da API (limite diário gratuito)
    const freshUrl = url;

    const response = await fetch(freshUrl);

    // Detecta rate limit da OpenDota (429 ou corpo com "rate limit"/"limit exceeded")
    if (response.status === 429) {
        throw new Error('RATE_LIMIT');
    }

    if (!response.ok && response.status !== 304) {
        // Tenta ler o corpo para ver se é rate limit
        try {
            const errorBody = await response.json();
            if (errorBody.error && errorBody.error.includes('limit')) {
                throw new Error('RATE_LIMIT');
            }
        } catch (e) {
            if (e.message === 'RATE_LIMIT') throw e;
        }
        throw new Error(`Erro HTTP ${response.status} em: ${url}`);
    }

    const data = await response.json();

    // A API pode retornar 200 mas com erro no corpo
    if (data && data.error && data.error.includes('limit')) {
        throw new Error('RATE_LIMIT');
    }

    return data;
}

/**
 * Pede ao OpenDota para sincronizar os dados do jogador.
 * Isso é necessário para jogadores que nunca foram buscados antes.
 * O OpenDota demora alguns minutos para processar.
 */
async function refreshPlayer(accountId) {
    try {
        await fetch(`${BASE_URL}/players/${accountId}/refresh`, { method: 'POST' });
    } catch (e) {
        console.warn('Refresh falhou (não crítico):', e);
    }
}

async function fetchPlayerProfile(accountId) {
    try {
        const data = await apiFetch(`${BASE_URL}/players/${accountId}`);
        if (!data.profile) {
            console.warn('Perfil privado para ID:', accountId);
            return null;
        }
        return data;
    } catch (error) {
        // Propaga rate limit para mostrar mensagem específica ao usuário
        if (error.message === 'RATE_LIMIT') throw error;
        console.error('Erro em fetchPlayerProfile:', error);
        return null;
    }
}

async function fetchRecentMatches(accountId) {
    try {
        return await apiFetch(`${BASE_URL}/players/${accountId}/recentMatches`);
    } catch (error) {
        console.error('Erro em fetchRecentMatches:', error);
        return null;
    }
}

async function fetchHeroesPlayed(accountId) {
    try {
        return await apiFetch(`${BASE_URL}/players/${accountId}/heroes`);
    } catch (error) {
        console.error('Erro em fetchHeroesPlayed:', error);
        return null;
    }
}

async function fetchMatchDetail(matchId) {
    try {
        return await apiFetch(`${BASE_URL}/matches/${matchId}`);
    } catch (error) {
        console.error('Erro em fetchMatchDetail:', error);
        return null;
    }
}

async function fetchHeroConstants() {
    try {
        const heroesArray = await apiFetch(`${BASE_URL}/heroes`);
        const heroMap = {};
        heroesArray.forEach(hero => {
            heroMap[hero.id] = hero;
        });
        return heroMap;
    } catch (error) {
        console.error('Erro em fetchHeroConstants:', error);
        return null;
    }
}

async function fetchItemConstants() {
    try {
        return await apiFetch(`${BASE_URL}/constants/items`);
    } catch (error) {
        console.error('Erro em fetchItemConstants:', error);
        return null;
    }
}

/**
 * Busca TODAS as partidas Turbo do jogador.
 *
 * A chave é usar significant=0 (partidas não-ranqueadas) — isso faz a OpenDota
 * retornar as partidas Turbo com game_mode=23 corretamente.
 * Sem esse parâmetro, /matches?game_mode=23 retorna vazio.
 *
 * Usa paginação (500 por request) e filtra client-side por game_mode=23.
 */
async function fetchTurboMatches(accountId) {
    try {
        let todasTurbo = [];
        let offset = 0;
        const LIMITE_POR_PAGINA = 500;

        while (true) {
            const url = `${BASE_URL}/players/${accountId}/matches?significant=0&limit=${LIMITE_POR_PAGINA}&offset=${offset}`;
            const pagina = await apiFetch(url);

            if (!pagina || pagina.length === 0) break;

            const turboNaPagina = pagina.filter(m => m.game_mode === 23);
            todasTurbo = todasTurbo.concat(turboNaPagina);

            if (pagina.length < LIMITE_POR_PAGINA) break;
            if (turboNaPagina.length === 0) break;

            offset += LIMITE_POR_PAGINA;
        }

        if (todasTurbo.length > 0) {
            return todasTurbo;
        }

        return [];
    } catch (error) {
        console.error('Erro em fetchTurboMatches:', error);
        return null;
    }
}

/**
 * Busca estatísticas de heróis filtradas por Turbo.
 * Usa significant=0&game_mode=23 para garantir que a OpenDota retorne os dados Turbo.
 */
async function fetchTurboHeroes(accountId) {
    try {
        return await apiFetch(
            `${BASE_URL}/players/${accountId}/heroes?significant=0&game_mode=23`
        );
    } catch (error) {
        console.error('Erro em fetchTurboHeroes:', error);
        return null;
    }
}

/**
 * Busca Win/Loss do jogador filtrado por Turbo.
 */
async function fetchTurboWinLoss(accountId) {
    try {
        return await apiFetch(
            `${BASE_URL}/players/${accountId}/wl?significant=0&game_mode=23`
        );
    } catch (error) {
        console.error('Erro em fetchTurboWinLoss:', error);
        return null;
    }
}

/**
 * Busca totais gerais do jogador filtrado por Turbo.
 */
async function fetchTurboTotals(accountId) {
    try {
        return await apiFetch(
            `${BASE_URL}/players/${accountId}/totals?significant=0&game_mode=23`
        );
    } catch (error) {
        console.error('Erro em fetchTurboTotals:', error);
        return null;
    }
}

/**
 * Busca os amigos que mais jogam Turbo com o jogador.
 * Usa significant=0&game_mode=23 para filtrar apenas partidas Turbo.
 */
async function fetchPeers(accountId) {
    try {
        return await apiFetch(
            `${BASE_URL}/players/${accountId}/peers?significant=0&game_mode=23`
        );
    } catch (error) {
        console.error('Erro em fetchPeers:', error);
        return null;
    }
}

/**
 * Busca matchups de heróis (contra quem ganha/perde mais).
 */
async function fetchHeroMatchups(accountId, heroId) {
    try {
        return await apiFetch(
            `${BASE_URL}/players/${accountId}/heroes?hero_id=${heroId}&significant=0&game_mode=23`
        );
    } catch (error) {
        console.error('Erro em fetchHeroMatchups:', error);
        return null;
    }
}

/**
 * Busca dados públicos de um herói (picks, win rates globais).
 */
async function fetchPublicHeroStats() {
    try {
        return await apiFetch(`${BASE_URL}/heroStats`);
    } catch (error) {
        console.error('Erro em fetchPublicHeroStats:', error);
        return null;
    }
}

/**
 * Solicita ao OpenDota que faça o parse de uma partida específica.
 * Isso adiciona a partida ao banco de dados do OpenDota para consultas futuras.
 * Retorna o job que foi criado na fila de processamento.
 */
async function requestMatchParse(matchId) {
    try {
        const resp = await fetch(`${BASE_URL}/request/${matchId}`, { method: 'POST' });
        if (resp.ok) {
            return await resp.json();
        }
    } catch (e) {
        console.warn('Erro ao solicitar parse da partida', matchId, e);
    }
    return null;
}

// Cache em memoria para popularidade de itens por heroi.
// Persiste enquanto a aba estiver aberta — evita chamadas repetidas ao mudar de heroi no simulador.
const _heroItemPopCache = {};

/**
 * Busca os itens mais populares de um herói específico.
 * Retorna itens divididos por fase: start_game, early_game, mid_game, late_game.
 * Cada item tem um ID numérico e a contagem de vezes que foi comprado.
 * Usa cache em memoria: o mesmo heroi nao faz duas chamadas na mesma sessao.
 */
async function fetchHeroItemPopularity(heroId) {
    if (_heroItemPopCache[heroId]) return _heroItemPopCache[heroId];
    try {
        const data = await apiFetch(`${BASE_URL}/heroes/${heroId}/itemPopularity`);
        if (data) _heroItemPopCache[heroId] = data;
        return data;
    } catch (error) {
        console.error('Erro em fetchHeroItemPopularity:', error);
        return null;
    }
}