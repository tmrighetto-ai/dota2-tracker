/**
 * Módulo de Recomendação de Itens.
 * Busca dados reais de itens populares para cada herói via API do OpenDota.
 * Mostra porcentagem de uso de cada item por fase do jogo.
 */

let globalHeroStats = null;

/**
 * Inicializa a seção de recomendação de itens.
 * Mostra uma grade de heróis para o jogador selecionar.
 */
function initItemRecommendation(turboHeroes, heroConstants, itemConstants, heroStats) {
    globalHeroStats = heroStats;

    const searchInput = document.getElementById('item-hero-search');
    const heroListEl = document.getElementById('item-hero-list');
    if (!searchInput || !heroListEl) return;

    // Mostra os heróis mais jogados no Turbo primeiro
    const sortedHeroes = [...turboHeroes]
        .filter(h => h.games > 0 && heroConstants[h.hero_id])
        .sort((a, b) => b.games - a.games)
        .slice(0, 20);

    renderHeroSelector(sortedHeroes, heroConstants, itemConstants, heroListEl);

    // Filtro por nome
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase();
        if (!query) {
            renderHeroSelector(sortedHeroes, heroConstants, itemConstants, heroListEl);
            return;
        }

        // Busca entre todos os heróis do jogo
        const allHeroes = Object.values(heroConstants)
            .filter(h => h.localized_name.toLowerCase().includes(query))
            .map(h => ({ hero_id: h.id, games: 0, win: 0 }));

        renderHeroSelector(allHeroes, heroConstants, itemConstants, heroListEl);
    });
}

/**
 * Renderiza a grade de heróis selecionáveis.
 */
function renderHeroSelector(heroes, heroConstants, itemConstants, container) {
    container.innerHTML = heroes.map(h => {
        const info = heroConstants[h.hero_id];
        if (!info) return '';

        const heroNameForImg = info.name.replace('npc_dota_hero_', '');
        const imgSrc = `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${heroNameForImg}.png`;

        return `
            <div class="item-hero-option" onclick="showItemRecommendation(${h.hero_id})">
                <img src="${imgSrc}" onerror="this.style.display='none'" alt="${info.localized_name}">
                <span>${info.localized_name}</span>
                ${h.games > 0 ? `<small>${h.games} partidas</small>` : ''}
            </div>
        `;
    }).join('');
}

/**
 * Mostra a recomendação de itens para um herói específico.
 * Busca dados REAIS de popularidade de itens via API do OpenDota.
 */
async function showItemRecommendation(heroId) {
    const recEl = document.getElementById('item-recommendation');
    if (!recEl) return;

    recEl.classList.remove('hidden');

    const heroInfo = globalHeroConstants[heroId];
    if (!heroInfo) {
        recEl.innerHTML = '<p style="color:#8892a4">Heroi nao encontrado.</p>';
        return;
    }

    const heroNameForImg = heroInfo.name.replace('npc_dota_hero_', '');
    const heroImg = `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${heroNameForImg}.png`;

    // Mostra loading enquanto busca
    recEl.innerHTML = `
        <div class="item-rec-header">
            <img src="${heroImg}" class="item-rec-hero-img" onerror="this.style.display='none'">
            <div>
                <h3 class="item-rec-hero-name">${heroInfo.localized_name}</h3>
                <p class="item-rec-attr">${getAttrLabel(heroInfo.primary_attr)} — ${getRolesLabel(heroInfo.roles)}</p>
            </div>
        </div>
        <p style="color:#8892a4;padding:20px;text-align:center">Buscando itens populares...</p>
    `;

    // Busca dados reais de itens populares da API
    const itemPop = await fetchHeroItemPopularity(heroId);

    if (!itemPop) {
        recEl.innerHTML += '<p style="color:#ff4757">Erro ao buscar itens. Tente novamente.</p>';
        return;
    }

    // Converte os dados da API para itens com nome e porcentagem
    const startItems = converterItensPopulares(itemPop.start_game_items, globalItemConstants, 8);
    const earlyItems = converterItensPopulares(itemPop.early_game_items, globalItemConstants, 6);
    const midItems = converterItensPopulares(itemPop.mid_game_items, globalItemConstants, 6);
    const lateItems = converterItensPopulares(itemPop.late_game_items, globalItemConstants, 6);

    recEl.innerHTML = `
        <div class="item-rec-header">
            <img src="${heroImg}" class="item-rec-hero-img" onerror="this.style.display='none'">
            <div>
                <h3 class="item-rec-hero-name">${heroInfo.localized_name}</h3>
                <p class="item-rec-attr">${getAttrLabel(heroInfo.primary_attr)} — ${getRolesLabel(heroInfo.roles)}</p>
            </div>
        </div>
        <p class="section-desc" style="margin-bottom:16px">
            Itens mais usados por jogadores de ${heroInfo.localized_name} em todas as partidas ranqueadas.
            A porcentagem indica a frequencia de compra entre os jogadores.
        </p>
        <div class="item-rec-phases">
            ${renderBuildPhase('ITENS INICIAIS', 'Comprados no inicio da partida', startItems)}
            ${renderBuildPhase('EARLY GAME', 'Primeiros itens completos', earlyItems)}
            ${renderBuildPhase('MID GAME', 'Itens de meio de jogo', midItems)}
            ${renderBuildPhase('LATE GAME', 'Itens finais', lateItems)}
        </div>
    `;
}

/**
 * Converte os dados da API (ID: contagem) para objetos com nome, imagem e porcentagem.
 * Ordena pelos mais populares e retorna os top N.
 */
function converterItensPopulares(itemData, itemConstants, maxItems) {
    if (!itemData || !itemConstants) return [];

    // Monta array com id, nome, imagem e contagem
    const items = [];
    let totalCompras = 0;

    // itemData é um objeto { "itemId": contagem, ... }
    for (const [itemId, count] of Object.entries(itemData)) {
        totalCompras += count;
    }

    for (const [itemId, count] of Object.entries(itemData)) {
        // Encontra o item pelo ID numerico no dicionario de itens
        const id = parseInt(itemId);
        const itemKey = Object.keys(itemConstants).find(k => itemConstants[k].id === id);

        if (itemKey) {
            const itemName = itemKey.replace('recipe_', '');
            // Pula receitas (nao sao itens visuais uteis)
            if (itemKey.startsWith('recipe_')) continue;

            const imgName = itemKey;
            const imgUrl = `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${imgName}.png`;
            const porcentagem = totalCompras > 0 ? ((count / totalCompras) * 100).toFixed(1) : '0';

            items.push({
                name: itemKey,
                displayName: itemKey.replace(/_/g, ' '),
                img: imgUrl,
                count: count,
                porcentagem: porcentagem
            });
        }
    }

    // Ordena pelos mais comprados
    items.sort((a, b) => b.count - a.count);

    return items.slice(0, maxItems);
}

/**
 * Renderiza uma fase da build com porcentagens de uso.
 */
function renderBuildPhase(title, description, items) {
    if (!items || items.length === 0) return '';

    const itemsHtml = items.map(item =>
        `<div class="build-item" title="${item.displayName} — ${item.porcentagem}% de uso">
            <img src="${item.img}" onerror="this.style.display='none'" alt="${item.displayName}">
            <div class="build-item-info">
                <span>${item.displayName}</span>
                <small class="build-item-pct">${item.porcentagem}%</small>
            </div>
        </div>`
    ).join('');

    return `
        <div class="build-phase">
            <h4 class="build-phase-title">${title}</h4>
            <p class="build-phase-desc">${description}</p>
            <div class="build-items">${itemsHtml}</div>
        </div>
    `;
}

/**
 * Retorna o nome do atributo primario em portugues.
 */
function getAttrLabel(attr) {
    const labels = {
        'agi': 'Agilidade',
        'str': 'Forca',
        'int': 'Inteligencia',
        'all': 'Universal'
    };
    return labels[attr] || attr;
}

/**
 * Retorna as roles do heroi formatadas.
 */
function getRolesLabel(roles) {
    if (!roles || roles.length === 0) return '';
    return roles.slice(0, 3).join(', ');
}
