/**
 * Módulo de Alertas de Itens Inimigos.
 * Integrado ao simulador: detecta itens que inimigos fecharam
 * e sugere counter-items para os cores aliados.
 *
 * No jogo real: seria automático ao inimigo aparecer no mapa.
 * No protótipo: o usuário simula clicando "+ Item" no herói inimigo.
 */

// ============================================
// MAPEAMENTO DE COUNTER-ITEMS
// ============================================

/**
 * Mapeamento de itens → counters.
 * posicoes: array de posições que devem fazer o counter (1=carry, 2=mid, 3=off, 4=sup, 5=hard sup)
 */
const ALERTA_COUNTERS = {
    'black_king_bar': {
        nome: 'BKB',
        counters: [
            { item: 'abyssal_blade', motivo: 'Stun atravessa BKB', posicoes: [1, 3] },
            { item: 'nullifier', motivo: 'Muta e dispela BKB', posicoes: [1, 2] }
        ]
    },
    'butterfly': {
        nome: 'Butterfly',
        counters: [
            { item: 'monkey_king_bar', motivo: 'Ignora a evasão', posicoes: [1, 2] }
        ]
    },
    'cyclone': {
        nome: "Eul's Scepter",
        counters: [
            { item: 'nullifier', motivo: 'Muta e impede uso de itens', posicoes: [1, 2] }
        ]
    },
    'sphere': {
        nome: "Linken's Sphere",
        counters: [
            { item: 'abyssal_blade', motivo: 'Estoura Linken + stun garantido', posicoes: [1, 3] },
            { item: 'rod_of_atos', motivo: 'Estoura Linken a distância (barato)', posicoes: [3, 4] }
        ]
    },
    'ghost': {
        nome: 'Ghost Scepter',
        counters: [
            { item: 'nullifier', motivo: 'Dispela a forma etérea', posicoes: [1, 2] }
        ]
    },
    'blade_mail': {
        nome: 'Blade Mail',
        counters: [
            { item: 'black_king_bar', motivo: 'BKB bloqueia o dano refletido', posicoes: [1, 2] }
        ]
    },
    'heart': {
        nome: 'Heart of Tarrasque',
        counters: [
            { item: 'spirit_vessel', motivo: 'Reduz a regeneração em 45%', posicoes: [4, 5] }
        ]
    },
    'shivas_guard': {
        nome: "Shiva's Guard",
        counters: [
            { item: 'black_king_bar', motivo: 'BKB ignora o slow e redução de AS', posicoes: [1, 2] }
        ]
    },
    'assault': {
        nome: 'Assault Cuirass',
        counters: [
            { item: 'desolator', motivo: 'Reduz ainda mais a armadura', posicoes: [1, 2] },
            { item: 'solar_crest', motivo: 'Remove armadura do alvo', posicoes: [3, 4, 5] }
        ]
    },
    'satanic': {
        nome: 'Satanic',
        counters: [
            { item: 'spirit_vessel', motivo: 'Reduz o lifesteal drasticamente', posicoes: [4, 5] },
            { item: 'nullifier', motivo: 'Dispela o Unholy Rage', posicoes: [1, 2] }
        ]
    },
    'manta': {
        nome: 'Manta Style',
        counters: [
            { item: 'mjollnir', motivo: 'Chain lightning limpa ilusões rápido', posicoes: [1, 2] },
            { item: 'crimson_guard', motivo: 'Bloqueia dano das ilusões', posicoes: [3] }
        ]
    },
    'radiance': {
        nome: 'Radiance',
        counters: [
            { item: 'pipe', motivo: 'Barreira absorve o dano de burn', posicoes: [3, 4] }
        ]
    },
    'ethereal_blade': {
        nome: 'Ethereal Blade',
        counters: [
            { item: 'nullifier', motivo: 'Dispela a forma etérea', posicoes: [1, 2] },
            { item: 'black_king_bar', motivo: 'Imune ao burst mágico', posicoes: [1, 2, 3] }
        ]
    },
    'heavens_halberd': {
        nome: "Heaven's Halberd",
        counters: [
            { item: 'black_king_bar', motivo: 'Dispela o disarm', posicoes: [1, 2] },
            { item: 'nullifier', motivo: 'Dispela o disarm', posicoes: [1, 2] }
        ]
    },
    'orchid': {
        nome: 'Orchid Malevolence',
        counters: [
            { item: 'black_king_bar', motivo: 'Dispela o silence', posicoes: [1, 2, 3] },
            { item: 'manta', motivo: 'Dispela o silence com Manta', posicoes: [1, 2] },
            { item: 'lotus_orb', motivo: 'Reflete o silence de volta', posicoes: [3, 4] }
        ]
    },
    'bloodthorn': {
        nome: 'Bloodthorn',
        counters: [
            { item: 'black_king_bar', motivo: 'Dispela silence + crit', posicoes: [1, 2, 3] },
            { item: 'lotus_orb', motivo: 'Reflete o Bloodthorn de volta', posicoes: [3, 4] }
        ]
    },
    'silver_edge': {
        nome: 'Silver Edge',
        counters: [
            { item: 'lotus_orb', motivo: 'Reflete o break de volta', posicoes: [3, 4] }
        ]
    },
    'scythe_of_vyse': {
        nome: 'Scythe of Vyse',
        counters: [
            { item: 'black_king_bar', motivo: 'Não pode ser hexado com BKB', posicoes: [1, 2, 3] },
            { item: 'sphere', motivo: "Linken's bloqueia o hex", posicoes: [1, 2] }
        ]
    }
};

// Estado do módulo
let alertasNotificacoes = [];   // Lista de notificações ativas
let alertasItemPorInimigo = {}; // { enemyIndex: [item_keys] }
let alertaPickerAberto = null;  // index do inimigo com picker aberto

// ============================================
// INICIALIZAÇÃO
// ============================================

/**
 * Mostra a seção de alertas quando o simulador gerar recomendações.
 * Injeta o HTML dentro do sim-result para garantir que aparece.
 */
function mostrarAlertas() {
    const resultEl = document.getElementById('sim-result');
    if (!resultEl) return;

    // Só mostra se tem inimigos selecionados
    const temInimigo = simSelectedHeroes.enemy.some(id => id !== null);
    if (!temInimigo) return;

    // Remove seção anterior se existir (evita duplicar)
    const existing = document.getElementById('sim-alertas');
    if (existing) existing.remove();

    // Cria a seção de alertas e adiciona ao final do resultado
    const section = document.createElement('div');
    section.id = 'sim-alertas';
    section.className = 'sim-alertas';
    section.innerHTML = `
        <h3 class="sim-alertas-titulo">ALERTAS DE ITENS INIMIGOS</h3>
        <p class="sim-alertas-desc">Simule itens que os inimigos fecharam para receber alertas e sugestões de counter.</p>
        <div id="sim-alertas-inimigos" class="sim-alertas-inimigos"></div>
        <div id="sim-alertas-notificacoes" class="sim-alertas-notificacoes"></div>
    `;

    resultEl.appendChild(section);
    renderAlertasInimigos();
    renderAlertasNotificacoes();
}

// ============================================
// RENDERIZAÇÃO DOS INIMIGOS
// ============================================

/**
 * Renderiza o painel de heróis inimigos com botão de adicionar item.
 */
function renderAlertasInimigos() {
    const container = document.getElementById('sim-alertas-inimigos');
    if (!container) return;

    let html = '';

    simSelectedHeroes.enemy.forEach((heroId, index) => {
        if (!heroId) return;

        const hero = simHeroConstants[heroId];
        if (!hero) return;

        const heroNameForImg = hero.name.replace('npc_dota_hero_', '');
        const heroImg = `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${heroNameForImg}.png`;

        // Itens já adicionados a este inimigo
        const itensDoInimigo = alertasItemPorInimigo[index] || [];

        html += `
            <div class="alerta-enemy-slot" style="position:relative">
                <img src="${heroImg}" class="alerta-enemy-img" onerror="this.style.display='none'">
                <span class="alerta-enemy-name">${hero.localized_name}</span>
                <div class="alerta-enemy-items">
                    ${itensDoInimigo.map(itemKey => {
                        const imgUrl = `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${itemKey}.png`;
                        return `<img src="${imgUrl}" class="alerta-enemy-item-img" title="${itemKey.replace(/_/g, ' ')}">`;
                    }).join('')}
                </div>
                <button class="alerta-btn-add" onclick="abrirPickerAlerta(${index})">+ Item</button>
                <div id="alerta-picker-${index}" class="alerta-item-picker" style="display:none">
                    <input type="text" placeholder="Buscar item..." oninput="filtrarItensAlerta(${index}, this.value)">
                    <div id="alerta-item-grid-${index}" class="alerta-item-grid"></div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// ============================================
// PICKER DE ITENS
// ============================================

/**
 * Abre o picker de itens para um inimigo específico.
 */
function abrirPickerAlerta(enemyIndex) {
    // Fecha picker anterior se tiver
    if (alertaPickerAberto !== null) {
        const prev = document.getElementById(`alerta-picker-${alertaPickerAberto}`);
        if (prev) prev.style.display = 'none';
    }

    const picker = document.getElementById(`alerta-picker-${enemyIndex}`);
    if (!picker) return;

    // Toggle
    if (alertaPickerAberto === enemyIndex) {
        alertaPickerAberto = null;
        picker.style.display = 'none';
        return;
    }

    alertaPickerAberto = enemyIndex;
    picker.style.display = 'block';

    // Renderiza os itens
    renderItensAlerta(enemyIndex, '');

    // Foca no input
    const input = picker.querySelector('input');
    if (input) {
        input.value = '';
        input.focus();
    }
}

/**
 * Filtra itens no picker.
 */
function filtrarItensAlerta(enemyIndex, busca) {
    renderItensAlerta(enemyIndex, busca.toLowerCase());
}

/**
 * Componentes e consumíveis que NÃO devem aparecer no picker.
 * Apenas itens "fechados" (finais) devem ser alertados.
 */
const ITENS_EXCLUIDOS = new Set([
    // Consumíveis e wards
    'tango', 'flask', 'clarity', 'enchanted_mango', 'faerie_fire',
    'ward_observer', 'ward_sentry', 'dust', 'smoke_of_deceit',
    'tome_of_knowledge', 'tpscroll', 'cheese', 'aegis', 'refresher_shard',
    // Componentes básicos (não são fechados)
    'point_booster', 'vitality_booster', 'energy_booster', 'ogre_axe',
    'blade_of_alacrity', 'staff_of_wizardry', 'mystic_staff', 'reaver',
    'eaglesong', 'sacred_relic', 'demon_edge', 'hyperstone', 'ultimate_orb',
    'void_stone', 'ring_of_health', 'pers', 'platemail', 'talisman_of_evasion',
    'blink', 'boots', 'gloves', 'belt_of_strength', 'robe', 'circlet',
    'gauntlets', 'slippers', 'mantle', 'branches', 'ring_of_protection',
    'quelling_blade', 'stout_shield', 'magic_stick', 'wind_lace',
    'ring_of_regen', 'sobi_mask', 'ring_of_tarrasque', 'fluffy_hat',
    'gem', 'ghost', 'shadow_amulet', 'blight_stone', 'orb_of_corrosion',
    'orb_of_venom', 'crown', 'diadem', 'cornucopia',
    'cloak', 'mithril_hammer', 'javelin', 'broadsword', 'claymore',
    'helm_of_iron_will', 'blades_of_attack', 'chainmail', 'infused_raindrop',
    'magic_wand', 'bottle', 'soul_ring', 'ring_of_basilius',
    'headdress', 'buckler', 'urn_of_shadows', 'tranquil_boots',
    'wraith_band', 'null_talisman', 'bracer',
    // Itens removidos/obsoletos que ainda existem na API
    'trident', 'poor_mans_shield', 'iron_talon', 'ring_of_aquila',
    'helm_of_the_dominator', 'necronomicon', 'necronomicon_2', 'necronomicon_3',
    'diffusal_blade_2', 'recipe_iron_talon', 'recipe_necronomicon',
    'recipe_necronomicon_2', 'recipe_necronomicon_3', 'recipe_poor_mans_shield',
    'recipe_ring_of_aquila', 'recipe_trident',
    // Itens de Roshan/especiais (não compráveis)
    'aegis', 'cheese', 'refresher_shard',
    // Neutros (drop, não compráveis)
    'trusty_shovel', 'keen_optic', 'grove_bow', 'quicksilver_amulet',
    'spider_legs', 'paladin_sword', 'the_leveller', 'penta_edged_sword',
    'desolator_2', 'pirate_hat', 'ex_machina', 'mirror_shield',
    'apex', 'ballista', 'book_of_the_dead', 'demonicon',
    'fallen_sky', 'force_boots', 'giants_ring', 'havoc_hammer',
    'panic_button', 'seer_stone', 'stygian_desolator', 'wind_waker',
    'flicker', 'fairy_dust', 'possessed_mask', 'vambrace',
    'dragon_scale', 'essence_ring', 'clumsy_net', 'enchanted_quiver',
    'nether_shawl', 'vampire_fangs', 'ninja_gear', 'illusionsts_cape',
    'minotaur_horn', 'spell_prism', 'princes_knife', 'imp_claw',
    'titan_sliver', 'elven_tunic', 'mind_breaker', 'witless_shako',
    'timeless_relic', 'spell_prism', 'ascetic_cap',
    'telescope', 'psychic_headband', 'ceremonial_robe', 'chipped_vest',
    'broom_handle', 'faded_broach', 'seeds_of_serenity', 'lance_of_pursuit',
    'occult_bracelet', 'safety_bubble', 'dandelion_amulet', 'whisper_of_the_dread',
    'spark_of_courage', 'gossamer_cape', 'duelist_gloves', 'royal_jelly',
    'pupils_gift', 'bullwhip', 'eye_of_the_vizier', 'orb_of_destruction',
    'defiant_shell', 'vindicators_axe', 'specialist_array', 'doubloon',
    'craggy_coat', 'gladiator_helm',
    'martyrs_plate', 'phylactery', 'disperser_2',
    'warriors_axe', 'katana', 'dagger_of_ristul'
]);

/**
 * Renderiza a grid de itens fechados no picker.
 * Itens com counter mapeado aparecem com borda vermelha destacada.
 */
function renderItensAlerta(enemyIndex, filtro) {
    const grid = document.getElementById(`alerta-item-grid-${enemyIndex}`);
    if (!grid || !simItemConstants) return;

    const jaAdicionados = new Set(alertasItemPorInimigo[enemyIndex] || []);

    const itensValidos = [];
    for (const [key, data] of Object.entries(simItemConstants)) {
        if (jaAdicionados.has(key)) continue;
        if (ITENS_EXCLUIDOS.has(key)) continue;
        if (key.startsWith('recipe')) continue;
        if (!data.cost || data.cost < 1800) continue; // Itens fechados custam no mínimo ~1800g

        const nomeDisplay = key.replace(/_/g, ' ');
        if (filtro && !nomeDisplay.includes(filtro) && !key.includes(filtro)) continue;

        itensValidos.push({ key, data, temCounter: !!ALERTA_COUNTERS[key] });
    }

    // Ordena: itens com counter primeiro (mais importantes), depois por custo
    itensValidos.sort((a, b) => {
        if (a.temCounter && !b.temCounter) return -1;
        if (!a.temCounter && b.temCounter) return 1;
        return (b.data.cost || 0) - (a.data.cost || 0);
    });

    let html = '';
    itensValidos.forEach(({ key, temCounter }) => {
        const imgUrl = `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${key}.png`;
        const nome = ALERTA_COUNTERS[key] ? ALERTA_COUNTERS[key].nome : key.replace(/_/g, ' ');
        const borderStyle = temCounter ? 'border: 2px solid #ff4757;' : '';

        html += `<img src="${imgUrl}" class="alerta-item-option" title="${nome}"
                      style="${borderStyle}"
                      onclick="adicionarItemInimigo(${enemyIndex}, '${key}')"
                      onerror="this.style.display='none'">`;
    });

    grid.innerHTML = html || '<p style="color:#556; font-size:12px; grid-column:1/-1; text-align:center">Nenhum item encontrado</p>';
}

// ============================================
// LÓGICA DE ALERTAS
// ============================================

/**
 * Adiciona um item a um inimigo e gera as notificações.
 */
function adicionarItemInimigo(enemyIndex, itemKey) {
    // Registra o item no inimigo
    if (!alertasItemPorInimigo[enemyIndex]) {
        alertasItemPorInimigo[enemyIndex] = [];
    }
    alertasItemPorInimigo[enemyIndex].push(itemKey);

    // Fecha o picker
    const picker = document.getElementById(`alerta-picker-${enemyIndex}`);
    if (picker) picker.style.display = 'none';
    alertaPickerAberto = null;

    // Gera notificações
    gerarNotificacoes(enemyIndex, itemKey);

    // Re-renderiza
    renderAlertasInimigos();
    renderAlertasNotificacoes();
}

/**
 * Gera as notificações para um item que o inimigo fechou.
 */
function gerarNotificacoes(enemyIndex, itemKey) {
    const heroId = simSelectedHeroes.enemy[enemyIndex];
    const hero = simHeroConstants[heroId];
    const heroName = hero ? hero.localized_name : 'Inimigo';
    const itemInfo = ALERTA_COUNTERS[itemKey];
    const itemNome = itemInfo ? itemInfo.nome : itemKey.replace(/_/g, ' ');

    // Notificação geral: "Herói inimigo fechou [item]"
    alertasNotificacoes.push({
        id: Date.now() + Math.random(),
        tipo: 'geral',
        heroName,
        heroId,
        enemyIndex,
        itemKey,
        itemNome,
        timestamp: new Date()
    });

    // Notificações de counter para cada counter disponível
    if (itemInfo && itemInfo.counters) {
        itemInfo.counters.forEach(counter => {
            const counterNome = getItemNome(counter.item);

            // Identifica quais aliados devem fazer o counter (por posição)
            const alvos = getAlvosCounter(counter.posicoes);

            alertasNotificacoes.push({
                id: Date.now() + Math.random(),
                tipo: 'counter',
                heroName,
                heroId,
                enemyIndex,
                itemKey,
                itemNome,
                counterItem: counter.item,
                counterNome,
                motivo: counter.motivo,
                posicoes: counter.posicoes,
                alvos,
                status: 'pendente' // 'pendente', 'aceito', 'recusado', 'concluido'
            });
        });
    }
}

/**
 * Retorna o nome amigável de um item.
 */
function getItemNome(itemKey) {
    // Verifica se está no mapeamento de counters
    if (ALERTA_COUNTERS[itemKey]) return ALERTA_COUNTERS[itemKey].nome;

    // Senão, usa o nome do itemConstants
    if (simItemConstants && simItemConstants[itemKey]) {
        return itemKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    return itemKey.replace(/_/g, ' ');
}

/**
 * Identifica quais heróis aliados devem fazer o counter-item.
 * Usa as posições específicas definidas em cada counter.
 */
function getAlvosCounter(posicoes) {
    const alvos = [];
    if (!posicoes || posicoes.length === 0) return alvos;

    const posSet = new Set(posicoes);

    for (let i = 0; i < 5; i++) {
        const heroId = simSelectedHeroes.ally[i];
        if (!heroId) continue;

        const pos = simPositions[i];
        const hero = simHeroConstants[heroId];
        const nome = hero ? hero.localized_name : `Aliado ${i + 1}`;

        if (pos && posSet.has(pos)) {
            alvos.push({ index: i, nome, pos });
        } else if (!pos) {
            // Sem posição definida — inclui como possível
            alvos.push({ index: i, nome, pos: null });
        }
    }

    return alvos;
}

// ============================================
// RENDERIZAÇÃO DAS NOTIFICAÇÕES
// ============================================

/**
 * Renderiza todas as notificações ativas.
 */
function renderAlertasNotificacoes() {
    const container = document.getElementById('sim-alertas-notificacoes');
    if (!container) return;

    if (alertasNotificacoes.length === 0) {
        container.innerHTML = '';
        return;
    }

    // Ordena: pendentes primeiro, depois aceitos, depois concluidos/recusados
    const ordem = { pendente: 0, aceito: 1, concluido: 2, recusado: 3 };
    const ordenadas = [...alertasNotificacoes].sort((a, b) => {
        return (ordem[a.status] || 0) - (ordem[b.status] || 0);
    });

    let html = '';

    ordenadas.forEach(notif => {
        if (notif.tipo === 'geral') {
            html += renderNotifGeral(notif);
        } else if (notif.tipo === 'counter') {
            if (notif.status !== 'recusado') {
                html += renderNotifCounter(notif);
            }
        }
    });

    container.innerHTML = html;
}

/**
 * Renderiza uma notificação geral (inimigo fechou item).
 */
function renderNotifGeral(notif) {
    const heroNameForImg = simHeroConstants[notif.heroId]
        ? simHeroConstants[notif.heroId].name.replace('npc_dota_hero_', '')
        : '';
    const heroImg = `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${heroNameForImg}.png`;
    const itemImg = `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${notif.itemKey}.png`;

    return `
        <div class="alerta-notif alerta-notif-geral">
            <img src="${heroImg}" style="width:36px; height:20px; border-radius:3px" onerror="this.style.display='none'">
            <img src="${itemImg}" class="alerta-notif-item-img">
            <div class="alerta-notif-body">
                <div class="alerta-notif-titulo">${notif.heroName} fechou ${notif.itemNome}</div>
                <div class="alerta-notif-detalhe">Todos os aliados foram notificados</div>
            </div>
        </div>
    `;
}

/**
 * Renderiza uma notificação de counter (sugestão de item).
 */
function renderNotifCounter(notif) {
    const counterImg = `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${notif.counterItem}.png`;
    const isConcluido = notif.status === 'concluido';
    const isAceito = notif.status === 'aceito';
    const classeExtra = isConcluido ? 'alerta-notif-concluido' : '';

    const POS_NOMES = { 1: 'Carry', 2: 'Mid', 3: 'Offlaner', 4: 'Suporte', 5: 'Hard Suporte' };
    const alvosTexto = notif.alvos.length > 0
        ? notif.alvos.map(a => a.nome).join(', ')
        : notif.posicoes.map(p => POS_NOMES[p] || `Pos ${p}`).join(', ');

    let botoesHtml = '';
    if (isConcluido) {
        botoesHtml = '<span style="color:#39d353; font-size:12px; font-weight:600">Item feito</span>';
    } else if (isAceito) {
        botoesHtml = `<button class="alerta-btn-feito" onclick="concluirAlerta('${notif.id}')">Fiz o item</button>
                      <button class="alerta-btn-nao" onclick="recusarAlerta('${notif.id}')">Cancelar</button>`;
    } else {
        botoesHtml = `<button class="alerta-btn-fazer" onclick="aceitarAlerta('${notif.id}')">Vou fazer</button>
                      <button class="alerta-btn-nao" onclick="recusarAlerta('${notif.id}')">Não vou</button>`;
    }

    return `
        <div class="alerta-notif alerta-notif-counter ${classeExtra}">
            <span class="alerta-notif-icon">⚠</span>
            <img src="${counterImg}" class="alerta-notif-item-img">
            <div class="alerta-notif-body">
                <div class="alerta-notif-titulo">COUNTER: Faça ${notif.counterNome} para countar ${notif.itemNome}</div>
                <div class="alerta-notif-detalhe">${notif.motivo} — Sugerido para: ${alvosTexto}</div>
            </div>
            <div class="alerta-notif-actions">
                ${botoesHtml}
            </div>
        </div>
    `;
}

// ============================================
// AÇÕES NAS NOTIFICAÇÕES
// ============================================

/**
 * Marca uma notificação como aceita (jogador vai fazer o item).
 */
function aceitarAlerta(notifId) {
    const notif = alertasNotificacoes.find(n => String(n.id) === String(notifId));
    if (notif) notif.status = 'aceito';
    renderAlertasNotificacoes();
}

/**
 * Marca uma notificação como recusada (jogador não vai fazer).
 */
function recusarAlerta(notifId) {
    const notif = alertasNotificacoes.find(n => String(n.id) === String(notifId));
    if (notif) notif.status = 'recusado';
    renderAlertasNotificacoes();
}

/**
 * Marca uma notificação como concluída (jogador fez o item).
 */
function concluirAlerta(notifId) {
    const notif = alertasNotificacoes.find(n => String(n.id) === String(notifId));
    if (notif) notif.status = 'concluido';
    renderAlertasNotificacoes();
}

/**
 * Reseta todos os alertas (quando o simulador é reiniciado).
 */
function resetarAlertas() {
    alertasNotificacoes = [];
    alertasItemPorInimigo = {};
    alertaPickerAberto = null;

    const section = document.getElementById('sim-alertas');
    if (section) section.classList.add('hidden');

    const container = document.getElementById('sim-alertas-notificacoes');
    if (container) container.innerHTML = '';
}
