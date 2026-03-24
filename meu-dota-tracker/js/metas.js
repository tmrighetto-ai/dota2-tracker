/**
 * Módulo Metas no Turbo
 * Recria o recurso "Performance Goals" do Dota Plus, adaptado para Turbo.
 *
 * Fontes de dados:
 * 1. Benchmarks OpenDota (/api/benchmarks?hero_id=X) — percentis globais
 * 2. Histórico pessoal do jogador no Turbo (partidas já carregadas)
 *
 * Multiplicadores Turbo vs Normal:
 * - Tempo: 0.5x (partidas ~50% mais curtas)
 * - GPM: 1.35x (gold passivo maior)
 * - Net Worth: 0.65x nos marcos de tempo
 * - XPM: 1.4x (experiência mais rápida)
 * - Kills/min: 1.5x (lutas mais frequentes)
 * - Last Hits/min: 1.2x (mais gold passivo, farm mais rápido)
 */

// ============================================
// CONSTANTES E MULTIPLICADORES TURBO
// ============================================

const TURBO_MULT = {
    gold_per_min:        1.35,   // GPM mais alto pelo gold passivo
    xp_per_min:          1.40,   // XPM mais alto
    kills_per_min:       1.50,   // Mais lutas, mais kills por minuto
    last_hits_per_min:   1.20,   // Farm levemente mais rápido
    hero_damage_per_min: 1.30,   // Mais dano por minuto (lutas mais frequentes)
    hero_healing_per_min:1.20,   // Mais cura por minuto
    tower_damage:        0.70    // Menos dano em torre (jogo mais curto)
};

// Fases do jogo no Turbo (em minutos)
const FASES_TURBO = {
    early: { nome: 'Early Game',  min: 0,  max: 5,  icone: '🌅' },
    mid:   { nome: 'Mid Game',    min: 5,  max: 12, icone: '⚔️' },
    late:  { nome: 'Late Game',   min: 12, max: 25, icone: '🏆' }
};

// GPM esperado por posição no Turbo (usado para estimar NW por fase)
const GPM_POR_POSICAO = {
    1: { early: 550, mid: 850, late: 1000 },  // Hard Carry
    2: { early: 500, mid: 800, late: 900 },   // Mid
    3: { early: 400, mid: 650, late: 750 },   // Offlane
    4: { early: 250, mid: 400, late: 550 },   // Suporte
    5: { early: 200, mid: 350, late: 450 }    // Hard Suporte
};

// Kills esperadas por posição por fase (acumuladas até o fim da fase)
const KILLS_POR_POSICAO = {
    1: { early: 2,  mid: 7,  late: 14 },
    2: { early: 3,  mid: 8,  late: 15 },
    3: { early: 2,  mid: 6,  late: 11 },
    4: { early: 1,  mid: 4,  late: 8 },
    5: { early: 0,  mid: 3,  late: 6 }
};

// Deaths esperadas por posição por fase
const DEATHS_POR_POSICAO = {
    1: { early: 1, mid: 3, late: 5 },
    2: { early: 1, mid: 3, late: 5 },
    3: { early: 2, mid: 4, late: 7 },
    4: { early: 2, mid: 5, late: 8 },
    5: { early: 2, mid: 5, late: 9 }
};

// Assists esperadas por posição por fase
const ASSISTS_POR_POSICAO = {
    1: { early: 2,  mid: 8,  late: 16 },
    2: { early: 2,  mid: 7,  late: 14 },
    3: { early: 3,  mid: 9,  late: 18 },
    4: { early: 3,  mid: 11, late: 22 },
    5: { early: 3,  mid: 11, late: 22 }
};

// Last Hits esperados por posição por fase
const LH_POR_POSICAO = {
    1: { early: 40,  mid: 150, late: 280 },
    2: { early: 35,  mid: 130, late: 250 },
    3: { early: 25,  mid: 90,  late: 170 },
    4: { early: 10,  mid: 35,  late: 60 },
    5: { early: 5,   mid: 20,  late: 40 }
};

// Denies esperados por posição por fase
const DN_POR_POSICAO = {
    1: { early: 5,  mid: 12, late: 15 },
    2: { early: 8,  mid: 15, late: 18 },
    3: { early: 4,  mid: 8,  late: 10 },
    4: { early: 3,  mid: 5,  late: 7 },
    5: { early: 4,  mid: 7,  late: 9 }
};

// Nomes amigáveis das stats
const STAT_NOMES = {
    gold_per_min:        'GPM',
    xp_per_min:          'XPM',
    kills_per_min:       'Kills/min',
    last_hits_per_min:   'Last Hits/min',
    hero_damage_per_min: 'Dano/min',
    hero_healing_per_min:'Cura/min',
    tower_damage:        'Dano em Torres'
};

// Cache de benchmarks já buscados
let metasBenchmarkCache = {};

// Estado do módulo
let metasHeroConstants = null;
let metasItemConstants = null;
let metasGeradas = false;

// ============================================
// FUNÇÕES DE API
// ============================================

/**
 * Busca benchmarks de um herói na OpenDota.
 * Retorna percentis de performance (GPM, XPM, kills/min, LH/min, dano/min, etc.)
 */
async function fetchBenchmarks(heroId) {
    if (metasBenchmarkCache[heroId]) {
        return metasBenchmarkCache[heroId];
    }
    try {
        const data = await apiFetch(`https://api.opendota.com/api/benchmarks?hero_id=${heroId}`);
        metasBenchmarkCache[heroId] = data;
        return data;
    } catch (error) {
        console.error('Erro ao buscar benchmarks:', error);
        return null;
    }
}

/**
 * Busca partidas do jogador com um herói específico no Turbo.
 * Usa as partidas já carregadas globalmente (globalMatches).
 */
function getPartidasPessoais(heroId) {
    if (!globalMatches || globalMatches.length === 0) return [];
    return globalMatches.filter(m => m.hero_id === heroId);
}

// ============================================
// CÁLCULOS DE METAS
// ============================================

/**
 * Extrai o valor de um percentil específico dos benchmarks.
 * Percentil 0.5 = mediano, 0.75 = bom, 0.9 = excelente.
 */
function getValorBenchmark(benchmarks, stat, percentil) {
    if (!benchmarks || !benchmarks.result || !benchmarks.result[stat]) return null;

    const entries = benchmarks.result[stat];
    // Encontra o entry mais próximo do percentil desejado
    let closest = entries[0];
    let minDiff = Math.abs(entries[0].percentile - percentil);

    for (const entry of entries) {
        const diff = Math.abs(entry.percentile - percentil);
        if (diff < minDiff) {
            minDiff = diff;
            closest = entry;
        }
    }
    return closest ? closest.value : null;
}

/**
 * Calcula a média pessoal do jogador para uma stat específica.
 */
function calcularMediaPessoal(partidas, campo) {
    if (!partidas || partidas.length === 0) return null;

    let soma = 0;
    let count = 0;
    partidas.forEach(m => {
        if (m[campo] !== undefined && m[campo] !== null) {
            soma += m[campo];
            count++;
        }
    });
    return count > 0 ? soma / count : null;
}

/**
 * Calcula as metas para um herói específico em uma posição.
 * Combina benchmarks globais (ajustados para Turbo) com dados pessoais.
 *
 * Retorna objeto com metas por fase e comparação pessoal.
 */
async function calcularMetas(heroId, posicao) {
    const benchmarks = await fetchBenchmarks(heroId);
    const partidasPessoais = getPartidasPessoais(heroId);
    const pos = parseInt(posicao) || 1;

    // Benchmark no percentil 50 (mediano) — é a "meta base"
    // Benchmark no percentil 75 — "meta boa"
    const gpmBase = getValorBenchmark(benchmarks, 'gold_per_min', 0.5);
    const gpmBom  = getValorBenchmark(benchmarks, 'gold_per_min', 0.75);
    const xpmBase = getValorBenchmark(benchmarks, 'xp_per_min', 0.5);
    const xpmBom  = getValorBenchmark(benchmarks, 'xp_per_min', 0.75);
    const killsMinBase = getValorBenchmark(benchmarks, 'kills_per_min', 0.5);
    const lhMinBase = getValorBenchmark(benchmarks, 'last_hits_per_min', 0.5);
    const dmgMinBase = getValorBenchmark(benchmarks, 'hero_damage_per_min', 0.5);
    const healMinBase = getValorBenchmark(benchmarks, 'hero_healing_per_min', 0.5);
    const towerBase = getValorBenchmark(benchmarks, 'tower_damage', 0.5);

    // Médias pessoais do jogador
    const pessoalGPM = calcularMediaPessoal(partidasPessoais, 'gold_per_min');
    const pessoalXPM = calcularMediaPessoal(partidasPessoais, 'xp_per_min');
    const pessoalKills = calcularMediaPessoal(partidasPessoais, 'kills');
    const pessoalDeaths = calcularMediaPessoal(partidasPessoais, 'deaths');
    const pessoalAssists = calcularMediaPessoal(partidasPessoais, 'assists');
    const pessoalLH = calcularMediaPessoal(partidasPessoais, 'last_hits');
    const pessoalDmg = calcularMediaPessoal(partidasPessoais, 'hero_damage');
    const pessoalDuracao = calcularMediaPessoal(partidasPessoais, 'duration');

    // Ajusta benchmarks para Turbo (multiplicadores)
    const gpmTurbo = gpmBase ? Math.round(gpmBase * TURBO_MULT.gold_per_min) : null;
    const xpmTurbo = xpmBase ? Math.round(xpmBase * TURBO_MULT.xp_per_min) : null;

    // Metas por fase usando tabelas de posição
    const gpmFase = GPM_POR_POSICAO[pos] || GPM_POR_POSICAO[1];
    const killsFase = KILLS_POR_POSICAO[pos] || KILLS_POR_POSICAO[1];
    const deathsFase = DEATHS_POR_POSICAO[pos] || DEATHS_POR_POSICAO[1];
    const assistsFase = ASSISTS_POR_POSICAO[pos] || ASSISTS_POR_POSICAO[1];
    const lhFase = LH_POR_POSICAO[pos] || LH_POR_POSICAO[1];
    const dnFase = DN_POR_POSICAO[pos] || DN_POR_POSICAO[1];

    // Monta resultado por fase
    const fases = {};
    for (const [faseKey, faseInfo] of Object.entries(FASES_TURBO)) {
        const tempoMedio = (faseInfo.min + faseInfo.max) / 2;

        // Net Worth estimado = GPM da fase * tempo médio da fase em minutos
        const nwMeta = Math.round(gpmFase[faseKey] * tempoMedio);

        fases[faseKey] = {
            nome: faseInfo.nome,
            icone: faseInfo.icone,
            tempo: `${faseInfo.min}-${faseInfo.max} min`,
            stats: {
                kda: {
                    nome: 'K / D / A',
                    meta: `${killsFase[faseKey]} / ${deathsFase[faseKey]} / ${assistsFase[faseKey]}`,
                    metaK: killsFase[faseKey],
                    metaD: deathsFase[faseKey],
                    metaA: assistsFase[faseKey]
                },
                lh_dn: {
                    nome: 'LH / DN',
                    meta: `${lhFase[faseKey]} / ${dnFase[faseKey]}`,
                    metaLH: lhFase[faseKey],
                    metaDN: dnFase[faseKey]
                },
                nw: {
                    nome: 'Net Worth',
                    meta: nwMeta,
                    formatado: formatarNumero(nwMeta)
                },
                gpm: {
                    nome: 'GPM',
                    meta: gpmFase[faseKey]
                },
                xpm: {
                    nome: 'XPM',
                    meta: xpmTurbo || Math.round(gpmFase[faseKey] * 1.1)
                }
            }
        };
    }

    // Dados pessoais para comparação
    const pessoal = {
        gpm: pessoalGPM ? Math.round(pessoalGPM) : null,
        xpm: pessoalXPM ? Math.round(pessoalXPM) : null,
        kills: pessoalKills ? Math.round(pessoalKills * 10) / 10 : null,
        deaths: pessoalDeaths ? Math.round(pessoalDeaths * 10) / 10 : null,
        assists: pessoalAssists ? Math.round(pessoalAssists * 10) / 10 : null,
        lh: pessoalLH ? Math.round(pessoalLH) : null,
        dn: null, // API /recentMatches não retorna denies
        dmg: pessoalDmg ? Math.round(pessoalDmg) : null,
        duracao: pessoalDuracao ? Math.round(pessoalDuracao / 60) : null,
        partidas: partidasPessoais.length
    };

    // Benchmarks globais (ajustados para Turbo) para referência
    const benchGlobal = {
        gpm: gpmTurbo,
        gpmBom: gpmBom ? Math.round(gpmBom * TURBO_MULT.gold_per_min) : null,
        xpm: xpmTurbo,
        killsMin: killsMinBase ? Math.round(killsMinBase * TURBO_MULT.kills_per_min * 100) / 100 : null,
        lhMin: lhMinBase ? Math.round(lhMinBase * TURBO_MULT.last_hits_per_min * 10) / 10 : null,
        dmgMin: dmgMinBase ? Math.round(dmgMinBase * TURBO_MULT.hero_damage_per_min) : null,
        towerDmg: towerBase ? Math.round(towerBase * TURBO_MULT.tower_damage) : null
    };

    return { fases, pessoal, benchGlobal, heroId, posicao: pos };
}

// ============================================
// RENDERIZAÇÃO
// ============================================

/**
 * Gera as metas para o herói atualmente visualizado no simulador.
 */
async function gerarMetas() {
    const container = document.getElementById('metas-result');
    if (!container) return;

    // Pega o herói e posição do simulador
    const team = simVisualizandoTeam || 'ally';
    const index = simVisualizandoIndex || 0;
    const heroId = simSelectedHeroes[team][index];
    const posArray = team === 'enemy' ? simEnemyPositions : simPositions;
    const posicao = posArray[index];

    if (!heroId) {
        container.innerHTML = `
            <div class="metas-aviso">
                <p>Selecione um herói no simulador acima e gere as recomendações primeiro.</p>
            </div>`;
        container.classList.remove('hidden');
        return;
    }

    if (!posicao) {
        container.innerHTML = `
            <div class="metas-aviso">
                <p>Selecione a posição do herói no simulador para calcular as metas.</p>
            </div>`;
        container.classList.remove('hidden');
        return;
    }

    // Loading
    container.innerHTML = `
        <div class="metas-loading">
            <div class="loader-small"></div>
            <p>Calculando metas para Turbo...</p>
        </div>`;
    container.classList.remove('hidden');

    try {
        const heroInfo = metasHeroConstants ? metasHeroConstants[heroId] : null;
        const heroNome = heroInfo ? heroInfo.localized_name : `Herói ${heroId}`;
        const heroImgName = heroInfo ? heroInfo.name.replace('npc_dota_hero_', '') : '';
        const heroImg = heroImgName ? `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${heroImgName}.png` : '';

        const metas = await calcularMetas(heroId, posicao);

        // Renderiza
        let html = '';

        // Header do herói
        html += `
        <div class="metas-header">
            <img src="${heroImg}" alt="${heroNome}" class="metas-hero-img">
            <div class="metas-hero-info">
                <h3 class="metas-hero-name">${heroNome}</h3>
                <span class="metas-hero-pos">Posição ${posicao} — ${getNomePosicao(posicao)}</span>
                ${metas.pessoal.partidas > 0
                    ? `<span class="metas-hero-partidas">${metas.pessoal.partidas} partidas Turbo com este herói</span>`
                    : `<span class="metas-hero-partidas metas-sem-dados">Sem partidas Turbo com este herói</span>`
                }
            </div>
        </div>`;

        // Benchmarks globais (resumo rápido)
        html += `
        <div class="metas-bench-resumo">
            <span class="metas-bench-label">Benchmarks Turbo (mediana global):</span>
            <div class="metas-bench-chips">
                ${metas.benchGlobal.gpm ? `<span class="metas-chip"><b>GPM</b> ${metas.benchGlobal.gpm}</span>` : ''}
                ${metas.benchGlobal.xpm ? `<span class="metas-chip"><b>XPM</b> ${metas.benchGlobal.xpm}</span>` : ''}
                ${metas.benchGlobal.lhMin ? `<span class="metas-chip"><b>LH/min</b> ${metas.benchGlobal.lhMin}</span>` : ''}
                ${metas.benchGlobal.dmgMin ? `<span class="metas-chip"><b>Dano/min</b> ${metas.benchGlobal.dmgMin}</span>` : ''}
            </div>
        </div>`;

        // Tabela de metas por fase
        html += `<div class="metas-fases">`;

        for (const [faseKey, fase] of Object.entries(metas.fases)) {
            html += `
            <div class="metas-fase-card metas-fase-${faseKey}">
                <div class="metas-fase-header">
                    <span class="metas-fase-icone">${fase.icone}</span>
                    <span class="metas-fase-nome">${fase.nome}</span>
                    <span class="metas-fase-tempo">${fase.tempo}</span>
                </div>
                <table class="metas-tabela">
                    <thead>
                        <tr>
                            <th>Stat</th>
                            ${metas.pessoal.partidas > 0 ? '<th>Sua Média</th>' : ''}
                            <th>Meta Turbo</th>
                        </tr>
                    </thead>
                    <tbody>`;

            // Proporções para estimar stats pessoais por fase
            // (dados pessoais são totais da partida, precisamos estimar por fase)
            const proporcao = { early: 0.20, mid: 0.55, late: 1.0 };
            const prop = proporcao[faseKey];

            // Tempo médio da fase em minutos (para estimar NW)
            const tempoMedioFase = (FASES_TURBO[faseKey].min + FASES_TURBO[faseKey].max) / 2;

            // K/D/A — estimado proporcionalmente por fase
            const kdaMeta = fase.stats.kda;
            let kdaPessoalHTML = '';
            if (metas.pessoal.partidas > 0 && metas.pessoal.kills !== null) {
                const kEst = Math.round(metas.pessoal.kills * prop * 10) / 10;
                const dEst = Math.round(metas.pessoal.deaths * prop * 10) / 10;
                const aEst = Math.round(metas.pessoal.assists * prop * 10) / 10;
                const kOk = kEst >= kdaMeta.metaK;
                const dOk = dEst <= kdaMeta.metaD;
                const aOk = aEst >= kdaMeta.metaA;
                kdaPessoalHTML = `<td class="metas-valor-pessoal">
                    <span class="${kOk ? 'metas-bom' : 'metas-ruim'}">${kEst}</span> /
                    <span class="${dOk ? 'metas-bom' : 'metas-ruim'}">${dEst}</span> /
                    <span class="${aOk ? 'metas-bom' : 'metas-ruim'}">${aEst}</span>
                </td>`;
            }
            html += `<tr>
                <td class="metas-stat-nome">K / D / A</td>
                ${kdaPessoalHTML}
                <td class="metas-valor-meta">${kdaMeta.meta}</td>
            </tr>`;

            // LH / DN — LH estimado por fase, DN não disponível na API
            const lhMeta = fase.stats.lh_dn;
            let lhPessoalHTML = '';
            if (metas.pessoal.partidas > 0 && metas.pessoal.lh !== null) {
                const lhEstimado = Math.round(metas.pessoal.lh * prop);
                const lhOk = lhEstimado >= lhMeta.metaLH;
                lhPessoalHTML = `<td class="metas-valor-pessoal">
                    <span class="${lhOk ? 'metas-bom' : 'metas-ruim'}">${lhEstimado}</span> / —
                </td>`;
            }
            html += `<tr>
                <td class="metas-stat-nome">LH / DN</td>
                ${lhPessoalHTML}
                <td class="metas-valor-meta">${lhMeta.meta}</td>
            </tr>`;

            // Net Worth — estimado do GPM pessoal × tempo médio da fase
            const nwMeta = fase.stats.nw;
            let nwPessoalHTML = '';
            if (metas.pessoal.partidas > 0 && metas.pessoal.gpm !== null) {
                const nwEstimado = Math.round(metas.pessoal.gpm * tempoMedioFase);
                const nwOk = nwEstimado >= nwMeta.meta;
                nwPessoalHTML = `<td class="metas-valor-pessoal">
                    <span class="${nwOk ? 'metas-bom' : 'metas-ruim'}">${formatarNumero(nwEstimado)}</span>
                </td>`;
            }
            html += `<tr>
                <td class="metas-stat-nome">Net Worth</td>
                ${nwPessoalHTML}
                <td class="metas-valor-meta">${nwMeta.formatado}</td>
            </tr>`;

            // GPM — taxa, mesma em todas as fases
            const gpmMeta = fase.stats.gpm;
            let gpmPessoalHTML = '';
            if (metas.pessoal.partidas > 0 && metas.pessoal.gpm !== null) {
                const gpmOk = metas.pessoal.gpm >= gpmMeta.meta;
                gpmPessoalHTML = `<td class="metas-valor-pessoal">
                    <span class="${gpmOk ? 'metas-bom' : 'metas-ruim'}">${metas.pessoal.gpm}</span>
                </td>`;
            }
            html += `<tr>
                <td class="metas-stat-nome">GPM</td>
                ${gpmPessoalHTML}
                <td class="metas-valor-meta">${gpmMeta.meta}</td>
            </tr>`;

            // XPM — taxa, mesma em todas as fases
            const xpmMeta = fase.stats.xpm;
            let xpmPessoalHTML = '';
            if (metas.pessoal.partidas > 0 && metas.pessoal.xpm !== null) {
                const xpmOk = metas.pessoal.xpm >= xpmMeta.meta;
                xpmPessoalHTML = `<td class="metas-valor-pessoal">
                    <span class="${xpmOk ? 'metas-bom' : 'metas-ruim'}">${metas.pessoal.xpm}</span>
                </td>`;
            }
            html += `<tr>
                <td class="metas-stat-nome">XPM</td>
                ${xpmPessoalHTML}
                <td class="metas-valor-meta">${xpmMeta.meta}</td>
            </tr>`;

            html += `</tbody></table></div>`;
        }

        html += `</div>`; // fecha metas-fases

        // Dicas contextuais
        html += renderizarDicas(metas, heroNome);

        container.innerHTML = html;
        metasGeradas = true;

    } catch (error) {
        console.error('Erro ao gerar metas:', error);
        container.innerHTML = `
            <div class="metas-aviso metas-erro">
                <p>Erro ao calcular metas. Tente novamente.</p>
            </div>`;
    }
}

/**
 * Renderiza dicas contextuais baseadas na comparação pessoal vs meta.
 */
function renderizarDicas(metas, heroNome) {
    const dicas = [];
    const p = metas.pessoal;
    const lateMetas = metas.fases.late.stats;

    if (p.partidas === 0) {
        dicas.push({
            tipo: 'info',
            texto: `Você ainda não tem partidas Turbo com ${heroNome}. As metas mostradas são baseadas em benchmarks globais ajustados para Turbo.`
        });
        return renderDicasHTML(dicas);
    }

    // Compara GPM
    if (p.gpm !== null && lateMetas.gpm.meta) {
        if (p.gpm >= lateMetas.gpm.meta) {
            dicas.push({
                tipo: 'bom',
                texto: `Seu GPM (${p.gpm}) está acima da meta (${lateMetas.gpm.meta}). Bom farm!`
            });
        } else {
            const diff = lateMetas.gpm.meta - p.gpm;
            dicas.push({
                tipo: 'melhorar',
                texto: `Seu GPM (${p.gpm}) está ${diff} abaixo da meta (${lateMetas.gpm.meta}). Tente focar mais no farm entre as lutas.`
            });
        }
    }

    // Compara Deaths
    if (p.deaths !== null) {
        const deathMeta = lateMetas.kda.metaD;
        if (p.deaths > deathMeta + 2) {
            dicas.push({
                tipo: 'melhorar',
                texto: `Média de ${p.deaths} mortes — acima da meta de ${deathMeta}. Jogar mais seguro pode melhorar muito seu impacto.`
            });
        } else if (p.deaths <= deathMeta) {
            dicas.push({
                tipo: 'bom',
                texto: `Média de ${p.deaths} mortes — dentro ou abaixo da meta de ${deathMeta}. Bom posicionamento!`
            });
        }
    }

    // Compara LH (se core)
    if (metas.posicao <= 3 && p.lh !== null) {
        const lhMeta = lateMetas.lh_dn.metaLH;
        if (p.lh < lhMeta * 0.8) {
            dicas.push({
                tipo: 'melhorar',
                texto: `Seus Last Hits (${p.lh}) estão abaixo da meta (${lhMeta}). Na Turbo o farm é mais rápido — aproveite!`
            });
        }
    }

    if (dicas.length === 0) {
        dicas.push({
            tipo: 'info',
            texto: `Dados baseados em ${p.partidas} partida(s) Turbo. Jogue mais para metas mais precisas.`
        });
    }

    return renderDicasHTML(dicas);
}

function renderDicasHTML(dicas) {
    if (dicas.length === 0) return '';

    let html = `<div class="metas-dicas">
        <h4 class="metas-dicas-titulo">Análise</h4>`;

    dicas.forEach(d => {
        const icone = d.tipo === 'bom' ? '✅' : d.tipo === 'melhorar' ? '⚠️' : 'ℹ️';
        html += `<div class="metas-dica metas-dica-${d.tipo}">
            <span class="metas-dica-icone">${icone}</span>
            <span>${d.texto}</span>
        </div>`;
    });

    html += `</div>`;
    return html;
}

// ============================================
// UTILIDADES
// ============================================

function getNomePosicao(pos) {
    const nomes = {
        1: 'Hard Carry',
        2: 'Mid',
        3: 'Offlane',
        4: 'Suporte',
        5: 'Hard Suporte'
    };
    return nomes[pos] || 'Desconhecido';
}

function formatarNumero(num) {
    if (num >= 1000) {
        return (num / 1000).toFixed(1).replace('.0', '') + 'k';
    }
    return num.toString();
}

// ============================================
// INICIALIZAÇÃO
// ============================================

/**
 * Inicializa o módulo de Metas.
 * Chamado pelo main.js após carregar os dados.
 */
function initMetas(heroConstants, itemConstants) {
    metasHeroConstants = heroConstants;
    metasItemConstants = itemConstants;
    metasGeradas = false;

    const btnGerar = document.getElementById('btn-gerar-metas');
    if (btnGerar) {
        btnGerar.onclick = gerarMetas;
    }
}
