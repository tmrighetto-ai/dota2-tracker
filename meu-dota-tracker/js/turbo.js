/**
 * Módulo Turbo — Estatísticas resumidas e desempenho em Turbo.
 */

/**
 * Renderiza os cards de resumo do Turbo (win rate, médias, etc).
 */
function renderTurboSummary(winLoss, totals, turboMatches) {
    const grid = document.getElementById('turbo-stats-grid');
    if (!grid) return;

    const totalGames = (winLoss.win || 0) + (winLoss.lose || 0);
    const winRate = totalGames > 0 ? ((winLoss.win / totalGames) * 100).toFixed(1) : '0.0';

    // Calcula médias a partir dos totais da API
    const getAvg = (field) => {
        const item = totals.find(t => t.field === field);
        if (item && item.n > 0) return (item.sum / item.n).toFixed(1);
        return '0';
    };

    const avgKills = getAvg('kills');
    const avgDeaths = getAvg('deaths');
    const avgAssists = getAvg('assists');
    const avgDuration = getAvg('duration');
    const avgDurationMin = (parseFloat(avgDuration) / 60).toFixed(0);
    const avgHeroDamage = getAvg('hero_damage');
    const avgGpm = getAvg('gold_per_min');
    const avgXpm = getAvg('xp_per_min');

    // Calcula sequência de vitórias/derrotas atual
    let streak = 0;
    let streakType = '';
    if (turboMatches && turboMatches.length > 0) {
        const firstMatch = turboMatches[0];
        const firstWin = (firstMatch.player_slot < 128 && firstMatch.radiant_win) ||
                         (firstMatch.player_slot >= 128 && !firstMatch.radiant_win);
        streakType = firstWin ? 'win' : 'loss';
        for (const m of turboMatches) {
            const isWin = (m.player_slot < 128 && m.radiant_win) ||
                          (m.player_slot >= 128 && !m.radiant_win);
            if ((isWin && streakType === 'win') || (!isWin && streakType === 'loss')) {
                streak++;
            } else {
                break;
            }
        }
    }

    const streakColor = streakType === 'win' ? 'var(--win-green)' : 'var(--loss-red)';
    const streakLabel = streakType === 'win' ? 'VITÓRIAS SEGUIDAS' : 'DERROTAS SEGUIDAS';

    const winRateColor = parseFloat(winRate) >= 50 ? 'var(--win-green)' : 'var(--loss-red)';

    grid.innerHTML = `
        <div class="turbo-stat-item">
            <span class="stat-value-inline" style="color:${winRateColor}">${winRate}%</span>
            <span class="stat-label-inline">WR</span>
            <span class="stat-detail">${winLoss.win || 0}V/${winLoss.lose || 0}D</span>
        </div>
        <div class="turbo-stat-item">
            <span class="stat-value-inline">${totalGames}</span>
            <span class="stat-label-inline">PARTIDAS</span>
        </div>
        <div class="turbo-stat-item">
            <span class="stat-value-inline" style="color:${streakColor}">${streak}</span>
            <span class="stat-label-inline">${streakType === 'win' ? 'SEQ. V' : 'SEQ. D'}</span>
        </div>
        <div class="turbo-stat-item">
            <span class="stat-value-inline">${avgKills}/${avgDeaths}/${avgAssists}</span>
            <span class="stat-label-inline">KDA</span>
        </div>
        <div class="turbo-stat-item">
            <span class="stat-value-inline" style="color:var(--mmr-gold)">${avgGpm}</span>
            <span class="stat-label-inline">GPM</span>
        </div>
        <div class="turbo-stat-item">
            <span class="stat-value-inline" style="color:var(--accent-cyan)">${avgXpm}</span>
            <span class="stat-label-inline">XPM</span>
        </div>
        <div class="turbo-stat-item">
            <span class="stat-value-inline" style="color:#ff9966">${(parseFloat(avgHeroDamage)/1000).toFixed(1)}k</span>
            <span class="stat-label-inline">DANO</span>
        </div>
        <div class="turbo-stat-item">
            <span class="stat-value-inline">${avgDurationMin}m</span>
            <span class="stat-label-inline">DUR.</span>
        </div>
    `;
}

/**
 * Renderiza o gráfico de desempenho das últimas 20 partidas Turbo.
 * Mostra barras verdes (vitória) e vermelhas (derrota) com K/D/A.
 */
function renderPerformanceChart(turboMatches, heroConstants) {
    const chartEl = document.getElementById('performance-chart');
    const avgEl = document.getElementById('performance-averages');
    if (!chartEl || !turboMatches) return;

    // Pega as últimas 20 partidas (já vêm ordenadas por data desc)
    const last20 = turboMatches.slice(0, 20).reverse();

    if (last20.length === 0) {
        chartEl.innerHTML = '<p style="color:#8892a4; padding:20px">Nenhuma partida Turbo encontrada.</p>';
        return;
    }

    // Calcula médias das últimas 20
    let totalK = 0, totalD = 0, totalA = 0, totalDmg = 0, wins = 0;
    last20.forEach(m => {
        totalK += m.kills || 0;
        totalD += m.deaths || 0;
        totalA += m.assists || 0;
        totalDmg += m.hero_damage || 0;
        const isWin = (m.player_slot < 128 && m.radiant_win) ||
                      (m.player_slot >= 128 && !m.radiant_win);
        if (isWin) wins++;
    });

    const n = last20.length;
    const recentWR = ((wins / n) * 100).toFixed(0);

    // Gráfico de barras
    let barsHtml = '<div class="perf-bars">';
    last20.forEach(m => {
        const isWin = (m.player_slot < 128 && m.radiant_win) ||
                      (m.player_slot >= 128 && !m.radiant_win);
        const kda = m.kills + m.assists;
        const maxKda = 40;
        const heightPct = Math.min((kda / maxKda) * 100, 100);
        const color = isWin ? 'var(--win-green)' : 'var(--loss-red)';
        const hero = heroConstants[m.hero_id];
        const heroName = hero ? hero.localized_name : '?';

        barsHtml += `
            <div class="perf-bar-col" title="${heroName}: ${m.kills}/${m.deaths}/${m.assists} — ${isWin ? 'WIN' : 'LOSS'}">
                <div class="perf-bar" style="height:${heightPct}%; background:${color}"></div>
                <div class="perf-bar-label">${isWin ? 'W' : 'L'}</div>
            </div>
        `;
    });
    barsHtml += '</div>';

    chartEl.innerHTML = barsHtml;

    // Médias comparativas
    const recentWRColor = parseInt(recentWR) >= 50 ? 'var(--win-green)' : 'var(--loss-red)';
    avgEl.innerHTML = `
        <div class="perf-avg-row">
            <span class="perf-avg-label">ÚLTIMAS ${n} PARTIDAS</span>
            <span class="perf-avg-value" style="color:${recentWRColor}">${recentWR}% WIN RATE</span>
        </div>
        <div class="perf-avg-row">
            <span class="perf-avg-label">K/D/A MÉDIO</span>
            <span class="perf-avg-value">${(totalK/n).toFixed(1)} / ${(totalD/n).toFixed(1)} / ${(totalA/n).toFixed(1)}</span>
        </div>
        <div class="perf-avg-row">
            <span class="perf-avg-label">DANO MÉDIO</span>
            <span class="perf-avg-value" style="color:#ff9966">${((totalDmg/n)/1000).toFixed(1)}k</span>
        </div>
    `;
}
