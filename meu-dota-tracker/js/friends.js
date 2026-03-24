/**
 * Módulo de Comparativo com Amigos.
 * Mostra os amigos que mais jogam Turbo com o jogador e compara stats.
 */

/**
 * Renderiza a lista de amigos com comparação de estatísticas.
 * @param {Array} peers - Lista de amigos do jogador (da API /peers).
 * @param {Object} heroConstants - Mapeamento de heróis.
 */
function renderFriends(peers, heroConstants) {
    const grid = document.getElementById('friends-grid');
    if (!grid || !peers) return;

    // Filtra amigos com pelo menos 5 partidas juntos e ordena por mais jogados
    const relevantes = peers
        .filter(p => p.games >= 5 && p.personaname)
        .sort((a, b) => b.games - a.games)
        .slice(0, 12);

    if (relevantes.length === 0) {
        grid.innerHTML = '<p style="color:#8892a4; padding:20px">Nenhum amigo com partidas suficientes encontrado.</p>';
        return;
    }

    grid.innerHTML = relevantes.map(friend => {
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
}
