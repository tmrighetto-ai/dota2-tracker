/**
 * Módulo Simulador de Partida — Fase 4
 * Recomendação inteligente de itens baseada nos 10 heróis da partida.
 * Considera: meta atual, counters, sinergia entre heróis e tipo de dano.
 */

// Estado do simulador
let simHeroConstants = null;
let simItemConstants = null;
let simSelectedHeroes = {
    ally: [null, null, null, null, null],   // ally[0] = o herói do jogador
    enemy: [null, null, null, null, null]
};
let simPickerTarget = null; // { team: 'ally'|'enemy', index: 0-4 }

// Posições dos aliados (pos 1-5, null = não definida)
let simPositions = [null, null, null, null, null];

// Posições dos inimigos (pos 1-5, null = não definida)
let simEnemyPositions = [null, null, null, null, null];

// Qual heroi está sendo visualizado
let simVisualizandoIndex = 0;        // index no array (0-4)
let simVisualizandoTeam = 'ally';    // 'ally' ou 'enemy'

/**
 * Dados de prioridade de farm por posição.
 * Pos 1 = maior farm, Pos 5 = menor farm.
 * goldPrioridade: quanto maior, mais gold o herói tende a ter.
 * Usado para decidir quem faz itens caros vs baratos.
 */
const POS_DATA = {
    '1': { nome: 'Hard Carry',    goldPrioridade: 5, farmPriority: 'altissima', cor: '#f5a623' },
    '2': { nome: 'Mid',           goldPrioridade: 4, farmPriority: 'alta',      cor: '#00e5ff' },
    '3': { nome: 'Offlaner',      goldPrioridade: 3, farmPriority: 'media',     cor: '#39d353' },
    '4': { nome: 'Suporte',       goldPrioridade: 2, farmPriority: 'baixa',     cor: '#b86bff' },
    '5': { nome: 'Hard Suporte',  goldPrioridade: 1, farmPriority: 'minima',    cor: '#ff9ff3' }
};

/**
 * Atualiza a posição de um aliado e colore o select.
 */
function atualizarPosicao(index, valor) {
    simPositions[index] = valor ? parseInt(valor) : null;

    const select = document.getElementById('sim-pos-' + index);
    if (select) {
        // Remove classes anteriores
        select.className = 'sim-pos-select';
        if (valor) {
            select.classList.add('pos-' + valor);
        }
    }
}

/**
 * Atualiza a posição de um inimigo e colore o select.
 */
function atualizarPosicaoInimigo(index, valor) {
    simEnemyPositions[index] = valor ? parseInt(valor) : null;

    const select = document.getElementById('sim-epos-' + index);
    if (select) {
        select.className = 'sim-pos-select sim-pos-enemy';
        if (valor) {
            select.classList.add('pos-' + valor);
        }
    }
}

/**
 * Mapa de counter-items: quais itens são bons contra certas características.
 * Cada entrada tem: condição (tags dos heróis inimigos) → itens recomendados com motivo.
 */
const COUNTER_ITEMS = {
    // Contra dano mágico pesado
    magic_damage: {
        tags: ['Nuker'],
        items: ['black_king_bar', 'pipe', 'glimmer_cape', 'cloak'],
        reason: 'Proteção contra dano mágico'
    },
    // Contra heróis invisíveis
    invis: {
        heroNames: ['Riki', 'Bounty Hunter', 'Clinkz', 'Nyx Assassin', 'Weaver', 'Mirana', 'Sand King', 'Templar Assassin', 'Invoker', 'Treant Protector'],
        items: ['dust', 'ward_sentry', 'gem', 'silver_edge'],
        reason: 'Detecção de invisibilidade'
    },
    // Contra heróis com muita cura
    heal: {
        heroNames: ['Huskar', 'Necrophos', 'Dazzle', 'Oracle', 'Omniknight', 'Witch Doctor', 'Warlock', 'Chen', 'Enchantress', 'Lifestealer', 'Morphling', 'Alchemist'],
        items: ['spirit_vessel', 'shivas_guard', 'skadi'],
        reason: 'Redução de cura inimiga'
    },
    // Contra heróis com evasão / carries agilidade
    evasion: {
        heroNames: ['Phantom Assassin', 'Windranger', 'Brewmaster', 'Tinker', 'Arc Warden'],
        items: ['monkey_king_bar', 'bloodthorn', 'javelin'],
        reason: 'Counter contra evasão'
    },
    // Contra heróis com muito armor / tanques
    tank: {
        tags: ['Durable'],
        items: ['desolator', 'assault', 'solar_crest', 'spirit_vessel'],
        reason: 'Redução de armor e dano contra tanques'
    },
    // Contra heróis com muito controle (stuns)
    disable: {
        tags: ['Disabler'],
        items: ['black_king_bar', 'linken_sphere', 'aeon_disk', 'lotus_orb', 'manta'],
        reason: 'Proteção contra controles'
    },
    // Contra carries de dano físico
    phys_damage: {
        tags: ['Carry'],
        items: ['ghost', 'heavens_halberd', 'assault', 'shivas_guard', 'blade_mail'],
        reason: 'Proteção contra dano físico'
    },
    // Contra heróis com summons/illusions
    summons: {
        heroNames: ['Phantom Lancer', 'Chaos Knight', 'Naga Siren', 'Terrorblade', 'Meepo', 'Broodmother', 'Nature\'s Prophet', 'Lycan', 'Beastmaster'],
        items: ['battle_fury', 'maelstrom', 'mjollnir', 'crimson_guard', 'shivas_guard'],
        reason: 'Counter contra ilusões e summons'
    },
    // Contra heróis que puxam (gap closers)
    gap_close: {
        heroNames: ['Spirit Breaker', 'Storm Spirit', 'Faceless Void', 'Slark', 'Phantom Assassin', 'Anti-Mage', 'Spectre'],
        items: ['aeon_disk', 'ghost', 'force_staff', 'linken_sphere', 'glimmer_cape'],
        reason: 'Proteção contra heróis agressivos'
    }
};

/**
 * Inicializa o simulador com os dados de heróis e itens.
 */
function initSimulator(heroConstants, itemConstants) {
    simHeroConstants = heroConstants;
    simItemConstants = itemConstants;

    // Reseta seleções e posições
    simSelectedHeroes = {
        ally: [null, null, null, null, null],
        enemy: [null, null, null, null, null]
    };
    simPositions = [null, null, null, null, null];
    simEnemyPositions = [null, null, null, null, null];
    simPickerTarget = null;
    simVisualizandoIndex = 0;
    simVisualizandoTeam = 'ally';

    // Reseta slots visuais
    resetarSlotsVisuais();

    // === PRESET DE TESTE — REMOVER QUANDO TERMINAR OS AJUSTES ===
    const PRESET_ATIVO = true;
    if (PRESET_ATIVO && heroConstants) {
        const presetAlly =  [138, 94, 64, 31, 137]; // Muerta, Medusa, Jakiro, Lich, Primal Beast
        const presetEnemy = [67, 76, 27, 98, 30];   // Spectre, OD, Shadow Shaman, Timbersaw, Witch Doctor
        const presetAllyPos =  [2, 1, 4, 5, 3];     // Mid, Carry, Suporte, Hard Sup, Offlaner
        const presetEnemyPos = [1, 2, 4, 3, 5];     // Carry, Mid, Suporte, Offlaner, Hard Sup

        presetAlly.forEach((id, i) => {
            simSelectedHeroes.ally[i] = id;
            simPositions[i] = presetAllyPos[i];
            // Atualiza visual do slot
            const slot = document.getElementById(`sim-ally-${i}`);
            const hero = heroConstants[id];
            if (slot && hero) {
                const heroImg = hero.name.replace('npc_dota_hero_', '');
                const imgSrc = `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${heroImg}.png`;
                const label = i === 0 ? '<div class="sim-slot-label">VOCE</div>' : '';
                slot.innerHTML = `${label}<img src="${imgSrc}" class="sim-slot-img"><span class="sim-slot-name">${hero.localized_name}</span><button class="sim-slot-remove" onclick="event.stopPropagation(); removerHeroi('ally', ${i})">✕</button>`;
                slot.classList.add('sim-slot-filled');
            }
            // Atualiza select de posicao
            const posSelect = document.getElementById(`sim-pos-${i}`);
            if (posSelect) {
                posSelect.value = presetAllyPos[i].toString();
                posSelect.className = 'sim-pos-select pos-' + presetAllyPos[i];
            }
        });

        presetEnemy.forEach((id, i) => {
            simSelectedHeroes.enemy[i] = id;
            simEnemyPositions[i] = presetEnemyPos[i];
            const slot = document.getElementById(`sim-enemy-${i}`);
            const hero = heroConstants[id];
            if (slot && hero) {
                const heroImg = hero.name.replace('npc_dota_hero_', '');
                const imgSrc = `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${heroImg}.png`;
                slot.innerHTML = `<img src="${imgSrc}" class="sim-slot-img"><span class="sim-slot-name">${hero.localized_name}</span><button class="sim-slot-remove" onclick="event.stopPropagation(); removerHeroi('enemy', ${i})">✕</button>`;
                slot.classList.add('sim-slot-filled');
            }
            const posSelect = document.getElementById(`sim-epos-${i}`);
            if (posSelect) {
                posSelect.value = presetEnemyPos[i].toString();
                posSelect.className = 'sim-pos-select sim-pos-enemy pos-' + presetEnemyPos[i];
            }
        });

        atualizarBotaoGerar();
    }
    // === FIM DO PRESET DE TESTE ===
}

/**
 * Reseta a aparência de todos os slots para o estado inicial.
 */
function resetarSlotsVisuais() {
    for (let i = 0; i < 5; i++) {
        const allySlot = document.getElementById(`sim-ally-${i}`);
        if (allySlot) {
            const label = i === 0 ? '<div class="sim-slot-label">VOCE</div>' : '';
            const placeholder = i === 0 ? '+ Heroi' : '+ Aliado';
            allySlot.innerHTML = `${label}<div class="sim-slot-placeholder">${placeholder}</div>`;
            allySlot.className = i === 0 ? 'sim-slot sim-slot-main' : 'sim-slot';
        }
        // Reseta seletor de posição
        const posSelect = document.getElementById(`sim-pos-${i}`);
        if (posSelect) {
            posSelect.value = '';
            posSelect.className = 'sim-pos-select';
        }
        const enemySlot = document.getElementById(`sim-enemy-${i}`);
        if (enemySlot) {
            enemySlot.innerHTML = '<div class="sim-slot-placeholder">+ Inimigo</div>';
            enemySlot.className = 'sim-slot sim-slot-enemy';
        }
        // Reseta seletor de posição inimigo
        const ePosSelect = document.getElementById(`sim-epos-${i}`);
        if (ePosSelect) {
            ePosSelect.value = '';
            ePosSelect.className = 'sim-pos-select sim-pos-enemy';
        }
    }

    // Esconde resultado e desabilita botão
    const result = document.getElementById('sim-result');
    if (result) result.classList.add('hidden');
    atualizarBotaoGerar();
}

/**
 * Abre o seletor de heróis para um slot específico.
 * Se o slot aliado ja tem um heroi selecionado, troca a visualizacao para ele.
 */
function abrirSeletorHeroi(team, index) {
    // Se o slot ja tem heroi selecionado, troca a visualizacao
    if (simSelectedHeroes[team][index] !== null) {
        trocarVisualizacao(team, index);
        return;
    }

    simPickerTarget = { team, index };

    const picker = document.getElementById('sim-hero-picker');
    const searchInput = document.getElementById('sim-hero-search');
    const grid = document.getElementById('sim-hero-grid');

    if (!picker || !grid || !simHeroConstants) return;

    picker.classList.remove('hidden');
    searchInput.value = '';
    searchInput.focus();

    // Heróis já selecionados (para desabilitar)
    const jaEscolhidos = new Set();
    simSelectedHeroes.ally.forEach(id => { if (id) jaEscolhidos.add(id); });
    simSelectedHeroes.enemy.forEach(id => { if (id) jaEscolhidos.add(id); });

    renderizarGridHerois(grid, '', jaEscolhidos);

    // Filtro de busca
    searchInput.oninput = () => {
        renderizarGridHerois(grid, searchInput.value.toLowerCase(), jaEscolhidos);
    };
}

/**
 * Renderiza a grade de heróis disponíveis para seleção.
 */
function renderizarGridHerois(container, filtro, jaEscolhidos) {
    const heroes = Object.values(simHeroConstants)
        .filter(h => !filtro || h.localized_name.toLowerCase().includes(filtro))
        .sort((a, b) => a.localized_name.localeCompare(b.localized_name));

    container.innerHTML = heroes.map(h => {
        const heroNameForImg = h.name.replace('npc_dota_hero_', '');
        const imgSrc = `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${heroNameForImg}.png`;
        const disabled = jaEscolhidos.has(h.id);

        return `
            <div class="sim-hero-pick ${disabled ? 'sim-hero-disabled' : ''}"
                 onclick="${disabled ? '' : `selecionarHeroi(${h.id})`}"
                 title="${h.localized_name}">
                <img src="${imgSrc}" onerror="this.style.display='none'" alt="${h.localized_name}">
                <span>${h.localized_name}</span>
            </div>
        `;
    }).join('');
}

/**
 * Seleciona um herói para o slot que foi clicado.
 */
function selecionarHeroi(heroId) {
    if (!simPickerTarget) return;

    const { team, index } = simPickerTarget;
    simSelectedHeroes[team][index] = heroId;

    // Atualiza visual do slot
    const slotEl = document.getElementById(`sim-${team}-${index}`);
    const heroInfo = simHeroConstants[heroId];
    if (slotEl && heroInfo) {
        const heroNameForImg = heroInfo.name.replace('npc_dota_hero_', '');
        const imgSrc = `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${heroNameForImg}.png`;

        const isMain = team === 'ally' && index === 0;
        const labelHtml = isMain ? '<div class="sim-slot-label">VOCÊ</div>' : '';

        slotEl.innerHTML = `
            ${labelHtml}
            <img src="${imgSrc}" class="sim-slot-img" onerror="this.style.display='none'">
            <span class="sim-slot-name">${heroInfo.localized_name}</span>
            <button class="sim-slot-remove" onclick="event.stopPropagation(); removerHeroi('${team}', ${index})">✕</button>
        `;
        slotEl.classList.add('sim-slot-filled');
    }

    // Fecha o picker
    const picker = document.getElementById('sim-hero-picker');
    if (picker) picker.classList.add('hidden');
    simPickerTarget = null;

    atualizarBotaoGerar();
}

/**
 * Remove um herói de um slot.
 */
function removerHeroi(team, index) {
    simSelectedHeroes[team][index] = null;

    const slotEl = document.getElementById(`sim-${team}-${index}`);
    if (slotEl) {
        const isMain = team === 'ally' && index === 0;
        if (isMain) {
            slotEl.innerHTML = '<div class="sim-slot-label">VOCÊ</div><div class="sim-slot-placeholder">+ Herói</div>';
            slotEl.className = 'sim-slot sim-slot-main';
        } else if (team === 'ally') {
            slotEl.innerHTML = '<div class="sim-slot-placeholder">+ Aliado</div>';
            slotEl.className = 'sim-slot';
        } else {
            slotEl.innerHTML = '<div class="sim-slot-placeholder">+ Inimigo</div>';
            slotEl.className = 'sim-slot sim-slot-enemy';
        }
    }

    atualizarBotaoGerar();
}

/**
 * Atualiza o estado do botão de gerar recomendação.
 * Precisa de pelo menos: seu herói + 1 inimigo.
 */
function atualizarBotaoGerar() {
    const btn = document.getElementById('sim-generate-btn');
    if (!btn) return;

    const temSeuHeroi = simSelectedHeroes.ally[0] !== null;
    const temInimigo = simSelectedHeroes.enemy.some(id => id !== null);

    btn.disabled = !(temSeuHeroi && temInimigo);
}

/**
 * Troca a visualizacao para mostrar recomendacoes de um heroi especifico.
 * Funciona para aliados E inimigos. Destaca o slot e re-gera a recomendacao.
 */
function trocarVisualizacao(team, index) {
    // So troca se ja gerou recomendacao (tem resultado visivel)
    const resultEl = document.getElementById('sim-result');
    if (!resultEl || resultEl.classList.contains('hidden')) {
        // Se nao gerou ainda, abre o picker normalmente
        simPickerTarget = { team, index };
        const picker = document.getElementById('sim-hero-picker');
        const searchInput = document.getElementById('sim-hero-search');
        const grid = document.getElementById('sim-hero-grid');
        if (!picker || !grid || !simHeroConstants) return;
        picker.classList.remove('hidden');
        searchInput.value = '';
        searchInput.focus();
        const jaEscolhidos = new Set();
        simSelectedHeroes.ally.forEach(id => { if (id) jaEscolhidos.add(id); });
        simSelectedHeroes.enemy.forEach(id => { if (id) jaEscolhidos.add(id); });
        renderizarGridHerois(grid, '', jaEscolhidos);
        searchInput.oninput = () => {
            renderizarGridHerois(grid, searchInput.value.toLowerCase(), jaEscolhidos);
        };
        return;
    }

    simVisualizandoIndex = index;
    simVisualizandoTeam = team;

    // Atualiza destaque visual — remove de TODOS os slots, destaca o selecionado
    for (let i = 0; i < 5; i++) {
        const allySlot = document.getElementById(`sim-ally-${i}`);
        if (allySlot) allySlot.classList.toggle('sim-slot-viewing', team === 'ally' && i === index);
        const enemySlot = document.getElementById(`sim-enemy-${i}`);
        if (enemySlot) enemySlot.classList.toggle('sim-slot-viewing', team === 'enemy' && i === index);
    }

    // Re-gera a recomendacao para o heroi selecionado
    gerarRecomendacaoSimulador();
}

/**
 * Gera a recomendação inteligente de itens baseada nos heróis selecionados.
 * Este é o MOTOR PRINCIPAL do simulador.
 */
async function gerarRecomendacaoSimulador() {
    const resultEl = document.getElementById('sim-result');
    const btn = document.getElementById('sim-generate-btn');
    if (!resultEl) return;

    // Qual heroi estamos visualizando
    const viewIndex = simVisualizandoIndex || 0;
    const viewTeam = simVisualizandoTeam || 'ally';
    const meuHeroId = simSelectedHeroes[viewTeam][viewIndex];
    if (!meuHeroId) return;

    // Determina quem sao "aliados" e "inimigos" do ponto de vista do heroi visualizado
    // Se vendo um inimigo: os aliados DELE sao os nossos inimigos, e vice-versa
    const isEnemy = viewTeam === 'enemy';
    const teamDoHeroi = isEnemy ? 'enemy' : 'ally';
    const teamContra = isEnemy ? 'ally' : 'enemy';

    // Mostra loading
    btn.disabled = true;
    btn.textContent = 'ANALISANDO...';
    resultEl.classList.remove('hidden');
    resultEl.innerHTML = '<p style="color:#8892a4;text-align:center;padding:20px">Analisando heróis e buscando dados do meta atual...</p>';

    try {
        // Busca dados em paralelo
        const meuHero = simHeroConstants[meuHeroId];
        const enemyIds = simSelectedHeroes[teamContra].filter(id => id !== null);
        // Aliados = todos do mesmo time menos o heroi visualizado
        const allyIds = simSelectedHeroes[teamDoHeroi].filter((id, i) => id !== null && i !== viewIndex);

        // 1. Buscar itens populares do heroi visualizado + de TODOS os aliados dele (em paralelo)
        const allAllyIds = [meuHeroId, ...allyIds];
        const allItemPopPromises = allAllyIds.map(id => fetchHeroItemPopularity(id));
        const allItemPopResults = await Promise.all(allItemPopPromises);

        // Monta mapa: heroId → itemPopularity
        const itemPopMap = {};
        allAllyIds.forEach((id, idx) => {
            itemPopMap[id] = allItemPopResults[idx];
        });
        const itemPop = itemPopMap[meuHeroId];

        // 2. Matchups do heroi contra cada inimigo
        let matchups = null;
        try {
            const matchupData = await apiFetch(
                `https://api.opendota.com/api/heroes/${meuHeroId}/matchups`
            );
            matchups = {};
            if (matchupData) {
                matchupData.forEach(m => { matchups[m.hero_id] = m; });
            }
        } catch (e) {
            console.warn('Matchups não disponíveis:', e);
        }

        // 3. Analisar composição do time adversario
        const analiseInimiga = analisarComposicaoInimiga(enemyIds);

        // 4. Analisar composição do time do heroi
        const analiseAliada = analisarComposicaoAliada(allyIds, meuHeroId);

        // 5. Detectar itens compartilhados entre o time do heroi
        const itensCompartilhados = detectarItensCompartilhados(meuHeroId, allyIds, itemPopMap, enemyIds);

        // 6. Montar recomendação final
        const recomendacao = montarRecomendacao(
            meuHero, itemPop, analiseInimiga, analiseAliada, matchups, enemyIds
        );
        recomendacao.itensCompartilhados = itensCompartilhados;

        // 7. Renderizar resultado
        renderizarResultadoSimulador(
            resultEl, meuHero, recomendacao, analiseInimiga, matchups, enemyIds
        );

        // 8. Mostra seção de alertas de itens inimigos (após DOM atualizar)
        setTimeout(() => {
            if (typeof mostrarAlertas === 'function') {
                mostrarAlertas();
            }
        }, 100);

    } catch (e) {
        console.error('Erro no simulador:', e);
        resultEl.innerHTML = '<p style="color:#ff4757;text-align:center;padding:20px">Erro ao gerar recomendação. Tente novamente.</p>';
    } finally {
        btn.disabled = false;
        btn.textContent = 'GERAR RECOMENDAÇÃO DE ITENS';
    }
}

/**
 * Analisa a composição do time inimigo e identifica ameaças.
 * Retorna tags de ameaças e itens sugeridos para counter.
 */
function analisarComposicaoInimiga(enemyIds) {
    const ameacas = [];
    const counterItemsSugeridos = []; // { itemName, reason, priority }

    enemyIds.forEach(enemyId => {
        const hero = simHeroConstants[enemyId];
        if (!hero) return;

        const heroName = hero.localized_name;
        const roles = hero.roles || [];

        // Verifica cada categoria de counter
        for (const [key, counter] of Object.entries(COUNTER_ITEMS)) {
            let match = false;

            // Verifica por nome do herói
            if (counter.heroNames && counter.heroNames.includes(heroName)) {
                match = true;
            }

            // Verifica por tag/role
            if (counter.tags && counter.tags.some(tag => roles.includes(tag))) {
                match = true;
            }

            if (match) {
                ameacas.push({ heroName, tipo: key, reason: counter.reason });

                counter.items.forEach(itemName => {
                    const existing = counterItemsSugeridos.find(c => c.itemName === itemName);
                    if (existing) {
                        existing.priority++;
                        if (!existing.reasons.includes(counter.reason)) {
                            existing.reasons.push(counter.reason);
                        }
                        if (!existing.contraHerois.includes(heroName)) {
                            existing.contraHerois.push(heroName);
                        }
                    } else {
                        counterItemsSugeridos.push({
                            itemName,
                            priority: 1,
                            reasons: [counter.reason],
                            contraHerois: [heroName]
                        });
                    }
                });
            }
        }
    });

    // Ordena por prioridade (mais counters = mais importante)
    counterItemsSugeridos.sort((a, b) => b.priority - a.priority);

    return { ameacas, counterItems: counterItemsSugeridos };
}

/**
 * Analisa a composição aliada para evitar itens duplicados.
 */
function analisarComposicaoAliada(allyIds, meuHeroId) {
    const aliadoRoles = [];

    allyIds.forEach(allyId => {
        const hero = simHeroConstants[allyId];
        if (hero) {
            aliadoRoles.push({
                name: hero.localized_name,
                roles: hero.roles || [],
                attr: hero.primary_attr
            });
        }
    });

    // Verifica se já tem suporte no time
    const temSupporte = aliadoRoles.some(a => a.roles.includes('Support'));
    // Verifica se já tem tanque
    const temTanque = aliadoRoles.some(a => a.roles.includes('Durable'));

    return { aliadoRoles, temSupporte, temTanque };
}

/**
 * Mapa de custo estimado dos itens para classificar em qual fase comprá-los.
 * Itens que não estão aqui são classificados por lógica de fallback.
 */
const ITEM_PHASE_MAP = {
    // Itens iniciais / consumíveis
    tango: 'start', flask: 'start', clarity: 'start', enchanted_mango: 'start',
    ward_observer: 'start', ward_sentry: 'start', branches: 'start',
    faerie_fire: 'start', blood_grenade: 'start', dust: 'early',
    quelling_blade: 'start', stout_shield: 'start', orb_of_venom: 'start',
    blight_stone: 'start', circlet: 'start', slippers: 'start',
    mantle: 'start', gauntlets: 'start', magic_stick: 'start',
    ring_of_protection: 'start', boots: 'start',
    // Early game (até ~15 min, itens até ~2500 gold)
    magic_wand: 'early', phase_boots: 'early', power_treads: 'early',
    arcane_boots: 'early', tranquil_boots: 'early', wraith_band: 'early',
    null_talisman: 'early', bracer: 'early', soul_ring: 'early',
    bottle: 'early', urn_of_shadows: 'early', medallion_of_courage: 'early',
    ring_of_basilius: 'early', vladmir: 'early', buckler: 'early',
    headdress: 'early', helm_of_iron_will: 'early', javelin: 'early',
    cloak: 'early', hood_of_defiance: 'early', vanguard: 'early',
    hand_of_midas: 'early', mask_of_madness: 'early', falcon_blade: 'early',
    dragon_lance: 'early', echo_sabre: 'early', oblivion_staff: 'early',
    force_staff: 'early', glimmer_cape: 'early', ghost: 'early',
    pavise: 'early', fluffy_hat: 'early',
    essence_distiller: 'early',
    specialists_array: 'mid', crellas_crozier: 'late', hydras_breath: 'late',
    consecrated_wraps: 'mid',
    phylactery: 'early', witch_blade: 'early',
    // Mid game (15-30 min, itens ~2500-4500 gold)
    blink: 'mid', mekansm: 'mid', pipe: 'mid', crimson_guard: 'mid',
    solar_crest: 'mid', spirit_vessel: 'mid', orchid: 'mid', diffusal_blade: 'mid',
    maelstrom: 'mid', desolator: 'mid', basher: 'mid', yasha: 'mid',
    sange: 'mid', kaya: 'mid', sange_and_yasha: 'mid', yasha_and_kaya: 'mid',
    kaya_and_sange: 'mid', manta: 'mid', battle_fury: 'mid',
    black_king_bar: 'mid', lotus_orb: 'mid', aeon_disk: 'mid',
    aghanims_shard: 'mid', rod_of_atos: 'mid', meteor_hammer: 'mid',
    heavens_halberd: 'mid', ethereal_blade: 'mid', dagon: 'mid',
    blade_mail: 'mid', aether_lens: 'mid', veil_of_discord: 'mid',
    helm_of_the_overlord: 'mid', armlet: 'mid', shadow_blade: 'mid',
    invis_sword: 'mid', hurricane_pike: 'mid', linken_sphere: 'mid',
    harpoon: 'mid', disperser: 'mid',
    // Late game (30+ min, itens 4500+ gold)
    butterfly: 'late', heart: 'late', satanic: 'late', skadi: 'late',
    assault: 'late', shivas_guard: 'late', mjollnir: 'late',
    monkey_king_bar: 'late', daedalus: 'late', rapier: 'late',
    abyssal_blade: 'late', bloodthorn: 'late', nullifier: 'late',
    refresher: 'late', octarine_core: 'late', radiance: 'mid',
    silver_edge: 'late', overwhelming_blink: 'late', swift_blink: 'late',
    arcane_blink: 'late', travel_boots: 'late', travel_boots_2: 'late',
    ultimate_scepter: 'mid', gem: 'mid', moon_shard: 'late',
    guardian_greaves: 'late', wind_waker: 'late', sheepstick: 'late',
    greater_crit: 'late', sphere: 'late', boots_of_bearing: 'late',
    wraith_pact: 'late', revenant_brooch: 'late', khanda: 'late'
};

/**
 * Determina em qual fase do jogo um item deve ser comprado.
 * Usa o mapa ITEM_PHASE_MAP ou classifica pelo custo do item.
 */
function classificarFaseItem(itemName) {
    // Verifica no mapa manual primeiro
    if (ITEM_PHASE_MAP[itemName]) return ITEM_PHASE_MAP[itemName];

    // Fallback: tenta classificar pelo custo
    const itemInfo = simItemConstants ? simItemConstants[itemName] : null;
    if (itemInfo && itemInfo.cost) {
        if (itemInfo.cost <= 500) return 'start';
        if (itemInfo.cost <= 2500) return 'early';
        if (itemInfo.cost <= 4500) return 'mid';
        return 'late';
    }

    return 'mid'; // default
}

/**
 * Retorna o label amigável para cada fase.
 * Timings ajustados para Turbo (gold e XP 2x, jogos mais curtos).
 */
function getLabelFase(fase) {
    const labels = {
        start: 'ITENS INICIAIS',
        early: 'EARLY GAME (0-10 min)',
        mid: 'MID GAME (10-20 min)',
        late: 'LATE GAME (20+ min)'
    };
    return labels[fase] || fase;
}

/**
 * ITENS NEUTROS — recomendacoes por tier e tipo de heroi.
 * Cada tier tem timing normal e turbo, e itens recomendados por papel.
 * Os itens neutros sao dropados de creeps neutros e so 1 de cada por time.
 */
/**
 * NEUTROS_POR_TIER — Patch 7.41 (sistema de artefatos + encantamentos)
 * Tier 1: inicio | Tier 2: ~10 min | Tier 3: ~18 min | Tier 4: ~25 min | Tier 5: ~40 min
 * O time escolhe 1 artefato das opcoes que aparecem (dropado de creeps neutros).
 * Recomendamos os melhores por tipo de heroi.
 */
const NEUTROS_POR_TIER = {
    1: {
        tier: 1,
        timing: 'inicio',
        turboTiming: 'inicio do jogo',
        fase: 'early',
        itens: {
            core_melee: [
                { nome: 'Duelist Gloves', desc: 'Passivo: +20 Attack Speed quando ha herois inimigos em 1200 unidades', img: 'duelist_gloves' },
                { nome: 'Forager\'s Kit', desc: 'Ativo: Coleta arvores em troca de consumiveis — bônus de stat, mana ou dano', img: 'foragers_kit' }
            ],
            core_ranged: [
                { nome: 'Weighted Dice', desc: 'Passivo: Base damage e bounty calculados 2x, pega o maior valor', img: 'weighted_dice' },
                { nome: 'Stonefeather Satchel', desc: 'Toggle: +20% move speed OU +10 armor — troca entre mobilidade e resistencia', img: 'stonefeather_satchel' }
            ],
            support: [
                { nome: 'Kobold Cup', desc: 'Ativo: +10% move speed para aliados em 1000 de raio por 6s', img: 'kobold_cup' },
                { nome: 'Occult Bracelet', desc: 'Passivo: Cada ataque recebido da +0.4 mana regen, ate 5 stacks (5s)', img: 'occult_bracelet' }
            ],
            tank: [
                { nome: 'Ash Legion Shield', desc: 'Ativo: Barreira de 140 dano fisico para aliados em 800 unidades por 6s', img: 'ash_legion_shield' },
                { nome: 'Chipped Vest', desc: 'Passivo: Retorna 30 dano a herois e 20 a creeps quando atacado', img: 'chipped_vest' }
            ]
        }
    },
    2: {
        tier: 2,
        timing: '15 min',
        turboTiming: '~10 min',
        fase: 'early',
        itens: {
            core_melee: [
                { nome: 'Defiant Shell', desc: 'Passivo: Contra-ataca ao ser atacado com 80% do dano normal', img: 'defiant_shell' },
                { nome: 'Crippling Crossbow', desc: 'Ativo: 75 dano + 80% slow + -40% cura no alvo por 4s', img: 'crippling_crossbow' }
            ],
            core_ranged: [
                { nome: "Tumbler's Toy", desc: 'Ativo: Pula 300 unidades para frente. Desativa por 3s se levar dano', img: 'pogo_stick' },
                { nome: "Poor Man's Shield", desc: 'Passivo: 100% chance de bloquear 30/20 dano de herois; 50% de creeps', img: 'poor_mans_shield' }
            ],
            support: [
                { nome: 'Essence Ring', desc: 'Ativo: +240 HP atual e maximo por 10s', img: 'essence_ring' },
                { nome: 'Mana Draught', desc: 'Ativo: Restaura 70 + 3% mana max em 6s. Passivo: -30% CD na agua', img: 'mana_draught' }
            ],
            tank: [
                { nome: 'Defiant Shell', desc: 'Passivo: Contra-ataca ao ser atacado com 80% do dano normal', img: 'defiant_shell' },
                { nome: "Poor Man's Shield", desc: 'Passivo: 100% chance de bloquear 30/20 dano de herois; 50% de creeps', img: 'poor_mans_shield' }
            ]
        }
    },
    3: {
        tier: 3,
        timing: '27 min',
        turboTiming: '~18 min',
        fase: 'mid',
        itens: {
            core_melee: [
                { nome: 'Serrated Shiv', desc: 'Passivo: 20% chance de True Strike + 8% HP atual do alvo como dano fisico', img: 'serrated_shiv' },
                { nome: 'Gunpowder Gauntlets', desc: 'Passivo: Proximo ataque +120 dano magico e splash 50% em 250 unidades', img: 'gunpowder_gauntlets' }
            ],
            core_ranged: [
                { nome: 'Psychic Headband', desc: 'Ativo: Empurra alvo 400 unidades para longe', img: 'psychic_headband' },
                { nome: 'Spellslinger', desc: 'Passivo: 20% da mana gasta em habilidades e recuperada ao longo de 10s', img: 'spellslinger' }
            ],
            support: [
                { nome: 'Partisan\'s Brand', desc: 'Passivo: +9% de dano magico causado a unidades controladas por jogadores', img: 'partisans_brand' },
                { nome: 'Jidi Pollen Bag', desc: 'Ativo: -30% cura e 9% do HP max como dano em 9s (raio 700)', img: 'jidi_pollen_bag' }
            ],
            tank: [
                { nome: 'Unrelenting Eye', desc: 'Passivo: +50% slow resistance, -10% por heroi inimigo no raio de ataque', img: 'unrelenting_eye' },
                { nome: 'Gunpowder Gauntlets', desc: 'Passivo: Proximo ataque +120 dano magico e splash 50% em 250 unidades', img: 'gunpowder_gauntlets' }
            ]
        }
    },
    4: {
        tier: 4,
        timing: '37 min',
        turboTiming: '~25 min',
        fase: 'late',
        itens: {
            core_melee: [
                { nome: "Flayer's Bota", desc: 'Ativo: +15% base damage e +30 AS por 6s. Passivo: Heroi morrendo perto reseta o CD', img: 'flayers_bota' },
                { nome: "Prophet's Pendulum", desc: 'Passivo: 30% do dano recebido e distribuido ao longo de 5s (letal)', img: 'prophets_pendulum' }
            ],
            core_ranged: [
                { nome: "Flayer's Bota", desc: 'Ativo: +15% base damage e +30 AS por 6s. Passivo: Kill/assist reseta CD', img: 'flayers_bota' },
                { nome: 'Metamorphic Mandible', desc: 'Ativo: Forma inseto 4s: +35% magic res, +15% MS, -45% armor', img: 'metamorphic_mandible' }
            ],
            support: [
                { nome: 'Rattlecage', desc: 'Passivo: Apos 180 dano, dispara em 2 inimigos: 110 dano + slow', img: 'rattlecage' },
                { nome: "Idol of Scree'Auk", desc: 'Ativo: +50% slow res, phased, +25% evasion por 5s', img: 'idol_of_screeauk' }
            ],
            tank: [
                { nome: "Giant's Maul", desc: 'Passivo: Proximo ataque critico 140% + reduz MS/AS/cast speed do alvo por 3s', img: 'giant_maul' },
                { nome: 'Rattlecage', desc: 'Passivo: Apos 180 dano, dispara em 2 inimigos: 110 dano + slow', img: 'rattlecage' }
            ]
        }
    },
    5: {
        tier: 5,
        timing: '60 min',
        turboTiming: '~40 min',
        fase: 'late',
        itens: {
            core_melee: [
                { nome: 'Stygian Desolator', desc: 'Passivo: Ataques reduzem armor do alvo em -13 por 7s', img: 'desolator_2' },
                { nome: 'Fallen Sky', desc: 'Ativo: Vira meteoro, stun 1.6s + 150 dano impacto + 60 DPS por 6s', img: 'fallen_sky' }
            ],
            core_ranged: [
                { nome: 'Book of the Dead', desc: 'Ativo: Invoca 2 warriors + 2 archers por 65s', img: 'demonicon' },
                { nome: 'Stygian Desolator', desc: 'Passivo: Ataques reduzem armor do alvo em -13 por 7s', img: 'desolator_2' }
            ],
            support: [
                { nome: 'Divine Regalia', desc: 'Passivo: +20% outgoing damage. Morrer desativa o item permanentemente', img: 'divine_regalia' },
                { nome: 'Spider Legs', desc: 'Ativo: +20% MS, +50% turn rate, free pathing por 10s', img: 'spider_legs' }
            ],
            tank: [
                { nome: 'Minotaur Horn', desc: 'Ativo: Dispel + 50% magic resist + imunidade a dano puro por 2s', img: 'minotaur_horn' },
                { nome: 'Fallen Sky', desc: 'Ativo: Vira meteoro, stun 1.6s + 150 dano impacto + 60 DPS por 6s', img: 'fallen_sky' }
            ]
        }
    }
};

/**
 * Determina qual categoria de neutro usar baseado no heroi.
 * Retorna: 'core_melee', 'core_ranged', 'support', ou 'tank'
 */
function categoriaNeutroHeroi(heroId) {
    const hero = simHeroConstants[heroId];
    if (!hero) return 'core_melee';

    const roles = hero.roles || [];
    const heroInfo = determinarPapelHeroi(heroId);

    if (heroInfo.papeis.includes('support')) return 'support';
    if (heroInfo.papeis.includes('tank') || heroInfo.papeis.includes('offlaner')) {
        if (roles.includes('Carry')) return 'core_melee'; // carry tanque (Spectre, WK)
        return 'tank';
    }
    if (hero.attack_type === 'Ranged') return 'core_ranged';
    return 'core_melee';
}

/**
 * Retorna dica de quando fazer o item baseado na fase.
 * Timings ajustados para Turbo.
 */
function getDicaTiming(fase) {
    const dicas = {
        start: 'Compre na base antes de sair',
        early: 'Faca nos primeiros 10 min (Turbo)',
        mid: 'Priorize entre 10-20 min (Turbo)',
        late: 'Objetivo final — 20+ min (Turbo)'
    };
    return dicas[fase] || '';
}

/**
 * ITENS DE DECISÃO DE TIME — itens que NÃO devem ser duplicados.
 * São itens de aura, utilidade ou efeito único cujo impacto não stacka.
 * O time precisa decidir quem faz cada um.
 *
 * quemFazMelhor: roles que idealmente fazem este item
 *   'support'  = pos 4/5 (suportes)
 *   'offlaner' = pos 3 (tanque/iniciador)
 *   'core'     = pos 1/2 (carry/mid)
 *   'roamer'   = quem se movimenta pelo mapa
 *   'tank'     = o herói mais durável do time
 *   'ranged'   = herói ranged (para itens como Vladmir)
 *
 * contraOQue: quando este item é especialmente importante
 *   (referencia tags do COUNTER_ITEMS e roles dos inimigos)
 */
const ITENS_DECISAO_TIME = {
    // --- MID GAME (itens de decisão que surgem primeiro) ---
    vladmir: {
        nome: "Vladmir's Offering",
        fase: 'mid',
        motivo: 'Auras de lifesteal, armor e dano nao stackam entre si',
        quemFazMelhor: ['support', 'offlaner'],
        contraOQue: ['phys_damage'],
        impacto: 'medio'
    },
    pipe: {
        nome: 'Pipe of Insight',
        fase: 'mid',
        motivo: 'Barreira magica nao stacka — protege o time inteiro contra nukers',
        quemFazMelhor: ['offlaner', 'support'],
        contraOQue: ['magic_damage', 'Nuker'],
        impacto: 'alto'
    },
    crimson_guard: {
        nome: 'Crimson Guard',
        fase: 'mid',
        motivo: 'Barreira fisica nao stacka — essencial contra dano fisico em area',
        quemFazMelhor: ['offlaner', 'support'],
        contraOQue: ['phys_damage', 'summons', 'Carry'],
        impacto: 'alto'
    },
    spirit_vessel: {
        nome: 'Spirit Vessel',
        fase: 'mid',
        motivo: '1 por time e suficiente — reduz cura dos inimigos',
        quemFazMelhor: ['support', 'roamer'],
        contraOQue: ['heal'],
        impacto: 'medio'
    },
    solar_crest: {
        nome: 'Solar Crest',
        fase: 'mid',
        motivo: 'O debuff de armor nao stacka — 1 por time',
        quemFazMelhor: ['support', 'offlaner'],
        contraOQue: ['tank', 'Durable'],
        impacto: 'medio'
    },
    mekansm: {
        nome: 'Mekansm',
        fase: 'mid',
        motivo: 'Cura ativa tem cooldown compartilhado — 1 Mek por time',
        quemFazMelhor: ['support', 'offlaner'],
        contraOQue: [],
        impacto: 'medio'
    },
    lotus_orb: {
        nome: 'Lotus Orb',
        fase: 'mid',
        motivo: 'Dispel + reflect — 1 por time, no heroi que fica perto dos cores',
        quemFazMelhor: ['offlaner', 'support'],
        contraOQue: ['disable', 'Disabler'],
        impacto: 'alto'
    },
    helm_of_the_overlord: {
        nome: 'Helm of the Overlord',
        fase: 'mid',
        motivo: 'Aura nao stacka — 1 por time',
        quemFazMelhor: ['offlaner', 'core'],
        contraOQue: [],
        impacto: 'medio'
    },
    radiance: {
        nome: 'Radiance',
        fase: 'mid',
        motivo: 'Burn aura nao stacka — item caro, 1 por time no heroi que fica vivo nas lutas',
        quemFazMelhor: ['core', 'offlaner'],
        contraOQue: ['summons', 'heal'],
        impacto: 'alto'
    },
    // --- LATE GAME (itens de maior impacto) ---
    assault: {
        nome: 'Assault Cuirass',
        fase: 'late',
        motivo: 'Aura de armor e attack speed nao stacka — decisao de alto impacto',
        quemFazMelhor: ['offlaner', 'core'],
        contraOQue: ['phys_damage', 'Carry'],
        impacto: 'alto'
    },
    shivas_guard: {
        nome: "Shiva's Guard",
        fase: 'late',
        motivo: 'Aura de slow de ataque nao stacka — poderoso contra carries fisicos',
        quemFazMelhor: ['offlaner', 'tank'],
        contraOQue: ['phys_damage', 'Carry'],
        impacto: 'alto'
    },
    guardian_greaves: {
        nome: 'Guardian Greaves',
        fase: 'late',
        motivo: 'Upgrade do Mek+Arcane — 1 por time, no heroi que inicia as lutas',
        quemFazMelhor: ['support', 'offlaner'],
        contraOQue: [],
        impacto: 'alto'
    },
    wraith_pact: {
        nome: 'Wraith Pact',
        fase: 'late',
        motivo: 'Aura de reducao de dano nao stacka — muda teamfights',
        quemFazMelhor: ['offlaner', 'support'],
        contraOQue: ['phys_damage'],
        impacto: 'alto'
    },
    boots_of_bearing: {
        nome: 'Boots of Bearing',
        fase: 'late',
        motivo: 'Aura de velocidade nao stacka — 1 por time',
        quemFazMelhor: ['support', 'offlaner'],
        contraOQue: [],
        impacto: 'medio'
    },
    gem: {
        nome: 'Gem of True Sight',
        fase: 'mid',
        motivo: 'Dropa ao morrer — deve ficar no heroi mais seguro do time',
        quemFazMelhor: ['tank', 'offlaner'],
        contraOQue: ['invis'],
        impacto: 'alto'
    },
    heavens_halberd: {
        nome: "Heaven's Halberd",
        fase: 'late',
        motivo: 'Desarme nao stacka — 1 por time contra o carry inimigo principal',
        quemFazMelhor: ['offlaner', 'support'],
        contraOQue: ['phys_damage', 'Carry'],
        impacto: 'alto'
    },
    nullifier: {
        nome: 'Nullifier',
        fase: 'late',
        motivo: 'Dispel continuo — 1 por time, no heroi que foca o alvo principal',
        quemFazMelhor: ['core'],
        contraOQue: ['heal', 'disable'],
        impacto: 'alto'
    },
    sheepstick: {
        nome: 'Scythe of Vyse',
        fase: 'late',
        motivo: 'Hex poderoso mas caro — 1 por time geralmente e suficiente',
        quemFazMelhor: ['support', 'core'],
        contraOQue: ['gap_close', 'Carry'],
        impacto: 'alto'
    },

    crellas_crozier: {
        nome: "Crella's Crozier",
        fase: 'late',
        motivo: 'Aura passiva de -30% cura inimiga nao stacka com Spirit Vessel — 1 por time',
        quemFazMelhor: ['support', 'offlaner'],
        contraOQue: ['heal'],
        impacto: 'alto'
    },

    // === ITENS DISPUTAVEIS (realmente geram conflito no time) ===
    // Apenas itens onde duplicar é desperdicio real de gold.
    // NÃO inclui: BKB, Butterfly, MKB, Daedalus, Heart, Satanic
    // — esses são itens pessoais que multiplos herois DEVEM fazer.

    skadi: {
        nome: 'Eye of Skadi',
        fase: 'late',
        motivo: 'O slow do Skadi nao stacka entre herois — 2 Skadis no time e redundante. Quem bate em area aproveita mais',
        quemFazMelhor: ['core'],
        contraOQue: ['heal', 'tank'],
        impacto: 'alto',
        tipo: 'disputavel',
        criterioDesempate: 'Priorize no heroi que bate em multiplos alvos (Medusa, Gyro, Luna)'
    }
};

/**
 * Extrai itens populares de um herói em TODAS as fases, com porcentagem.
 * Retorna: { itemKey: { pct, fase, count } }
 */
function extrairTodosItensHeroi(heroPopData) {
    if (!heroPopData || !simItemConstants) return {};

    const resultado = {};
    const fasesApi = {
        start_game_items: 'start',
        early_game_items: 'early',
        mid_game_items: 'mid',
        late_game_items: 'late'
    };

    for (const [apiKey, fase] of Object.entries(fasesApi)) {
        if (!heroPopData[apiKey]) continue;

        let total = 0;
        for (const [, count] of Object.entries(heroPopData[apiKey])) total += count;
        if (total === 0) continue;

        for (const [itemId, count] of Object.entries(heroPopData[apiKey])) {
            const id = parseInt(itemId);
            const itemKey = Object.keys(simItemConstants).find(k => simItemConstants[k].id === id);

            if (!itemKey || itemKey.startsWith('recipe_')) continue;

            const pct = (count / total) * 100;
            // Se aparece em mais de uma fase, guarda a de maior %
            if (!resultado[itemKey] || pct > resultado[itemKey].pct) {
                resultado[itemKey] = { pct, fase, count };
            }
        }
    }

    return resultado;
}

/**
 * Determina o papel de um herói no time.
 * PRIORIZA a posição definida pelo jogador (simPositions).
 * Se nao tem posição definida, tenta adivinhar pelas roles do heroi.
 */
function determinarPapelHeroi(heroId) {
    const hero = simHeroConstants[heroId];
    if (!hero) return { papeis: [], posicao: null, goldPrioridade: 3 };

    // Verifica se o jogador definiu a posição deste heroi
    const todosAllyIds = simSelectedHeroes.ally;
    const indexNoTime = todosAllyIds.indexOf(heroId);
    const posicaoDefinida = indexNoTime >= 0 ? simPositions[indexNoTime] : null;

    // Se tem posição definida pelo jogador, usa ela
    if (posicaoDefinida) {
        const posData = POS_DATA[posicaoDefinida.toString()];
        const papeis = [];

        if (posicaoDefinida <= 2) papeis.push('core');
        if (posicaoDefinida === 3) papeis.push('offlaner', 'tank');
        if (posicaoDefinida >= 4) papeis.push('support');
        if (hero.roles && hero.roles.includes('Durable')) papeis.push('tank');
        if (hero.attack_type === 'Ranged') papeis.push('ranged');

        return {
            papeis,
            posicao: posicaoDefinida,
            goldPrioridade: posData.goldPrioridade,
            posNome: posData.nome,
            posCor: posData.cor
        };
    }

    // Fallback: adivinha pela role do heroi
    const roles = hero.roles || [];
    const papeis = [];
    let goldPrioridade = 3; // default: medio

    if (roles.includes('Carry')) {
        papeis.push('core');
        goldPrioridade = 5;
    }
    if (roles.includes('Support')) {
        papeis.push('support');
        goldPrioridade = Math.min(goldPrioridade, 2);
    }
    if (roles.includes('Durable') || roles.includes('Initiator')) {
        papeis.push('offlaner', 'tank');
        if (!roles.includes('Carry')) goldPrioridade = 3;
    }
    if (roles.includes('Nuker') && !roles.includes('Support')) {
        papeis.push('core');
        goldPrioridade = Math.max(goldPrioridade, 4);
    }
    if (roles.includes('Escape') || roles.includes('Jungler')) papeis.push('roamer');
    if (hero.attack_type === 'Ranged') papeis.push('ranged');
    if (papeis.length === 0) { papeis.push('core'); goldPrioridade = 3; }

    return { papeis, posicao: null, goldPrioridade, posNome: null, posCor: null };
}

/**
 * Calcula a pontuação de "quem deve fazer" um item de decisão de time.
 * Considera:
 *   1. % de uso no meta (dados reais)
 *   2. Posição no time (pos 3-5 fazem itens de utilidade, pos 1-2 focam em dano)
 *   3. Prioridade de farm (itens caros = quem tem mais gold)
 *   4. Relevancia contra os inimigos desta partida
 *
 * Quanto MAIOR a pontuação, mais este herói deve ser o responsável pelo item.
 */
function calcularPontuacaoItem(heroId, itemKey, regra, pctUso, enemyIds) {
    let pontuacao = pctUso; // Base: porcentagem de uso no meta

    const heroInfo = determinarPapelHeroi(heroId);
    const quemFazMelhor = regra.quemFazMelhor || [];

    // === BONUS POR POSIÇÃO / PAPEL ===
    let matchPapel = false;
    for (const papel of quemFazMelhor) {
        if (heroInfo.papeis.includes(papel)) {
            const idx = quemFazMelhor.indexOf(papel);
            pontuacao += idx === 0 ? 30 : 18;
            matchPapel = true;
            break;
        }
    }
    if (!matchPapel && quemFazMelhor.length > 0) {
        pontuacao -= 15;
    }

    // === BONUS/PENALIDADE POR GOLD (itens caros vs baratos) ===
    // Itens de aura/utilidade geralmente devem ser feitos por quem tem MENOS farm
    // (porque cores precisam do gold para itens de dano)
    // Excecao: AC e Shiva's que cores tanques tambem fazem
    const itensDeUtilidade = ['pipe', 'crimson_guard', 'mekansm', 'guardian_greaves',
        'spirit_vessel', 'solar_crest', 'vladmir', 'lotus_orb', 'boots_of_bearing',
        'wraith_pact', 'gem'];
    const itensQueCoresFazem = ['assault', 'shivas_guard', 'radiance', 'heavens_halberd',
        'nullifier', 'sheepstick'];

    if (itensDeUtilidade.includes(itemKey)) {
        // Para itens de utilidade: pos 4-5 ganham bonus, pos 1-2 ganham penalidade
        // O suporte deve fazer Pipe/Mek, nao o carry
        if (heroInfo.goldPrioridade <= 2) {
            pontuacao += 20; // suportes ganham bonus grande
        } else if (heroInfo.goldPrioridade >= 4) {
            pontuacao -= 15; // carries perdem pontos (devem focar em dano)
        }
    } else if (itensQueCoresFazem.includes(itemKey)) {
        // Para itens que cores/offlaners fazem: pos 1-3 ganham bonus
        if (heroInfo.goldPrioridade >= 3) {
            pontuacao += 15; // cores/offlaners ganham bonus
        } else {
            pontuacao -= 10; // suportes dificilmente vao conseguir farmar isso
        }
    }

    // === BONUS POR RELEVANCIA CONTRA INIMIGOS ===
    if (regra.contraOQue && regra.contraOQue.length > 0 && enemyIds) {
        let relevancia = 0;
        enemyIds.forEach(enemyId => {
            const enemy = simHeroConstants[enemyId];
            if (!enemy) return;
            const enemyRoles = enemy.roles || [];
            const enemyName = enemy.localized_name;

            regra.contraOQue.forEach(contra => {
                if (enemyRoles.includes(contra)) relevancia += 5;
                const counterEntry = COUNTER_ITEMS[contra];
                if (counterEntry) {
                    if (counterEntry.tags && counterEntry.tags.some(t => enemyRoles.includes(t))) relevancia += 5;
                    if (counterEntry.heroNames && counterEntry.heroNames.includes(enemyName)) relevancia += 8;
                }
            });
        });
        pontuacao += relevancia;
    }

    return pontuacao;
}

/**
 * Detecta conflitos de itens de decisão de time.
 *
 * Analisa APENAS itens que NÃO devem ser duplicados (auras, utilidades).
 * Para cada conflito, calcula quem é o melhor candidato baseado em:
 *   1. % de uso no meta (dados reais da API)
 *   2. Papel do herói (suporte, offlaner, core)
 *   3. Relevância contra a composição inimiga
 *
 * Retorna: { decisoes: [...] }
 */
function detectarItensCompartilhados(meuHeroId, allyIds, itemPopMap, enemyIds) {
    const decisoes = [];

    if (allyIds.length === 0) return { decisoes };

    const meuHero = simHeroConstants[meuHeroId];
    if (!meuHero) return { decisoes };

    // Extrai itens de todos os heróis aliados (incluindo eu)
    const todosAllyIds = [meuHeroId, ...allyIds];
    const itensPorHeroi = {};
    todosAllyIds.forEach(id => {
        itensPorHeroi[id] = extrairTodosItensHeroi(itemPopMap[id]);
    });

    // Para cada item de decisão de time, verifica se 2+ aliados podem fazer
    for (const [itemKey, regra] of Object.entries(ITENS_DECISAO_TIME)) {
        const candidatos = [];
        const jaAdicionado = new Set();

        // Primeiro: adiciona herois com uso real na API (>0.1%)
        // Threshold baixo para capturar herois com uso raro mas real (ex: Spectre com Assault)
        todosAllyIds.forEach(heroId => {
            const itensDoHeroi = itensPorHeroi[heroId];
            if (!itensDoHeroi || !itensDoHeroi[itemKey]) return;
            if (itensDoHeroi[itemKey].pct < 0.1) return;

            const heroInfoData = determinarPapelHeroi(heroId);
            const pontuacao = calcularPontuacaoItem(
                heroId, itemKey, regra, itensDoHeroi[itemKey].pct, enemyIds
            );

            candidatos.push({
                heroId,
                heroNome: simHeroConstants[heroId].localized_name,
                pct: itensDoHeroi[itemKey].pct,
                pontuacao: pontuacao,
                ehVoce: heroId === meuHeroId,
                papeis: heroInfoData.papeis,
                posicao: heroInfoData.posicao,
                posNome: heroInfoData.posNome,
                posCor: heroInfoData.posCor,
                goldPrioridade: heroInfoData.goldPrioridade
            });
            jaAdicionado.add(heroId);
        });

        // Segundo: adiciona herois cuja ROLE bate com quemFazMelhor (mesmo sem dados API)
        // Isso garante que Primal Beast apareca como candidato para Assault/Pipe
        todosAllyIds.forEach(heroId => {
            if (jaAdicionado.has(heroId)) return;

            const heroInfoData = determinarPapelHeroi(heroId);
            const roleBate = regra.quemFazMelhor.some(papel => heroInfoData.papeis.includes(papel));
            if (!roleBate) return;

            const pontuacao = calcularPontuacaoItem(heroId, itemKey, regra, 0, enemyIds);

            candidatos.push({
                heroId,
                heroNome: simHeroConstants[heroId].localized_name,
                pct: 0,
                pontuacao: pontuacao,
                ehVoce: heroId === meuHeroId,
                papeis: heroInfoData.papeis,
                posicao: heroInfoData.posicao,
                posNome: heroInfoData.posNome,
                posCor: heroInfoData.posCor,
                goldPrioridade: heroInfoData.goldPrioridade
            });
        });

        // Mostra o item se 2+ herois do time podem fazer
        // TODOS os jogadores precisam saber dos conflitos de itens de time
        if (candidatos.length >= 2) {
            // Ordena por pontuação para exibição nas barras
            candidatos.sort((a, b) => b.pontuacao - a.pontuacao);
            // melhorCandidato: quem tem maior % de uso real na API (mais confiavel)
            // Se ninguem tem dados da API (pct=0), usa pontuação como fallback
            const candidatosComPct = candidatos.filter(c => c.pct > 0);
            const melhorCandidato = candidatosComPct.length > 0
                ? candidatosComPct.reduce((best, c) => c.pct > best.pct ? c : best)
                : candidatos[0];
            const euDevoFazer = melhorCandidato.heroId === meuHeroId;

            // Verifica se este item é ESPECIALMENTE necessário nesta partida
            let necessidadeNaPartida = '';
            if (regra.contraOQue && regra.contraOQue.length > 0 && enemyIds) {
                const ameacas = [];
                enemyIds.forEach(enemyId => {
                    const enemy = simHeroConstants[enemyId];
                    if (!enemy) return;
                    regra.contraOQue.forEach(contra => {
                        if (enemy.roles && enemy.roles.includes(contra)) {
                            ameacas.push(enemy.localized_name);
                        }
                        const ce = COUNTER_ITEMS[contra];
                        if (ce) {
                            if (ce.heroNames && ce.heroNames.includes(enemy.localized_name)) {
                                ameacas.push(enemy.localized_name);
                            }
                        }
                    });
                });
                const ameacasUnicas = [...new Set(ameacas)];
                if (ameacasUnicas.length > 0) {
                    necessidadeNaPartida = `Essencial contra: ${ameacasUnicas.join(', ')}`;
                }
            }

            decisoes.push({
                itemName: itemKey,
                displayName: regra.nome,
                img: `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${itemKey}.png`,
                fase: regra.fase,
                motivo: regra.motivo,
                impacto: regra.impacto,
                tipo: regra.tipo || 'aura',
                criterioDesempate: regra.criterioDesempate || null,
                candidatos: candidatos,
                melhorCandidato: melhorCandidato,
                euDevoFazer: euDevoFazer,
                necessidadeNaPartida: necessidadeNaPartida
            });
        }
    }

    // Ordena: alto impacto primeiro, depois médio
    const ordemImpacto = { alto: 0, medio: 1, baixo: 2 };
    decisoes.sort((a, b) => {
        const impDiff = ordemImpacto[a.impacto] - ordemImpacto[b.impacto];
        if (impDiff !== 0) return impDiff;
        // Se mesmo impacto, prioriza os que tem necessidade na partida
        if (a.necessidadeNaPartida && !b.necessidadeNaPartida) return -1;
        if (!a.necessidadeNaPartida && b.necessidadeNaPartida) return 1;
        return 0;
    });

    return { decisoes };
}

/**
 * Monta a recomendação final combinando todas as análises.
 * Agora organiza por fases: start → early → mid → late.
 */
function montarRecomendacao(meuHero, itemPop, analiseInimiga, analiseAliada, matchups, enemyIds) {
    const resultado = {
        fases: {
            start: [],   // Itens iniciais
            early: [],   // Early game
            mid: [],     // Mid game
            late: []     // Late game
        },
        counter: [],     // Itens de counter com fase indicada
        matchupInfo: []
    };

    // 1. ITENS POR FASE — dos mais populares do herói no meta
    // Rastreia itens ja adicionados para evitar duplicatas entre fases
    const itensJaAdicionados = new Set();

    if (itemPop) {
        const faseMap = {
            start_game_items: 'start',
            early_game_items: 'early',
            mid_game_items: 'mid',
            late_game_items: 'late'
        };

        for (const [apiKey, fase] of Object.entries(faseMap)) {
            if (itemPop[apiKey]) {
                // Filtra componentes nas fases mid e late (queremos itens completos)
                const filtrar = (fase === 'mid' || fase === 'late');
                const itens = converterItensPopularesSim(itemPop[apiKey], 8, filtrar, fase);
                itens.forEach(item => {
                    // Pula se este item ja apareceu em uma fase anterior
                    if (itensJaAdicionados.has(item.name)) return;
                    itensJaAdicionados.add(item.name);
                    item.fase = fase;
                    resultado.fases[fase].push(item);
                });
                // Garante no maximo 6 por fase
                if (resultado.fases[fase].length > 6) {
                    resultado.fases[fase] = resultado.fases[fase].slice(0, 6);
                }
            }
        }
    }

    // 2. ITENS DE COUNTER — com fase de quando comprar
    const todosOsCore = [
        ...resultado.fases.start,
        ...resultado.fases.early,
        ...resultado.fases.mid,
        ...resultado.fases.late
    ];

    analiseInimiga.counterItems.slice(0, 8).forEach(ci => {
        const itemInfo = simItemConstants[ci.itemName];
        if (!itemInfo) return;

        const fase = classificarFaseItem(ci.itemName);
        const jaNoCore = todosOsCore.some(c => c.name === ci.itemName);

        resultado.counter.push({
            name: ci.itemName,
            displayName: ci.itemName.replace(/_/g, ' '),
            img: `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${ci.itemName}.png`,
            reason: ci.reasons[0],
            contraHerois: ci.contraHerois,
            priority: ci.priority,
            jaNoCore: jaNoCore,
            fase: fase,
            timing: getDicaTiming(fase)
        });
    });

    // Ordena counters por fase (start → early → mid → late) e depois prioridade
    const ordemFase = { start: 0, early: 1, mid: 2, late: 3 };
    resultado.counter.sort((a, b) => {
        const fDiff = ordemFase[a.fase] - ordemFase[b.fase];
        return fDiff !== 0 ? fDiff : b.priority - a.priority;
    });

    // 3. Análise de matchup — heróis difíceis
    if (matchups) {
        enemyIds.forEach(enemyId => {
            const m = matchups[enemyId];
            const enemyHero = simHeroConstants[enemyId];
            if (m && enemyHero) {
                const wr = m.games_played > 0 ? ((m.wins / m.games_played) * 100).toFixed(1) : '50.0';
                resultado.matchupInfo.push({
                    heroName: enemyHero.localized_name,
                    heroId: enemyId,
                    winRate: wr,
                    games: m.games_played,
                    isFavorable: parseFloat(wr) >= 50
                });
            }
        });
    }

    return resultado;
}

/**
 * Converte itens populares da API para o formato do simulador.
 */
/**
 * Componentes/itens basicos que NAO devem aparecer nas recomendacoes de mid/late game.
 * Eles aparecem na API porque sao comprados nessa fase, mas nao sao o item final.
 */
/**
 * Mapa de itens que evoluem para versoes finais.
 * No late game, se o item intermediario aparece, mostramos o item final.
 * Ex: Basher → Abyssal Blade, Orchid → Bloodthorn, Yasha → Manta
 */
const ITENS_EVOLUIVEIS = {
    basher:             'abyssal_blade',
    orchid:             'bloodthorn',
    maelstrom:          'mjollnir',
    shadow_blade:       'silver_edge',
    invis_sword:        'silver_edge',
    hood_of_defiance:   'pipe',
    vanguard:           'crimson_guard',
    mekansm:            'guardian_greaves',
    arcane_boots:       'guardian_greaves',
    buckler:            'crimson_guard',
    urn_of_shadows:     'spirit_vessel',
    medallion_of_courage: 'solar_crest',
    oblivion_staff:     'orchid',
    mask_of_madness:    'satanic',
    dragon_lance:       'hurricane_pike',
    echo_sabre:         'harpoon',
    diffusal_blade:     'disperser',
    rod_of_atos:        'gungir',
    witch_blade:        'khanda',
    falcon_blade:       'khanda',
    dagon:              'dagon_5',
    yasha:              'manta',
    sange:              'sange_and_yasha',
    kaya:               'yasha_and_kaya'
};

const COMPONENTES_IGNORAR = new Set([
    'hyperstone', 'eagle', 'ultimate_orb', 'mystic_staff', 'reaver', 'sacred_relic',
    'demon_edge', 'platemail', 'vitality_booster', 'energy_booster', 'point_booster',
    'staff_of_wizardry', 'ogre_axe', 'blade_of_alacrity', 'claymore', 'broadsword',
    'mithril_hammer', 'javelin', 'quarterstaff', 'talisman_of_evasion', 'robe',
    'helm_of_iron_will', 'ring_of_health', 'void_stone', 'perseverance',
    'boots', 'gloves', 'belt_of_strength', 'band_of_elvenskin', 'circlet',
    'gauntlets', 'slippers', 'mantle', 'branches', 'ring_of_protection',
    'stout_shield', 'quelling_blade', 'blight_stone', 'orb_of_venom',
    'wind_lace', 'ring_of_regen', 'sobi_mask', 'ring_of_tarrasque',
    'shadow_amulet', 'ghost', 'blink', 'blitz_knuckles', 'fluffy_hat',
    'tiara_of_selemene', 'diadem', 'eternal_shroud', 'cornucopia',
    'chasm_stone', 'shawl', 'splintmail', 'wizard_hat'
]);

function converterItensPopularesSim(itemData, maxItems, filtrarComponentes, fase) {
    if (!itemData || !simItemConstants) return [];

    const items = [];
    let total = 0;

    for (const [, count] of Object.entries(itemData)) {
        total += count;
    }

    // Agrupa itens (substituindo evoluiveis no late game)
    const agrupado = {};

    for (const [itemId, count] of Object.entries(itemData)) {
        const id = parseInt(itemId);
        let itemKey = Object.keys(simItemConstants).find(k => simItemConstants[k].id === id);

        if (!itemKey || itemKey.startsWith('recipe_')) continue;

        // Se filtrarComponentes = true, ignora componentes basicos
        if (filtrarComponentes && COMPONENTES_IGNORAR.has(itemKey)) continue;

        // No late game, substitui itens intermediarios pelo item final
        if (fase === 'late' && ITENS_EVOLUIVEIS[itemKey]) {
            const evolucao = ITENS_EVOLUIVEIS[itemKey];
            // So substitui se o item final existe nos dados
            if (simItemConstants[evolucao]) {
                itemKey = evolucao;
            }
        }

        // Agrupa contagem (caso dois itens virem o mesmo item final)
        if (agrupado[itemKey]) {
            agrupado[itemKey] += count;
        } else {
            agrupado[itemKey] = count;
        }
    }

    for (const [itemKey, count] of Object.entries(agrupado)) {
        const itemInfo = simItemConstants[itemKey];
        const displayName = (itemInfo && itemInfo.dname) ? itemInfo.dname : itemKey.replace(/_/g, ' ');

        items.push({
            name: itemKey,
            displayName: displayName,
            img: `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${itemKey}.png`,
            porcentagem: total > 0 ? ((count / total) * 100).toFixed(1) : '0',
            count: count
        });
    }

    items.sort((a, b) => b.count - a.count);
    return items.slice(0, maxItems);
}

/**
 * Renderiza os cards de decisão de itens (usado por aura e disputaveis).
 */
function renderDecisaoCards(decisoes) {
    return decisoes.map(d => {
        const impactoLabel = d.impacto === 'alto' ? 'ALTO IMPACTO' : 'MEDIO IMPACTO';
        const impactoCor = d.impacto === 'alto' ? '#ff4757' : '#f5a623';
        const faseLbl = getLabelFase(d.fase);

        // Barras de todos os candidatos
        const maxPont = Math.max(...d.candidatos.map(c => c.pontuacao));
        const barrasHtml = d.candidatos.map(c => {
            const heroData = simHeroConstants[c.heroId];
            const hImg = heroData
                ? `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${heroData.name.replace('npc_dota_hero_', '')}.png`
                : '';
            const barW = maxPont > 0 ? (c.pontuacao / maxPont) * 100 : 50;
            const isMelhor = c.heroId === d.melhorCandidato.heroId;
            const barColor = isMelhor ? 'var(--win-green)' : 'var(--accent-cyan)';
            const badge = isMelhor ? '<span class="sim-badge-faz">IDEAL</span>' : '';
            const nomeLabel = c.ehVoce ? 'VOCE' : c.heroNome;

            // Mostra a posição se definida
            const posInfo = c.posNome ? `<span class="sim-pos-badge" style="color:${c.posCor || '#8892a4'}">P${c.posicao}</span>` : '';

            return `
                <div class="sim-shared-row">
                    <img src="${hImg}" class="sim-shared-hero-mini" onerror="this.style.display='none'">
                    <span class="sim-shared-hero-name">${nomeLabel} ${posInfo}</span>
                    <div class="sim-shared-bar-bg">
                        <div class="sim-shared-bar" style="width:${barW}%;background:${barColor}"></div>
                    </div>
                    <span class="sim-shared-pct">${c.pct.toFixed(1)}%</span>
                    ${badge}
                </div>
            `;
        }).join('');

        // Veredicto
        let veredicto, veredictoColor;
        if (d.euDevoFazer) {
            veredicto = 'VOCE e o melhor candidato para este item';
            veredictoColor = 'var(--win-green)';
        } else {
            veredicto = `${d.melhorCandidato.heroNome} deve fazer — evite duplicar`;
            veredictoColor = 'var(--loss-red)';
        }

        // Necessidade contra inimigos
        const necessidadeHtml = d.necessidadeNaPartida
            ? `<div class="sim-forbidden-necessidade">${d.necessidadeNaPartida}</div>`
            : '';

        // Criterio de desempate (para itens disputaveis)
        const criterioHtml = d.criterioDesempate
            ? `<div class="sim-forbidden-criterio">${d.criterioDesempate}</div>`
            : '';

        return `
            <div class="sim-forbidden-card" style="border-left: 3px solid ${impactoCor}" data-item-name="${d.itemName}">
                <div class="sim-shared-item-header">
                    <img src="${d.img}" class="sim-shared-item-img" onerror="this.style.display='none'">
                    <div>
                        <span class="sim-shared-item-name">${d.displayName}</span>
                        <div class="sim-forbidden-meta">
                            <span class="sim-forbidden-impacto" style="color:${impactoCor}">${impactoLabel}</span>
                            <span class="sim-forbidden-fase">${faseLbl}</span>
                        </div>
                    </div>
                </div>
                <p class="sim-forbidden-motivo">${d.motivo}</p>
                ${necessidadeHtml}
                ${criterioHtml}
                <div class="sim-shared-comparison">
                    ${barrasHtml}
                </div>
                <div class="sim-shared-verdict" style="color:${veredictoColor}">
                    ${veredicto}
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Renderiza o resultado final da recomendação no simulador.
 * Agora com timeline de fases: Start → Early → Mid → Late.
 */
function renderizarResultadoSimulador(container, meuHero, rec, analise, matchups, enemyIds) {
    const heroNameForImg = meuHero.name.replace('npc_dota_hero_', '');
    const heroImg = `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${heroNameForImg}.png`;

    // Matchup cards
    let matchupHtml = '';
    if (rec.matchupInfo && rec.matchupInfo.length > 0) {
        matchupHtml = `
            <div class="sim-matchups">
                <h4 class="sim-section-title">MATCHUPS CONTRA INIMIGOS</h4>
                <div class="sim-matchup-grid">
                    ${rec.matchupInfo.map(m => {
                        const enemyHero = simHeroConstants[m.heroId];
                        const enemyImg = enemyHero
                            ? `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${enemyHero.name.replace('npc_dota_hero_', '')}.png`
                            : '';
                        const wrColor = m.isFavorable ? 'var(--win-green)' : 'var(--loss-red)';
                        const label = m.isFavorable ? 'Favorável' : 'Desfavorável';
                        return `
                            <div class="sim-matchup-card">
                                <img src="${enemyImg}" class="sim-matchup-img" onerror="this.style.display='none'">
                                <div class="sim-matchup-info">
                                    <span class="sim-matchup-name">${m.heroName}</span>
                                    <span class="sim-matchup-wr" style="color:${wrColor}">${m.winRate}% WR</span>
                                    <small style="color:${wrColor}">${label} (${m.games} jogos)</small>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    // Ameaças identificadas
    let ameacasHtml = '';
    if (analise.ameacas.length > 0) {
        const tiposUnicos = [...new Set(analise.ameacas.map(a => a.reason))];
        ameacasHtml = `
            <div class="sim-threats">
                <h4 class="sim-section-title">AMEACAS IDENTIFICADAS</h4>
                <div class="sim-threat-list">
                    ${tiposUnicos.map(reason => {
                        const heroisComEssaAmeaca = analise.ameacas
                            .filter(a => a.reason === reason)
                            .map(a => a.heroName);
                        const heroisUnicos = [...new Set(heroisComEssaAmeaca)];
                        return `
                            <div class="sim-threat-item">
                                <span class="sim-threat-icon">⚠️</span>
                                <div>
                                    <span class="sim-threat-reason">${reason}</span>
                                    <small class="sim-threat-heroes">${heroisUnicos.join(', ')}</small>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    // Timeline de itens por fase — o coração da nova visualização
    const fases = ['start', 'early', 'mid', 'late'];
    const faseCores = {
        start: '#8892a4',
        early: '#00e5ff',
        mid: '#f5a623',
        late: '#ff4757'
    };

    // Agrupa itens de counter por fase para integrar na timeline
    const countersPorFase = { start: [], early: [], mid: [], late: [] };
    rec.counter.forEach(item => {
        if (countersPorFase[item.fase]) {
            countersPorFase[item.fase].push(item);
        }
    });

    // Determina categoria de neutro do heroi visualizado
    const viewIdx = simVisualizandoIndex || 0;
    const viewTm = simVisualizandoTeam || 'ally';
    const heroVisualizadoId = simSelectedHeroes[viewTm][viewIdx];
    const catNeutro = heroVisualizadoId ? categoriaNeutroHeroi(heroVisualizadoId) : 'core_melee';

    // Mapa: qual tier de neutro mostrar em cada fase
    const neutrosPorFase = {
        start: [],
        early: [1, 2],   // Tier 1 (7min) e Tier 2 (17min) aparecem no early
        mid: [3],         // Tier 3 (27min)
        late: [4, 5]      // Tier 4 (37min) e Tier 5 (60min)
    };

    // Posicao do heroi visualizado (para calcular timing)
    const posArray = viewTm === 'enemy' ? simEnemyPositions : simPositions;
    const posHeroi = posArray[viewIdx] || 1;

    let timelineHtml = '<div class="sim-timeline">';
    timelineHtml += '<h4 class="sim-section-title">BUILD RECOMENDADA — TIMELINE</h4>';

    fases.forEach((fase, idx) => {
        const coreItems = rec.fases[fase] || [];
        const counterItems = countersPorFase[fase] || [];
        const neutroTiers = neutrosPorFase[fase] || [];
        const temItens = coreItems.length > 0 || counterItems.length > 0 || neutroTiers.length > 0;

        if (!temItens) return;

        const corFase = faseCores[fase];
        const isLast = idx === fases.length - 1;

        timelineHtml += `
            <div class="sim-timeline-phase">
                <div class="sim-timeline-marker">
                    <div class="sim-timeline-dot" style="background:${corFase}"></div>
                    ${!isLast ? '<div class="sim-timeline-line"></div>' : ''}
                </div>
                <div class="sim-timeline-content">
                    <div class="sim-phase-header">
                        <span class="sim-phase-title" style="color:${corFase}">${getLabelFase(fase)}</span>
                        <small class="sim-phase-dica">${getDicaTiming(fase)}</small>
                    </div>
        `;

        // Itens core do meta para esta fase
        if (coreItems.length > 0) {
            timelineHtml += '<div class="sim-phase-items">';
            coreItems.forEach(item => {
                // Gera build path para itens que tem componentes (nao mostra para itens iniciais)
                const buildPath = (fase !== 'start') ? gerarBuildPathHtml(item.name) : '';

                // Calcula custo e timing estimado (cada item independente)
                const itemInfo = simItemConstants ? simItemConstants[item.name] : null;
                const custo = itemInfo ? (itemInfo.cost || 0) : 0;
                const timing = (fase !== 'start' && custo > 0)
                    ? estimarTiming(custo, posHeroi, fase)
                    : '';

                // Mostra custo e timing
                const custoHtml = custo > 0 ? `<span class="sim-phase-item-cost">${custo}g</span>` : '';
                const timingHtml = timing ? `<span class="sim-phase-item-timing">${timing}</span>` : '';

                timelineHtml += `
                    <div class="sim-phase-item ${buildPath ? 'sim-phase-item-expandable' : ''}" data-item-name="${item.name}">
                        <img src="${item.img}" class="sim-phase-item-img" onerror="this.style.display='none'">
                        <div class="sim-phase-item-info">
                            <span class="sim-phase-item-name">${item.displayName}</span>
                            <div class="sim-phase-item-meta">
                                <small class="sim-phase-item-pct" style="color:${corFase}">${item.porcentagem}% uso</small>
                                ${custoHtml}
                                ${timingHtml}
                            </div>
                        </div>
                    </div>
                    ${buildPath}
                `;
            });
            timelineHtml += '</div>';
        }

        // Itens de counter para esta fase
        if (counterItems.length > 0) {
            timelineHtml += `<div class="sim-phase-counter-label">Itens de counter para esta fase:</div>`;
            timelineHtml += '<div class="sim-phase-items">';
            counterItems.forEach(item => {
                timelineHtml += `
                    <div class="sim-phase-item sim-phase-item-counter" data-item-name="${item.name}">
                        <img src="${item.img}" class="sim-phase-item-img" onerror="this.style.display='none'">
                        <div class="sim-phase-item-info">
                            <span class="sim-phase-item-name">${item.displayName}</span>
                            <small class="sim-phase-item-reason">${item.reason}</small>
                            <small class="sim-phase-item-contra">vs ${item.contraHerois.join(', ')}</small>
                        </div>
                        ${item.jaNoCore ? '<span class="sim-badge-core">CORE</span>' : ''}
                    </div>
                `;
            });
            timelineHtml += '</div>';
        }

        // Itens neutros para esta fase
        if (neutroTiers.length > 0) {
            neutroTiers.forEach(tierNum => {
                const tierData = NEUTROS_POR_TIER[tierNum];
                if (!tierData) return;

                const neutros = tierData.itens[catNeutro] || tierData.itens.core_melee;
                if (!neutros || neutros.length === 0) return;

                timelineHtml += `
                    <div class="sim-neutral-section">
                        <div class="sim-neutral-header">
                            <span class="sim-neutral-label">NEUTRO TIER ${tierNum}</span>
                            <span class="sim-neutral-timing">${tierData.turboTiming} (turbo)</span>
                        </div>
                        <div class="sim-neutral-items">
                            ${neutros.map(n => `
                                <div class="sim-neutral-item">
                                    <img src="https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${n.img}.png"
                                         class="sim-neutral-img"
                                         onerror="this.src='https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/trusty_shovel.png'">
                                    <div class="sim-neutral-info">
                                        <span class="sim-neutral-name">${n.nome}</span>
                                        <small class="sim-neutral-desc">${n.desc}</small>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            });
        }

        timelineHtml += '</div></div>'; // fecha content e phase
    });

    timelineHtml += '</div>'; // fecha timeline

    // ============================================
    // DECISÕES DE TIME — itens que NÃO devem ser duplicados
    // ============================================
    let decisoesHtml = '';
    const todasDecisoes = rec.itensCompartilhados ? rec.itensCompartilhados.decisoes : [];
    const viewHeroId = simSelectedHeroes[simVisualizandoTeam || 'ally'][simVisualizandoIndex || 0];

    // FILTRA itens de time — logica simples e direta:
    // 1. Remove TODOS os candidatos com 0% (sem dados reais = nao faz o item)
    // 2. So mostra se 2+ herois tem dados reais (conflito real)
    // 3. O heroi visualizado precisa estar entre eles
    const decisoes = todasDecisoes.map(d => {
        // Apenas candidatos com uso real na API
        const candidatosReais = d.candidatos.filter(c => c.pct > 0);

        // Precisa de 2+ herois com dados reais para ter conflito
        if (candidatosReais.length < 2) return null;

        // O heroi visualizado precisa ter dados reais para este item
        const euEstou = candidatosReais.some(c => c.heroId === viewHeroId);
        if (!euEstou) return null;

        return { ...d, candidatos: candidatosReais };
    }).filter(Boolean);
    if (decisoes.length > 0) {
        // Secao unificada: itens que precisam de coordenacao no time
        decisoesHtml = `
            <div class="sim-forbidden-section">
                <h4 class="sim-section-title">ITENS DE TIME — COORDENACAO</h4>
                <p class="sim-shared-desc">Itens que nao devem ser duplicados ou que precisam de priorizacao. Veja quem tem maior uso e quem e o mais indicado.</p>
                <div class="sim-forbidden-grid">
                    ${renderDecisaoCards(decisoes)}
                </div>
            </div>
        `;
    }

    // Itens informativos: itens de time que o restante da equipe deve cobrir
    // Inclui: (1) itens com dados da API onde o heroi visualizado nao esta envolvido
    //         (2) itens sugeridos por composicao (role match) mesmo sem dados da API
    // O "melhor candidato" e GLOBAL (nao muda conforme quem visualiza)
    const itensJaMostrados = new Set(decisoes.map(d => d.itemName));
    const teamAtual = simVisualizandoTeam || 'ally';
    const todosAllyIds = simSelectedHeroes[teamAtual].filter(id => id !== null);
    const itensOutrosCards = [];

    for (const [itemKey, regra] of Object.entries(ITENS_DECISAO_TIME)) {
        if (itensJaMostrados.has(itemKey)) continue;

        // Busca o melhor candidato GLOBAL (inclui todos, nao exclui o visualizado)
        let melhorHeroId = null;
        let melhorPct = 0;
        let melhorPontuacao = -999;
        let fonte = '';

        // Primeiro: herois com dados reais da API
        const decisaoExistente = todasDecisoes.find(d => d.itemName === itemKey);
        if (decisaoExistente) {
            decisaoExistente.candidatos.forEach(cand => {
                if (cand.pct > 0 && cand.pontuacao > melhorPontuacao) {
                    melhorHeroId = cand.heroId;
                    melhorPct = cand.pct;
                    melhorPontuacao = cand.pontuacao;
                    fonte = 'api';
                }
            });
        }

        // Segundo: se ninguem tem dados da API, busca por role (sugestao)
        if (!melhorHeroId) {
            todosAllyIds.forEach(heroId => {
                const heroInfo = determinarPapelHeroi(heroId);
                const roleBate = regra.quemFazMelhor.some(papel => heroInfo.papeis.includes(papel));
                if (!roleBate) return;

                const pontuacao = calcularPontuacaoItem(heroId, itemKey, regra, 0, enemyIds);
                if (pontuacao > melhorPontuacao) {
                    melhorHeroId = heroId;
                    melhorPct = 0;
                    melhorPontuacao = pontuacao;
                    fonte = 'composicao';
                }
            });
        }

        if (melhorHeroId) {
            const heroData = simHeroConstants[melhorHeroId];
            const heroInfo = determinarPapelHeroi(melhorHeroId);
            itensOutrosCards.push({
                itemKey,
                displayName: regra.nome,
                img: `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${itemKey}.png`,
                heroId: melhorHeroId,
                heroNome: heroData ? heroData.localized_name : '?',
                heroImg: heroData
                    ? `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${heroData.name.replace('npc_dota_hero_', '')}.png`
                    : '',
                pct: melhorPct,
                posLabel: heroInfo.posNome ? `P${heroInfo.posicao}` : '',
                posCor: heroInfo.posCor || '#8892a4',
                fonte
            });
        }
    }

    if (itensOutrosCards.length > 0) {
        const itensOutrosHtml = itensOutrosCards.map(d => {
            const pctHtml = d.pct > 0
                ? `<small class="sim-team-item-pct">${d.pct.toFixed(1)}%</small>`
                : `<small class="sim-team-item-sug">sugestao</small>`;

            return `
                <div class="sim-team-item-info" data-item-name="${d.itemKey}">
                    <img src="${d.img}" class="sim-team-item-img" onerror="this.style.display='none'">
                    <div class="sim-team-item-detail">
                        <span class="sim-team-item-name">${d.displayName}</span>
                        <div class="sim-team-item-who">
                            <img src="${d.heroImg}" class="sim-team-item-hero-img" onerror="this.style.display='none'">
                            <span>${d.heroNome}</span>
                            <small style="color:${d.posCor}">${d.posLabel}</small>
                            ${pctHtml}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        decisoesHtml += `
            <div class="sim-team-items-others">
                <h4 class="sim-section-title-sm">ITENS DE TIME — RESTANTE DA EQUIPE</h4>
                <div class="sim-team-items-grid">
                    ${itensOutrosHtml}
                </div>
            </div>
        `;
    }

    // Mostra indicador de quem esta sendo visualizado
    const viewIndex = simVisualizandoIndex || 0;
    const vTeam = simVisualizandoTeam || 'ally';
    const ehVoce = vTeam === 'ally' && viewIndex === 0;
    const ehInimigo = vTeam === 'enemy';

    let tagLabel = '';
    if (ehInimigo) {
        tagLabel = '<span class="sim-viewing-enemy">(INIMIGO — Clique em outro heroi para trocar)</span>';
    } else if (!ehVoce) {
        tagLabel = '<span class="sim-viewing-ally">(Clique em outro heroi para trocar)</span>';
    }

    const headerTag = ehInimigo ? 'Analise do inimigo' : (ehVoce ? 'Recomendacao para' : 'Recomendacao para');
    const headerSuffix = ehInimigo ? '' : (ehVoce ? '' : '(Aliado)');

    container.innerHTML = `
        <div class="sim-result-header ${ehInimigo ? 'sim-result-enemy' : ''}">
            <img src="${heroImg}" class="sim-result-hero-img" onerror="this.style.display='none'">
            <div>
                <h3 class="sim-result-hero-name">${headerTag} ${meuHero.localized_name} ${headerSuffix}</h3>
                <p class="sim-result-attr">${getAttrLabel(meuHero.primary_attr)} — ${getRolesLabel(meuHero.roles)}</p>
                ${tagLabel}
            </div>
        </div>

        ${ameacasHtml}
        ${matchupHtml}
        ${decisoesHtml}
        ${timelineHtml}
    `;

    // Ativa tooltips para todos os itens renderizados
    ativarTooltipsItens(container);
}

// ============================================
// SISTEMA DE TOOLTIP DE ITENS
// ============================================

/**
 * Cria o elemento tooltip global (1 por pagina).
 */
function criarTooltipGlobal() {
    if (document.getElementById('item-tooltip')) return;

    const tooltip = document.createElement('div');
    tooltip.id = 'item-tooltip';
    tooltip.className = 'item-tooltip hidden';
    document.body.appendChild(tooltip);
}

/**
 * Busca os dados completos de um item pelo nome interno.
 * Retorna todos os dados disponiveis: stats, habilidades, componentes, etc.
 */
function getDadosItem(itemName) {
    if (!simItemConstants) return null;

    const item = simItemConstants[itemName];
    if (!item) return null;

    const nome = item.dname || itemName.replace(/_/g, ' ');
    const custo = item.cost || 0;
    const lore = item.lore || '';
    const cd = item.cd || false;
    const mc = item.mc || false;

    // Atributos / stats do item (ex: +10 Armor, +30 Attack Speed)
    const atributos = [];
    if (item.attrib && Array.isArray(item.attrib)) {
        item.attrib.forEach(attr => {
            if (!attr.key || attr.value === undefined) return;
            // Se tem display formatado, usa ele substituindo {value}
            if (attr.display) {
                const texto = attr.display.replace('{value}', attr.value);
                atributos.push(texto);
            } else {
                // Formata pelo key: bonus_armor → +X Armor
                const label = attr.key
                    .replace(/^bonus_/, '')
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, c => c.toUpperCase());
                const sinal = (typeof attr.value === 'number' && attr.value > 0) ? '+' : '';
                atributos.push(`${sinal}${attr.value} ${label}`);
            }
        });
    }

    // Habilidades (ativa, passiva, aura)
    const habilidades = [];
    if (item.abilities && Array.isArray(item.abilities)) {
        item.abilities.forEach(ab => {
            habilidades.push({
                tipo: ab.type || 'passive',
                titulo: ab.title || '',
                descricao: ab.description || ''
            });
        });
    }

    // Hint (dicas extras)
    const hints = [];
    if (item.hint && Array.isArray(item.hint)) {
        item.hint.forEach(h => { if (h) hints.push(h); });
    } else if (typeof item.hint === 'string' && item.hint) {
        hints.push(item.hint);
    }

    // Componentes
    const componentes = [];
    if (item.components) {
        item.components.forEach(compName => {
            const comp = simItemConstants[compName];
            if (comp) {
                componentes.push({
                    nome: comp.dname || compName.replace(/_/g, ' '),
                    img: `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${compName}.png`,
                    custo: comp.cost || 0
                });
            }
        });
    }

    return { nome, custo, lore, cd, mc, atributos, habilidades, hints, componentes };
}

/**
 * Mostra o tooltip completo ao lado do elemento (estilo Dota 2).
 * Inclui: stats, habilidades ativas/passivas, cooldown, mana cost, componentes.
 */
function mostrarTooltipItem(event, itemName) {
    const tooltip = document.getElementById('item-tooltip');
    if (!tooltip) return;

    const dados = getDadosItem(itemName);
    if (!dados) return;

    // === ATRIBUTOS / STATS ===
    let statsHtml = '';
    if (dados.atributos.length > 0) {
        statsHtml = `
            <div class="tooltip-stats">
                ${dados.atributos.map(s => `<div class="tooltip-stat-line">${s}</div>`).join('')}
            </div>
        `;
    }

    // === HABILIDADES (ativa, passiva, aura) ===
    let abilitiesHtml = '';
    if (dados.habilidades.length > 0) {
        abilitiesHtml = dados.habilidades.map(ab => {
            const tipoLabel = ab.tipo === 'active' ? 'ATIVO' : (ab.tipo === 'passive' ? 'PASSIVO' : 'AURA');
            const tipoCor = ab.tipo === 'active' ? '#00e5ff' : (ab.tipo === 'passive' ? '#f5a623' : '#39d353');
            return `
                <div class="tooltip-ability">
                    <div class="tooltip-ability-header">
                        <span class="tooltip-ability-type" style="color:${tipoCor}">${tipoLabel}</span>
                        <span class="tooltip-ability-title">${ab.titulo}</span>
                    </div>
                    <p class="tooltip-ability-desc">${ab.descricao}</p>
                </div>
            `;
        }).join('');
    }

    // === HINTS ===
    let hintsHtml = '';
    if (dados.hints.length > 0) {
        hintsHtml = `
            <div class="tooltip-hints">
                ${dados.hints.map(h => `<div class="tooltip-hint-line">${h}</div>`).join('')}
            </div>
        `;
    }

    // === COOLDOWN / MANA COST ===
    let cdMcHtml = '';
    if (dados.cd || dados.mc) {
        const cdText = dados.cd ? `<span class="tooltip-cd">⏱ ${dados.cd}s</span>` : '';
        const mcText = dados.mc ? `<span class="tooltip-mc">💧 ${dados.mc}</span>` : '';
        cdMcHtml = `<div class="tooltip-cd-mc">${cdText} ${mcText}</div>`;
    }

    // === COMPONENTES ===
    let componentesHtml = '';
    if (dados.componentes.length > 0) {
        componentesHtml = `
            <div class="tooltip-componentes">
                <div class="tooltip-comp-titulo">COMPONENTES:</div>
                <div class="tooltip-comp-lista">
                    ${dados.componentes.map(c => `
                        <div class="tooltip-comp-item">
                            <img src="${c.img}" class="tooltip-comp-img" onerror="this.style.display='none'">
                            <span>${c.nome}</span>
                            <span class="tooltip-comp-custo">${c.custo}g</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // === LORE ===
    const loreHtml = dados.lore
        ? `<p class="tooltip-lore">${dados.lore}</p>`
        : '';

    tooltip.innerHTML = `
        <div class="tooltip-header">
            <span class="tooltip-nome">${dados.nome}</span>
            <span class="tooltip-custo">${dados.custo} gold</span>
        </div>
        ${statsHtml}
        ${cdMcHtml}
        ${abilitiesHtml}
        ${hintsHtml}
        ${componentesHtml}
        ${loreHtml}
    `;

    tooltip.classList.remove('hidden');

    // Posiciona o tooltip
    const rect = event.currentTarget.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    let left = rect.right + 10;
    let top = rect.top;

    // Se sair da tela pela direita, mostra à esquerda
    if (left + tooltipRect.width > window.innerWidth) {
        left = rect.left - tooltipRect.width - 10;
    }
    // Se sair da tela por baixo, ajusta pra cima
    if (top + tooltipRect.height > window.innerHeight) {
        top = window.innerHeight - tooltipRect.height - 10;
    }
    if (top < 0) top = 10;

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
}

/**
 * Esconde o tooltip.
 */
function esconderTooltipItem() {
    const tooltip = document.getElementById('item-tooltip');
    if (tooltip) tooltip.classList.add('hidden');
}

/**
 * GPM estimado por posicao na Turbo.
 * Na Turbo, o gold passivo e de creeps e 2x, e kills dao muito mais gold.
 * Players focam em teamfight e kills, nao em farm de creeps.
 * Esses valores refletem o GPM medio real em turbo (maior que ranked).
 */
const GPM_TURBO = {
    1: 1000,  // Hard Carry — farm rapido + kills
    2: 900,   // Mid — ganks e farm
    3: 750,   // Offlaner — teamfight e kills
    4: 550,   // Suporte — assists e gold passivo
    5: 450    // Hard Suporte — gold passivo e assists
};

/**
 * Minuto base em que cada fase tipicamente comeca na Turbo.
 * Na Turbo, tudo acontece ~40% mais rapido que ranked.
 */
const FASE_INICIO_TURBO = {
    start: 0,
    early: 0,
    mid: 8,
    late: 16
};

/**
 * Estima em qual minuto o jogador consegue fechar um item na Turbo.
 * Cada item tem timing INDEPENDENTE: base da fase + custo / GPM.
 * O jogador nao compra TODOS os itens sugeridos — ele escolhe 1-2 por fase.
 * posicao: posicao do jogador (1-5)
 * fase: 'start', 'early', 'mid', 'late'
 * Retorna: string como "~8 min"
 */
function estimarTiming(custoItem, posicao, fase) {
    const gpm = GPM_TURBO[posicao] || 600;
    const inicioFase = FASE_INICIO_TURBO[fase] || 0;
    const minutoFinal = Math.round(inicioFase + custoItem / gpm);
    return `~${minutoFinal} min`;
}

/**
 * Gera o HTML do build path (caminho de compra) de um item.
 * Mostra os componentes em ordem, do mais barato ao mais caro.
 * Retorna '' se o item nao tem componentes.
 */
function gerarBuildPathHtml(itemName) {
    if (!simItemConstants) return '';

    const item = simItemConstants[itemName];
    if (!item || !item.components || item.components.length === 0) return '';

    // Ordena componentes pelo custo (mais barato primeiro = compra antes)
    const comps = item.components
        .map(compName => {
            const comp = simItemConstants[compName];
            return comp ? {
                name: compName,
                dname: comp.dname || compName.replace(/_/g, ' '),
                cost: comp.cost || 0,
                img: `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${compName}.png`
            } : null;
        })
        .filter(Boolean)
        .sort((a, b) => a.cost - b.cost);

    if (comps.length === 0) return '';

    const stepsHtml = comps.map((c, i) => `
        <span class="build-path-step">
            <img src="${c.img}" class="build-path-img" onerror="this.style.display='none'" title="${c.dname}">
            <span class="build-path-cost">${c.cost}g</span>
        </span>
        ${i < comps.length - 1 ? '<span class="build-path-arrow">→</span>' : ''}
    `).join('');

    // Item final
    const finalName = item.dname || itemName.replace(/_/g, ' ');

    return `
        <div class="build-path">
            <span class="build-path-label">Montar:</span>
            ${stepsHtml}
            <span class="build-path-arrow">→</span>
            <span class="build-path-final">${finalName}</span>
        </div>
    `;
}

/**
 * Ativa os eventos de hover em todos os itens dentro de um container.
 * Procura elementos com data-item-name.
 */
function ativarTooltipsItens(container) {
    criarTooltipGlobal();

    const itens = container.querySelectorAll('[data-item-name]');
    itens.forEach(el => {
        el.addEventListener('mouseenter', (e) => {
            mostrarTooltipItem(e, el.dataset.itemName);
        });
        el.addEventListener('mouseleave', esconderTooltipItem);
    });
}
