/**
 * Módulo para renderização de heróis.
 */

// Estado da paginacao de herois
let heroPageAtual = 0;
let heroDataGlobal = [];
let heroConstantsGlobal = {};

// Quantos herois por pagina — baseado em 2 linhas de ~6 cards
const HEROES_POR_PAGINA = 12;

/**
 * Renderiza os cards dos heróis mais jogados com paginacao.
 */
function renderHeroCards(heroesData, heroConstants) {
    heroConstantsGlobal = heroConstants;
    heroPageAtual = 0;

    // Filtra heróis que realmente têm partidas jogadas
    const comGames = heroesData.filter(h => h.games > 0);

    if (comGames.length === 0) {
        const grid = document.getElementById('heroes-grid');
        grid.innerHTML = `
            <div style="color: #8892a4; padding: 20px; font-size: 14px">
                Aguardando sincronizacao do OpenDota.
            </div>`;
        return;
    }

    heroDataGlobal = [...comGames].sort((a, b) => b.games - a.games);
    renderHeroPage();
}

/**
 * Renderiza uma pagina de herois.
 */
function renderHeroPage() {
    const grid = document.getElementById('heroes-grid');
    grid.innerHTML = '';

    const inicio = heroPageAtual * HEROES_POR_PAGINA;
    const fim = inicio + HEROES_POR_PAGINA;
    const heroisPagina = heroDataGlobal.slice(inicio, fim);
    const totalPaginas = Math.ceil(heroDataGlobal.length / HEROES_POR_PAGINA);

    heroisPagina.forEach(hero => {
        const info = heroConstantsGlobal[hero.hero_id];
        if (!info) return;

        const winRate = hero.games > 0
            ? ((hero.win / hero.games) * 100).toFixed(1)
            : '0.0';

        const barColor = parseFloat(winRate) >= 50 ? '#39d353' : '#ff4757';
        const heroNameForImg = info.name.replace('npc_dota_hero_', '');
        const imgSrc = `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${heroNameForImg}.png`;

        const card = document.createElement('div');
        card.className = 'hero-card';
        card.innerHTML = `
            <img src="${imgSrc}" alt="${info.localized_name}" class="hero-img"
                onerror="this.style.display='none'">
            <div class="hero-card-info">
                <h3>${info.localized_name}</h3>
                <p>${hero.games} partidas</p>
                <p>WR: <strong style="color:${barColor}">${winRate}%</strong></p>
                <div class="hero-win-bar">
                    <div class="win-progress" style="width:${winRate}%; background-color:${barColor}"></div>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });

    // Paginacao (so mostra se tem mais de 1 pagina)
    if (totalPaginas > 1) {
        const pagDiv = document.createElement('div');
        pagDiv.className = 'hero-pagination';
        pagDiv.innerHTML = `
            <button class="hero-page-btn" ${heroPageAtual === 0 ? 'disabled' : ''} onclick="heroPageAtual--; renderHeroPage()">Anterior</button>
            <span class="hero-page-info">${heroPageAtual + 1} / ${totalPaginas}</span>
            <button class="hero-page-btn" ${heroPageAtual >= totalPaginas - 1 ? 'disabled' : ''} onclick="heroPageAtual++; renderHeroPage()">Proximo</button>
        `;
        grid.appendChild(pagDiv);
    }
}