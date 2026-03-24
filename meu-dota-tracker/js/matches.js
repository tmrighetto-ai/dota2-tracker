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

        // net_worth não vem no /recentMatches, então calcula pelo GPM * duração
        const estimatedNW = match.net_worth
            ? match.net_worth
            : (match.gold_per_min && match.duration
                ? Math.round(match.gold_per_min * match.duration / 60)
                : 0);
        const netWorth = estimatedNW > 0 ? (estimatedNW/1000).toFixed(1)+'k' : 'N/A';
        const damage   = match.hero_damage ? (match.hero_damage/1000).toFixed(1)+'k' : 'N/A';

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
            <td>
                <span style="color:#39d353">${match.kills}</span> /
                <span style="color:#ff4757">${match.deaths}</span> /
                <span style="color:#f5a623">${match.assists}</span>
            </td>
            <td style="color:#f5a623">${netWorth}</td>
            <td style="color:#ff9966">${damage}</td>
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

    // Busca itens de cada partida com delay entre chamadas
    // para evitar rate limit da API (60 req/min no OpenDota)
    carregarItensComDelay(matchesData, itemConstants);
}

/**
 * Carrega itens das partidas uma por vez, com delay entre cada chamada.
 * Evita estourar o rate limit do OpenDota (60 req/min).
 */
async function carregarItensComDelay(matches, itemConstants) {
    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        // Verifica se a célula ainda existe (usuário pode ter mudado de página)
        const container = document.getElementById(`items-${match.match_id}`);
        if (!container) continue;

        await carregarItensDaPartida(match.match_id, match.hero_id, match.player_slot, itemConstants);

        // Espera 1 segundo entre cada chamada (max ~60 req/min, dentro do limite)
        if (i < matches.length - 1) {
            await new Promise(r => setTimeout(r, 1000));
        }
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
