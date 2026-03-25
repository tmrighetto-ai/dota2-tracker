/**
 * Módulo de Comparativo com Amigos.
 * Mostra os amigos que mais jogam Turbo com o jogador e compara stats.
 * Cruza com lista de amigos da Steam para priorizar amigos reais.
 * Paginação de 12 amigos por página.
 */

// Estado da paginação
let friendsData = [];        // Lista filtrada e ordenada de amigos
let friendsPaginaAtual = 1;
const FRIENDS_POR_PAGINA = 12;

// STEAM_FRIEND_IDS é carregado via <script src="data/steam-friends.js">
// Contém os account_ids (32-bit) de todos os amigos da Steam

/**
 * Renderiza a lista de amigos com comparação de estatísticas.
 * @param {Array} peers - Lista de amigos do jogador (da API /peers).
 * @param {Object} heroConstants - Mapeamento de heróis.
 */
function renderFriends(peers, heroConstants) {
    const grid = document.getElementById('friends-grid');
    if (!grid || !peers) return;

    // Set de IDs dos amigos da Steam para comparação rápida
    const friendSet = new Set(STEAM_FRIEND_IDS.map(id => String(id)));

    // Filtra: apenas amigos da Steam que já jogaram Turbo juntos
    friendsData = peers
        .filter(p => p.personaname && friendSet.has(String(p.account_id)))
        .sort((a, b) => (b.win || 0) - (a.win || 0));

    console.log(`Amigos Steam com Turbo: ${friendsData.length} de ${peers.length} peers`);

    friendsPaginaAtual = 1;
    renderFriendsPagina();
}

/**
 * Renderiza a página atual de amigos + paginação.
 */
function renderFriendsPagina() {
    const grid = document.getElementById('friends-grid');
    if (!grid) return;

    if (friendsData.length === 0) {
        grid.innerHTML = '<p style="color:#8892a4; padding:20px">Nenhum amigo com partidas suficientes encontrado.</p>';
        renderFriendsPaginacao();
        return;
    }

    const totalPaginas = Math.ceil(friendsData.length / FRIENDS_POR_PAGINA);
    const inicio = (friendsPaginaAtual - 1) * FRIENDS_POR_PAGINA;
    const fim = inicio + FRIENDS_POR_PAGINA;
    const paginaAtual = friendsData.slice(inicio, fim);

    grid.innerHTML = paginaAtual.map(friend => {
        const totalGames = friend.games || 0;
        const wins = friend.win || 0;
        const winRate = totalGames > 0 ? ((wins / totalGames) * 100).toFixed(1) : '0.0';
        const wrColor = parseFloat(winRate) >= 50 ? 'var(--win-green)' : 'var(--loss-red)';

        const avatar = friend.avatarfull || friend.avatar || '';
        const lastPlayed = friend.last_played
            ? new Date(friend.last_played * 1000).toLocaleDateString('pt-BR')
            : 'N/A';

        return `
            <div class="friend-card">
                <div class="friend-header">
                    ${avatar
                        ? `<img src="${avatar}" class="friend-avatar" onerror="this.style.display='none'">`
                        : '<div class="friend-avatar-placeholder"></div>'
                    }
                    <div class="friend-name-area">
                        <h3 class="friend-name">${friend.personaname}</h3>
                        <span class="friend-last-played">Última partida juntos: ${lastPlayed}</span>
                    </div>
                </div>
                <div class="friend-stats">
                    <div class="friend-stat">
                        <span class="friend-stat-value">${totalGames}</span>
                        <span class="friend-stat-label">PARTIDAS</span>
                    </div>
                    <div class="friend-stat">
                        <span class="friend-stat-value" style="color:var(--win-green)">${wins}</span>
                        <span class="friend-stat-label">VITÓRIAS</span>
                    </div>
                    <div class="friend-stat">
                        <span class="friend-stat-value" style="color:${wrColor}">${winRate}%</span>
                        <span class="friend-stat-label">WIN RATE</span>
                    </div>
                </div>
                <div class="friend-winbar">
                    <div class="friend-winbar-fill" style="width:${winRate}%; background:${wrColor}"></div>
                </div>
            </div>
        `;
    }).join('');

    renderFriendsPaginacao();
}

/**
 * Renderiza os botões de paginação dos amigos.
 */
function renderFriendsPaginacao() {
    const container = document.getElementById('friends-pagination');
    if (!container) return;

    const totalPaginas = Math.ceil(friendsData.length / FRIENDS_POR_PAGINA);

    // Não mostra paginação se tem só 1 página
    if (totalPaginas <= 1) {
        container.innerHTML = `<span class="pagination-info">${friendsData.length} amigos</span>`;
        return;
    }

    let html = `<span class="pagination-info">${friendsData.length} amigos</span>`;

    // Botão anterior
    html += `<button class="page-btn" ${friendsPaginaAtual === 1 ? 'disabled' : ''}
             onclick="mudarPaginaFriends(${friendsPaginaAtual - 1})">‹</button>`;

    // Números das páginas
    for (let i = 1; i <= totalPaginas; i++) {
        const ativo = i === friendsPaginaAtual ? 'active' : '';
        html += `<button class="page-btn ${ativo}" onclick="mudarPaginaFriends(${i})">${i}</button>`;
    }

    // Botão próximo
    html += `<button class="page-btn" ${friendsPaginaAtual === totalPaginas ? 'disabled' : ''}
             onclick="mudarPaginaFriends(${friendsPaginaAtual + 1})">›</button>`;

    container.innerHTML = html;
}

/**
 * Navega para uma página específica de amigos.
 */
function mudarPaginaFriends(pagina) {
    const totalPaginas = Math.ceil(friendsData.length / FRIENDS_POR_PAGINA);
    if (pagina < 1 || pagina > totalPaginas) return;

    friendsPaginaAtual = pagina;
    renderFriendsPagina();

    // Scroll suave para o topo da seção de amigos
    const section = document.getElementById('friends-section');
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
