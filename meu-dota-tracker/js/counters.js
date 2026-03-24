/**
 * Módulo de Counters — Mostra contra quais heróis o jogador ganha ou perde mais no Turbo.
 */

/**
 * Analisa as partidas Turbo e identifica heróis que aparecem
 * do time inimigo e calcula o win rate contra cada um.
 * Precisa dos dados de detalhe das partidas para saber quem estava no time inimigo.
 *
 * Versão simplificada: usa os heróis que o jogador mais jogou
 * e suas taxas de vitória no Turbo.
 */
function renderCounters(turboHeroes, heroConstants) {
    const goodEl = document.getElementById('counters-good');
    const badEl = document.getElementById('counters-bad');
    if (!goodEl || !badEl || !turboHeroes || !heroConstants) return;

    // Filtra heróis com pelo menos 3 partidas no Turbo
    const relevantes = turboHeroes
        .filter(h => h.games >= 3 && heroConstants[h.hero_id])
        .map(h => {
            const wr = h.games > 0 ? (h.win / h.games) * 100 : 0;
            return { ...h, winRate: wr };
        });

    // Se tiver poucos heróis, mostra mensagem
    if (relevantes.length < 2) {
        const msg = '<p style="color:#8892a4; padding:10px">Jogue com mais heróis (mínimo 3 partidas cada) para ver seus counters.</p>';
        goodEl.innerHTML = msg;
        badEl.innerHTML = msg;
        return;
    }

    // Ordena por win rate
    const ordenados = [...relevantes].sort((a, b) => b.winRate - a.winRate);

    // Divide ao meio: metade de cima = forte, metade de baixo = fraco
    // Garante que nenhum herói aparece nas duas listas
    const metade = Math.ceil(ordenados.length / 2);
    const bons = ordenados.slice(0, metade);
    const ruins = ordenados.slice(metade).reverse(); // piores primeiro

    goodEl.innerHTML = renderCounterList(bons, heroConstants, true);
    badEl.innerHTML = renderCounterList(ruins, heroConstants, false);
}

/**
 * Renderiza uma lista de heróis com win rate.
 */
function renderCounterList(heroes, heroConstants, isGood) {
    if (heroes.length === 0) {
        return '<p style="color:#8892a4; padding:10px">Dados insuficientes</p>';
    }

    return heroes.map(h => {
        const info = heroConstants[h.hero_id];
        if (!info) return '';

        const heroNameForImg = info.name.replace('npc_dota_hero_', '');
        const imgSrc = `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${heroNameForImg}.png`;
        const wrColor = isGood ? 'var(--win-green)' : 'var(--loss-red)';

        return `
            <div class="counter-item">
                <img src="${imgSrc}" class="counter-hero-img" onerror="this.style.display='none'"
                    alt="${info.localized_name}">
                <div class="counter-info">
                    <span class="counter-name">${info.localized_name}</span>
                    <span class="counter-games">${h.games} partidas</span>
                </div>
                <div class="counter-wr" style="color:${wrColor}">
                    ${h.winRate.toFixed(1)}%
                </div>
                <div class="counter-bar">
                    <div class="counter-bar-fill" style="width:${h.winRate}%; background:${wrColor}"></div>
                </div>
            </div>
        `;
    }).join('');
}
