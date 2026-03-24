const BASE_URL = 'https://api.opendota.com/api';

/**
 * Função auxiliar central para todas as chamadas.
 * CORREÇÃO: Aceita status 200 E 304 (cache do navegador).
 */
async function apiFetch(url) {
    // Adiciona timestamp para forçar dados frescos e ignorar cache
    const separator = url.includes('?') ? '&' : '?';
    const freshUrl = `${url}${separator}_=${Date.now()}`;
    
    const response = await fetch(freshUrl);
    if (!response.ok && response.status !== 304) {
        throw new Error(`Erro HTTP ${response.status} em: ${url}`);
    }
    return await response.json();
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
 * Busca partidas Turbo do jogador (game_mode=23).
 * Tenta primeiro com filtro direto da API.
 * Se vier vazio, busca TODAS as partidas e filtra no código.
 */
async function fetchTurboMatches(accountId) {
    try {
        // Tentativa 1: filtro direto pela API
        const turbo = await apiFetch(
            `${BASE_URL}/players/${accountId}/matches?game_mode=23&limit=200`
        );
        if (turbo && turbo.length > 0) return turbo;

        // Tentativa 2: busca todas as partidas e filtra no código
        console.warn('Filtro Turbo da API veio vazio, buscando todas as partidas...');
        const todas = await apiFetch(
            `${BASE_URL}/players/${accountId}/matches?limit=500`
        );
        if (todas && todas.length > 0) {
            const turboFiltradas = todas.filter(m => m.game_mode === 23);
            if (turboFiltradas.length > 0) return turboFiltradas;
        }

        return [];
    } catch (error) {
        console.error('Erro em fetchTurboMatches:', error);
        return null;
    }
}

/**
 * Busca estatísticas de heróis filtradas por Turbo (game_mode=23).
 */
async function fetchTurboHeroes(accountId) {
    try {
        return await apiFetch(
            `${BASE_URL}/players/${accountId}/heroes?game_mode=23`
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
            `${BASE_URL}/players/${accountId}/wl?game_mode=23`
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
            `${BASE_URL}/players/${accountId}/totals?game_mode=23`
        );
    } catch (error) {
        console.error('Erro em fetchTurboTotals:', error);
        return null;
    }
}

/**
 * Busca os amigos que mais jogam com o jogador.
 */
async function fetchPeers(accountId) {
    try {
        return await apiFetch(
            `${BASE_URL}/players/${accountId}/peers`
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
            `${BASE_URL}/players/${accountId}/heroes?hero_id=${heroId}&game_mode=23`
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

/**
 * Busca os itens mais populares de um herói específico.
 * Retorna itens divididos por fase: start_game, early_game, mid_game, late_game.
 * Cada item tem um ID numérico e a contagem de vezes que foi comprado.
 */
async function fetchHeroItemPopularity(heroId) {
    try {
        return await apiFetch(`${BASE_URL}/heroes/${heroId}/itemPopularity`);
    } catch (error) {
        console.error('Erro em fetchHeroItemPopularity:', error);
        return null;
    }
}