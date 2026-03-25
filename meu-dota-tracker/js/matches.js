/**
 * Módulo para renderização de partidas.
 */

/**
 * Renderiza a tabela de partidas recentes.
 * @param {Array} matchesData - Lista de partidas recentes.
 * @param {Object} heroConstants - Mapeamento de ID para heróis.
 * @param {Object} itemConstants - Mapeamento de nomes para itens.
 */
function renderMatchesTable(matchesData, heroConstants, itemConstants) {
    const tableBody = document.getElementById('matches-body');
    tableBody.innerHTML = '';

    if (!matchesData || matchesData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:20px; color:#8892a4">Nenhuma partida encontrada</td></tr>';
        return;
    }

    matchesData.forEach(match => {
        const hInfo = heroConstants[match.hero_id];

        const isWin = (match.player_slot < 128 && match.radiant_win) ||
                      (match.player_slot >= 128 && !match.radiant_win);

        const resultText  = isWin ? 'WIN' : 'LOSS';
        const resultClass = isWin ? 'win-text' : 'loss-text';

        const date = new Date(match.start_time * 1000);
        const formattedDate = `${date.getDate().toString().padStart(2,'0')}/${(date.getMonth()+1).toString().padStart(2,'0')}/${date.getFullYear()}`;

        const durationMin = Math.floor(match.duration / 60);
        const durationSec = (match.duration % 60).toString().padStart(2,'0');

        const heroNameForImg = hInfo ? hInfo.name.replace('npc_dota_hero_','') : '';
        const heroImg = `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${heroNameForImg}.png`;

        // Dados que podem não existir em partidas do /matches (só no /recentMatches)
        const temDetalhes = match.kills !== undefined && match.kills !== null;

        const estimatedNW = match.net_worth
            ? match.net_worth
            : (match.gold_per_min && match.duration
                ? Math.round(match.gold_per_min * match.duration / 60)
                : 0);

        const kdaHtml = temDetalhes
            ? `<span style="color:#39d353">${match.kills}</span> /
               <span style="color:#ff4757">${match.deaths}</span> /
               <span style="color:#f5a623">${match.assists}</span>`
            : `<span class="match-loading-data" id="kda-${match.match_id}">...</span>`;

        const netWorth = estimatedNW > 0 ? (estimatedNW/1000).toFixed(1)+'k' : '';
        const damage = match.hero_damage ? (match.hero_damage/1000).toFixed(1)+'k' : '';

        const tr = document.createElement('tr');
        tr.className = 'match-row';
        tr.innerHTML = `
            <td><a href="https://www.opendota.com/matches/${match.match_id}" target="_blank" style="color:#00e5ff">${match.match_id}</a></td>
            <td>
                <div style="display:flex;align-items:center;gap:8px">
                    <img src="${heroImg}" style="width:40px;border-radius:4px" onerror="this.style.display='none'">
                    <span>${hInfo ? hInfo.localized_name : 'Desconhecido'}</span>
                </div>
            </td>
            <td>${formattedDate}</td>
            <td><span class="${resultClass}">${resultText}</span></td>
            <td id="kda-cell-${match.match_id}">${kdaHtml}</td>
            <td style="color:#f5a623" id="nw-${match.match_id}">${netWorth || '<span class="match-loading-data">...</span>'}</td>
            <td style="color:#ff9966" id="dmg-${match.match_id}">${damage || '<span class="match-loading-data">...</span>'}</td>
            <td style="color:#8892a4">${durationMin}:${durationSec}</td>
            <td id="items-${match.match_id}">
                <div style="display:flex;gap:3px">
                    ${[0,1,2,3,4,5].map(() =>
                        `<div style="width:36px;height:26px;background:#0a0c10;border:1px solid #1e2535;border-radius:3px"></div>`
                    ).join('')}
                </div>
            </td>
        `;
        tableBody.appendChild(tr);
    });

    // Busca detalhes (itens + stats) de cada partida com delay
    carregarDetalhesComDelay(matchesData, itemConstants);
}

/**
 * Extrai apenas os dados do jogador que precisamos cachear.
 * O match detail completo tem ~100KB (10 jogadores). Salvamos só ~1KB.
 */
function extrairDadosJogador(detail, match) {
    let player = null;
    if (globalAccountId) {
        player = detail.players.find(p => String(p.account_id) === String(globalAccountId));
    }
    if (!player && match.hero_id && match.player_slot !== undefined) {
        player = detail.players.find(p => p.hero_id === match.hero_id && p.player_slot === match.player_slot);
    }
    if (!player && match.player_slot !== undefined) {
        player = detail.players.find(p => p.player_slot === match.player_slot);
    }
    if (!player) return null;

    // Retorna só os campos que usamos na tabela
    return {
        account_id: player.account_id,
        hero_id: player.hero_id,
        player_slot: player.player_slot,
        kills: player.kills,
        deaths: player.deaths,
        assists: player.assists,
        net_worth: player.net_worth,
        gold_per_min: player.gold_per_min,
        xp_per_min: player.xp_per_min,
        hero_damage: player.hero_damage,
        last_hits: player.last_hits,
        denies: player.denies,
        item_0: player.item_0,
        item_1: player.item_1,
        item_2: player.item_2,
        item_3: player.item_3,
        item_4: player.item_4,
        item_5: player.item_5,
        purchase_log: player.purchase_log || []
    };
}

/**
 * Carrega detalhes (itens + stats) das partidas uma por vez, com delay.
 * Evita estourar o rate limit do OpenDota (60 req/min).
 * Preenche KDA, NW, Dano e Itens para partidas que não tinham esses dados.
 */
async function carregarDetalhesComDelay(matches, itemConstants) {
    let chamadasAPI = 0;
    let doCache = 0;

    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        // Verifica se a célula ainda existe (usuário pode ter mudado de página)
        const container = document.getElementById(`items-${match.match_id}`);
        if (!container) continue;

        // Verifica se já tem no cache antes de chamar (para contar e decidir delay)
        const temCache = sessionStorage.getItem(`match_detail_${match.match_id}`) !== null;

        await carregarDetalhesDaPartida(match, itemConstants);

        if (temCache) {
            doCache++;
        } else {
            chamadasAPI++;
            // Delay só quando fez chamada real à API
            if (i < matches.length - 1) {
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    }

}

/**
 * Busca detalhes completos de uma partida e atualiza todas as células.
 * Usa sessionStorage como cache — partidas antigas nunca mudam,
 * então evita gastar chamadas da API ao dar F5.
 */
async function carregarDetalhesDaPartida(match, itemConstants) {
    try {
        const cacheKey = `match_detail_${match.match_id}`;
        let detail = null;

        // Tenta buscar do cache primeiro
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            try {
                detail = JSON.parse(cached);
            } catch (e) {
                sessionStorage.removeItem(cacheKey);
            }
        }

        // Se não tinha cache, busca da API e salva
        if (!detail) {
            detail = await fetchMatchDetail(match.match_id);
            if (detail && detail.players) {
                // Salva apenas os dados do jogador (não o match inteiro, que é muito grande)
                const playerData = extrairDadosJogador(detail, match);
                if (playerData) {
                    sessionStorage.setItem(cacheKey, JSON.stringify({ players: [playerData], _cached: true }));
                }
            }
        }

        if (!detail || !detail.players) return;

        // Encontra o jogador
        let player = null;
        if (globalAccountId) {
            player = detail.players.find(p =>
                String(p.account_id) === String(globalAccountId)
            );
        }
        if (!player && match.hero_id && match.player_slot !== undefined) {
            player = detail.players.find(p =>
                p.hero_id === match.hero_id && p.player_slot === match.player_slot
            );
        }
        if (!player && match.player_slot !== undefined) {
            player = detail.players.find(p => p.player_slot === match.player_slot);
        }
        if (!player) return;

        // Atualiza KDA se estava faltando
        const kdaCell = document.getElementById(`kda-cell-${match.match_id}`);
        if (kdaCell && kdaCell.querySelector('.match-loading-data')) {
            kdaCell.innerHTML = `
                <span style="color:#39d353">${player.kills}</span> /
                <span style="color:#ff4757">${player.deaths}</span> /
                <span style="color:#f5a623">${player.assists}</span>`;
        }

        // Atualiza Net Worth
        const nwCell = document.getElementById(`nw-${match.match_id}`);
        if (nwCell && nwCell.querySelector('.match-loading-data')) {
            const nw = player.net_worth || (player.gold_per_min && match.duration
                ? Math.round(player.gold_per_min * match.duration / 60) : 0);
            nwCell.innerHTML = nw > 0 ? `${(nw/1000).toFixed(1)}k` : '—';
            nwCell.style.color = '#f5a623';
        }

        // Atualiza Dano
        const dmgCell = document.getElementById(`dmg-${match.match_id}`);
        if (dmgCell && dmgCell.querySelector('.match-loading-data')) {
            const dmg = player.hero_damage || 0;
            dmgCell.innerHTML = dmg > 0 ? `${(dmg/1000).toFixed(1)}k` : '—';
            dmgCell.style.color = '#ff9966';
        }

        // Atualiza Itens
        const itemIds = [
            player.item_0, player.item_1, player.item_2,
            player.item_3, player.item_4, player.item_5
        ];

        const purchaseTimes = {};
        if (player.purchase_log) {
            for (let i = player.purchase_log.length - 1; i >= 0; i--) {
                const entry = player.purchase_log[i];
                if (!purchaseTimes[entry.key]) {
                    purchaseTimes[entry.key] = entry.time;
                }
            }
        }

        let html = '<div style="display:flex;gap:4px;flex-wrap:wrap">';
        itemIds.forEach(id => {
            if (!id || id === 0) {
                html += `<div style="width:40px;height:36px;background:#0a0c10;border:1px solid #1e2535;border-radius:3px"></div>`;
            } else {
                const itemKey = Object.keys(itemConstants).find(k => itemConstants[k].id === id);
                if (itemKey) {
                    const imgUrl = `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${itemKey}.png`;
                    const itemName = itemKey.replace(/_/g, ' ');
                    const timeSec = purchaseTimes[itemKey];
                    let timeStr = '';
                    if (timeSec !== undefined) {
                        const min = Math.floor(Math.abs(timeSec) / 60);
                        const sec = (Math.abs(timeSec) % 60).toString().padStart(2, '0');
                        timeStr = timeSec < 0 ? `-${min}:${sec}` : `${min}:${sec}`;
                    }
                    html += `<div class="match-item-cell" title="${itemName}${timeStr ? ' — comprado em ' + timeStr : ''}">
                        <img src="${imgUrl}" class="match-item-img" onerror="this.style.display='none'">
                        ${timeStr ? `<span class="match-item-time">${timeStr}</span>` : ''}
                    </div>`;
                }
            }
        });
        html += '</div>';

        const container = document.getElementById(`items-${match.match_id}`);
        if (container) container.innerHTML = html;

    } catch (e) {
        console.warn('Erro ao carregar detalhes da partida', match.match_id, e);
    }
}

/**
 * Busca os itens de uma partida específica e atualiza a célula na tabela.
 * Usa hero_id + player_slot para encontrar o jogador correto.
 * Mostra o tempo de compra de cada item abaixo da imagem.
 */
async function carregarItensDaPartida(matchId, heroId, playerSlot, itemConstants) {
    try {
        const detail = await fetchMatchDetail(matchId);
        if (!detail || !detail.players) return;

        // Tenta encontrar o jogador de 3 formas
        let player = null;

        if (globalAccountId) {
            player = detail.players.find(p =>
                String(p.account_id) === String(globalAccountId)
            );
        }

        if (!player && heroId && playerSlot !== undefined) {
            player = detail.players.find(p =>
                p.hero_id === heroId && p.player_slot === playerSlot
            );
        }

        if (!player && playerSlot !== undefined) {
            player = detail.players.find(p => p.player_slot === playerSlot);
        }

        if (!player) return;

        const itemIds = [
            player.item_0, player.item_1, player.item_2,
            player.item_3, player.item_4, player.item_5
        ];

        // Monta mapa de tempo de compra a partir do purchase_log
        // purchase_log é um array de {time, key} com o tempo em segundos
        const purchaseTimes = {};
        if (player.purchase_log) {
            // Percorre de trás pra frente para pegar o tempo da ÚLTIMA compra de cada item
            for (let i = player.purchase_log.length - 1; i >= 0; i--) {
                const entry = player.purchase_log[i];
                if (!purchaseTimes[entry.key]) {
                    purchaseTimes[entry.key] = entry.time;
                }
            }
        }

        let html = '<div style="display:flex;gap:4px;flex-wrap:wrap">';
        itemIds.forEach(id => {
            if (!id || id === 0) {
                html += `<div style="width:40px;height:36px;background:#0a0c10;border:1px solid #1e2535;border-radius:3px"></div>`;
            } else {
                const itemKey = Object.keys(itemConstants).find(k => itemConstants[k].id === id);
                if (itemKey) {
                    const imgUrl = `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${itemKey}.png`;
                    const itemName = itemKey.replace(/_/g, ' ');

                    // Busca o tempo de compra do item
                    const timeSec = purchaseTimes[itemKey];
                    let timeStr = '';
                    if (timeSec !== undefined) {
                        const min = Math.floor(Math.abs(timeSec) / 60);
                        const sec = (Math.abs(timeSec) % 60).toString().padStart(2, '0');
                        timeStr = timeSec < 0 ? `-${min}:${sec}` : `${min}:${sec}`;
                    }

                    html += `<div class="match-item-cell" title="${itemName}${timeStr ? ' — comprado em ' + timeStr : ''}">
                        <img src="${imgUrl}" class="match-item-img" onerror="this.style.display='none'">
                        ${timeStr ? `<span class="match-item-time">${timeStr}</span>` : ''}
                    </div>`;
                }
            }
        });
        html += '</div>';

        const container = document.getElementById(`items-${matchId}`);
        if (container) container.innerHTML = html;

    } catch (e) {
        console.warn('Erro ao carregar itens da partida', matchId, e);
    }
}

/**
 * CORREÇÃO 3: Renderiza os itens diretamente do objeto da partida.
 * A rota /recentMatches já retorna item_0 até item_5 — não precisa de chamada extra.
 */
function renderItemsFromMatch(match, itemConstants) {
    const itemIds = [
        match.item_0, match.item_1, match.item_2,
        match.item_3, match.item_4, match.item_5
    ];

    let html = '<div style="display: flex; gap: 3px; flex-wrap: wrap">';

    itemIds.forEach(id => {
        if (!id || id === 0) {
            // Slot vazio
            html += '<div style="width:36px; height:26px; background:#0a0c10; border:1px solid #1e2535; border-radius:3px"></div>';
        } else {
            // Acha o nome do item pelo ID no dicionário
            const itemKey = Object.keys(itemConstants).find(
                key => itemConstants[key].id === id
            );
            if (itemKey) {
                const itemName = itemKey.replace('item_', '');
                const itemImg = `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${itemName}.png`;
                html += `<img src="${itemImg}"
                    style="width:36px; height:26px; border-radius:3px; border:1px solid #1e2535"
                    title="${itemKey.replace('item_','').replace(/_/g,' ')}"
                    onerror="this.style.display='none'">`;
            } else {
                html += '<div style="width:36px; height:26px; background:#161b26; border:1px solid #1e2535; border-radius:3px"></div>';
            }
        }
    });

    html += '</div>';
    return html;
}

/**
 * Atualiza os itens de uma partida (mantido para compatibilidade).
 */
function updateMatchItems(matchId, matchDetail, accountId, itemConstants) {
    const container = document.getElementById(`items-${matchId}`);
    if (!container || !matchDetail) return;

    const player = matchDetail.players.find(p => p.account_id == accountId);
    if (!player) return;

    const fakeMatch = {
        item_0: player.item_0, item_1: player.item_1, item_2: player.item_2,
        item_3: player.item_3, item_4: player.item_4, item_5: player.item_5
    };
    container.innerHTML = renderItemsFromMatch(fakeMatch, itemConstants);
}
