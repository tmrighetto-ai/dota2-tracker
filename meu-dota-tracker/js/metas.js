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

// Na Turbo, o gold passivo é DOBRADO e a XP é muito mais alta.
// O efeito composto (gold passivo + itens acelerando farm) resulta em
// multiplicadores efetivos bem maiores que o raw 1.5x do gold passivo.
const TURBO_MULT = {
    gold_per_min:        1.85,   // GPM efetivo ~1.85x (gold passivo 2x + farm acelerado)
    xp_per_min:          1.80,   // XPM efetivo ~1.8x (XP passiva maior + levels mais rápidos)
    kills_per_min:       1.60,   // Mais lutas, mais kills por minuto
    last_hits_per_min:   1.40,   // Farm mais rápido (itens antes = clear mais rápido)
    hero_damage_per_min: 1.50,   // Mais dano por minuto (lutas mais frequentes + itens)
    hero_healing_per_min:1.40,   // Mais cura por minuto
    tower_damage:        0.80    // Menos dano em torre (jogo mais curto mas itens antes)
};

// Fases do jogo no Turbo (em minutos)
const FASES_TURBO = {
    early: { nome: 'Early Game',  min: 0,  max: 5,  icone: '🌅' },
    mid:   { nome: 'Mid Game',    min: 5,  max: 12, icone: '⚔️' },
    late:  { nome: 'Late Game',   min: 12, max: 25, icone: '🏆' }
};

// GPM esperado por posição no TURBO
// Gold passivo é DOBRADO na Turbo. Efeito composto: gold passivo 2x + itens antes
// = farm ainda mais rápido. Valores baseados em dados reais de partidas Turbo.
const GPM_POR_POSICAO = {
    1: { early: 800,  mid: 1300, late: 1600 },  // Hard Carry — farm absurdo
    2: { early: 750,  mid: 1200, late: 1450 },  // Mid — farm alto + ganks
    3: { early: 550,  mid: 900,  late: 1150 },  // Offlane
    4: { early: 400,  mid: 700,  late: 900 },   // Suporte — gold passivo ajuda muito
    5: { early: 350,  mid: 600,  late: 800 }    // Hard Suporte
};

// Kills esperadas por posição por fase no TURBO (acumuladas)
// Turbo: lutas mais cedo, mais frequentes, snowball mais rápido
const KILLS_POR_POSICAO = {
    1: { early: 3,  mid: 10, late: 18 },
    2: { early: 4,  mid: 11, late: 20 },
    3: { early: 3,  mid: 8,  late: 14 },
    4: { early: 2,  mid: 6,  late: 10 },
    5: { early: 1,  mid: 4,  late: 8 }
};

// Deaths esperadas por posição por fase no TURBO
const DEATHS_POR_POSICAO = {
    1: { early: 1, mid: 3, late: 6 },
    2: { early: 1, mid: 3, late: 6 },
    3: { early: 2, mid: 5, late: 8 },
    4: { early: 2, mid: 5, late: 9 },
    5: { early: 3, mid: 6, late: 10 }
};

// Assists esperadas por posição por fase no TURBO
const ASSISTS_POR_POSICAO = {
    1: { early: 3,  mid: 10, late: 20 },
    2: { early: 3,  mid: 9,  late: 18 },
    3: { early: 4,  mid: 12, late: 22 },
    4: { early: 5,  mid: 15, late: 28 },
    5: { early: 5,  mid: 15, late: 28 }
};

// Last Hits esperados por posição por fase no TURBO
// Farm acelerado: itens mais cedo = clear de wave mais rápido
const LH_POR_POSICAO = {
    1: { early: 55,  mid: 200, late: 380 },
    2: { early: 50,  mid: 180, late: 340 },
    3: { early: 35,  mid: 120, late: 220 },
    4: { early: 15,  mid: 50,  late: 90 },
    5: { early: 8,   mid: 30,  late: 55 }
};

// Denies esperados por posição por fase no TURBO
// Menos relevante na Turbo — foco é em farm e lutas
const DN_POR_POSICAO = {
    1: { early: 3,  mid: 6,  late: 8 },
    2: { early: 5,  mid: 8,  late: 10 },
    3: { early: 3,  mid: 5,  late: 7 },
    4: { early: 2,  mid: 3,  late: 4 },
    5: { early: 2,  mid: 4,  late: 5 }
};

// XPM esperado por posição no TURBO
// XP passiva muito maior + levels mais rápidos = snowball de XP
const XPM_POR_POSICAO = {
    1: { early: 1000, mid: 1500, late: 1850 },  // Hard Carry
    2: { early: 1100, mid: 1700, late: 2000 },  // Mid — maior XPM
    3: { early: 900,  mid: 1350, late: 1650 },  // Offlane
    4: { early: 700,  mid: 1100, late: 1350 },  // Suporte
    5: { early: 600,  mid: 950,  late: 1200 }   // Hard Suporte
};

// DPM (Dano por Minuto) esperado por posição no TURBO
// Teamfights mais frequentes + itens antes = DPM muito alto
const DPM_POR_POSICAO = {
    1: { early: 400,  mid: 750,  late: 1100 },  // Hard Carry — dano escala com itens
    2: { early: 500,  mid: 850,  late: 1150 },  // Mid — burst damage alto
    3: { early: 350,  mid: 600,  late: 850 },   // Offlane — dano moderado
    4: { early: 250,  mid: 450,  late: 650 },   // Suporte — dano de habilidades
    5: { early: 180,  mid: 350,  late: 500 }    // Hard Suporte — menor dano
};

// Proporções de progressão por fase para taxas (GPM, XPM, DPM)
// Early o jogador ainda está crescendo, Mid estabiliza, Late é o pico
const TAXA_PROGRESSAO = { early: 0.55, mid: 0.85, late: 1.0 };

// Ajuste de benchmark por posição
// Os benchmarks do OpenDota são medianas globais (mistura de todas as posições).
// Posições de core têm GPM/XPM muito acima da mediana, suportes abaixo.
// Estes fatores ajustam o benchmark para refletir a posição real.
const AJUSTE_POSICAO = {
    1: { gpm: 1.25, xpm: 1.10, dpm: 1.20 },  // Hard Carry — GPM bem acima da média
    2: { gpm: 1.15, xpm: 1.15, dpm: 1.25 },  // Mid — XPM e dano mais altos
    3: { gpm: 0.95, xpm: 1.00, dpm: 0.95 },  // Offlane — próximo da média
    4: { gpm: 0.75, xpm: 0.85, dpm: 0.80 },  // Suporte — farm reduzido
    5: { gpm: 0.60, xpm: 0.75, dpm: 0.65 }   // Hard Suporte — menor farm/dano
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

// Cache de benchmarks já buscados (em memória — leve, não precisa persistir)
let metasBenchmarkCache = {};

// Cache de detalhes de partidas — persiste no sessionStorage
// Sobrevive a F5 (recarregar), mas limpa ao fechar a aba
// Economiza chamadas da API durante testes e navegação
let matchDetailCache = {};

// Carrega cache do sessionStorage ao iniciar
try {
    const saved = sessionStorage.getItem('matchDetailCache');
    if (saved) {
        matchDetailCache = JSON.parse(saved);
        console.log(`Cache carregado: ${Object.keys(matchDetailCache).length} partidas do sessionStorage`);
    }
} catch (e) {
    console.warn('Erro ao carregar cache do sessionStorage:', e);
}

// Salva cache no sessionStorage (chamada após buscar novos detalhes)
function salvarCacheNoSession() {
    try {
        sessionStorage.setItem('matchDetailCache', JSON.stringify(matchDetailCache));
    } catch (e) {
        console.warn('Erro ao salvar cache no sessionStorage:', e);
    }
}

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
 * Enriquece com dados de denies buscando detalhes das partidas.
 */
async function getPartidasPessoais(heroId) {
    if (!globalMatches || globalMatches.length === 0) return [];
    const partidas = globalMatches.filter(m => m.hero_id === heroId);

    // Partidas do /matches?significant=0 têm kills mas NÃO têm gold_per_min, hero_damage, etc.
    // Precisa buscar detalhes da API para preencher esses campos.

    // Primeiro: preenche partidas que já estão no cache (sem gastar chamadas da API)
    const semDetalhes = partidas.filter(m => m.gold_per_min === undefined || m.gold_per_min === null);
    let preenchidosDoCache = 0;

    for (const partida of semDetalhes) {
        const cached = matchDetailCache[partida.match_id];
        if (cached) {
            Object.assign(partida, cached);
            preenchidosDoCache++;
        }
    }

    // Só busca na API as que ainda faltam (não estavam no cache)
    const paraBuscar = partidas.filter(m => m.gold_per_min === undefined || m.gold_per_min === null);

    if (preenchidosDoCache > 0) {
        console.log(`Metas: ${preenchidosDoCache} partidas carregadas do cache (sem gastar API)`);
    }
    if (paraBuscar.length > 0) {
        console.log(`Metas: buscando detalhes de ${paraBuscar.length} partidas na API...`);
    }

    // Busca detalhes em sequência com delay para não estourar rate limit da API
    for (let i = 0; i < paraBuscar.length; i++) {
        const partida = paraBuscar[i];
        try {
            const detail = await apiFetch(
                `https://api.opendota.com/api/matches/${partida.match_id}`
            );
            if (detail && detail.players) {
                const jogador = detail.players.find(p =>
                    (globalAccountId && p.account_id && p.account_id.toString() === globalAccountId.toString()) ||
                    p.player_slot === partida.player_slot
                );
                if (jogador) {
                    // Monta objeto com os campos para cache e preenchimento
                    const dados = {};
                    if (jogador.kills !== undefined) dados.kills = jogador.kills;
                    if (jogador.deaths !== undefined) dados.deaths = jogador.deaths;
                    if (jogador.assists !== undefined) dados.assists = jogador.assists;
                    if (jogador.gold_per_min !== undefined) dados.gold_per_min = jogador.gold_per_min;
                    if (jogador.xp_per_min !== undefined) dados.xp_per_min = jogador.xp_per_min;
                    if (jogador.last_hits !== undefined) dados.last_hits = jogador.last_hits;
                    if (jogador.denies !== undefined) dados.denies = jogador.denies;
                    if (jogador.hero_damage !== undefined) dados.hero_damage = jogador.hero_damage;
                    if (jogador.net_worth !== undefined) dados.net_worth = jogador.net_worth;

                    // Salva no cache e preenche a partida
                    matchDetailCache[partida.match_id] = dados;
                    Object.assign(partida, dados);
                }
            }
        } catch (e) {
            console.warn('Erro ao buscar detalhes da partida:', partida.match_id, e);
        }
        // Delay de 200ms entre chamadas para respeitar o rate limit
        if (i < paraBuscar.length - 1) {
            await new Promise(r => setTimeout(r, 200));
        }
    }

    // Salva cache no sessionStorage para sobreviver a F5
    if (paraBuscar.length > 0) {
        salvarCacheNoSession();
    }

    // Retorna TODAS as partidas — calcularMediaPessoal() já ignora campos indefinidos.
    // Kills/deaths/assists usam todas as partidas; GPM/XPM usam só as enriquecidas.
    const enriquecidas = partidas.filter(m => m.gold_per_min !== undefined && m.gold_per_min !== null);
    console.log(`Metas: ${partidas.length} partidas totais, ${enriquecidas.length} com dados completos (GPM/XPM/dano)`);
    return partidas;
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
    const partidasPessoais = await getPartidasPessoais(heroId);
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

    // Ajusta benchmarks para Turbo (multiplicadores) E posição
    // Benchmark global × Turbo mult × ajuste da posição = meta específica do herói na role
    const ajustePos = AJUSTE_POSICAO[pos] || AJUSTE_POSICAO[1];
    const gpmTurbo = gpmBase ? Math.round(gpmBase * TURBO_MULT.gold_per_min * ajustePos.gpm) : null;
    const xpmTurbo = xpmBase ? Math.round(xpmBase * TURBO_MULT.xp_per_min * ajustePos.xpm) : null;
    const dpmTurbo = dmgMinBase ? Math.round(dmgMinBase * TURBO_MULT.hero_damage_per_min * ajustePos.dpm) : null;

    // Metas por fase: usa benchmarks do herói (Turbo) quando disponíveis,
    // senão usa tabelas genéricas de posição como fallback
    const killsFase = KILLS_POR_POSICAO[pos] || KILLS_POR_POSICAO[1];
    const deathsFase = DEATHS_POR_POSICAO[pos] || DEATHS_POR_POSICAO[1];
    const assistsFase = ASSISTS_POR_POSICAO[pos] || ASSISTS_POR_POSICAO[1];
    const lhFase = LH_POR_POSICAO[pos] || LH_POR_POSICAO[1];
    const dnFase = DN_POR_POSICAO[pos] || DN_POR_POSICAO[1];
    // Fallbacks das tabelas de posição (usados só quando benchmarks não existem)
    const gpmFaseFallback = GPM_POR_POSICAO[pos] || GPM_POR_POSICAO[1];
    const xpmFaseFallback = XPM_POR_POSICAO[pos] || XPM_POR_POSICAO[1];
    const dpmFaseFallback = DPM_POR_POSICAO[pos] || DPM_POR_POSICAO[1];

    // Monta resultado por fase
    const fases = {};
    for (const [faseKey, faseInfo] of Object.entries(FASES_TURBO)) {
        const tempoMedio = (faseInfo.min + faseInfo.max) / 2;
        const taxaFase = TAXA_PROGRESSAO[faseKey];

        // GPM/XPM/DPM por fase: benchmark do herói × Turbo × progressão da fase
        // (early é menor, mid é médio, late é o pico)
        const gpmMetaFase = gpmTurbo
            ? Math.round(gpmTurbo * taxaFase)
            : gpmFaseFallback[faseKey];
        const xpmMetaFase = xpmTurbo
            ? Math.round(xpmTurbo * taxaFase)
            : xpmFaseFallback[faseKey];
        const dpmMetaFase = dpmTurbo
            ? Math.round(dpmTurbo * taxaFase)
            : dpmFaseFallback[faseKey];

        // Net Worth estimado = GPM da fase × tempo médio da fase
        const nwMeta = Math.round(gpmMetaFase * tempoMedio);

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
                    meta: gpmMetaFase
                },
                xpm: {
                    nome: 'XPM',
                    meta: xpmMetaFase
                },
                dpm: {
                    nome: 'DPM',
                    meta: dpmMetaFase
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
        dn: calcularMediaPessoal(partidasPessoais, 'denies') !== null
            ? Math.round(calcularMediaPessoal(partidasPessoais, 'denies'))
            : null,
        dmg: pessoalDmg ? Math.round(pessoalDmg) : null,
        dpm: (pessoalDmg && pessoalDuracao && pessoalDuracao > 0)
            ? Math.round(pessoalDmg / (pessoalDuracao / 60))
            : null,
        duracao: pessoalDuracao ? Math.round(pessoalDuracao / 60) : null,
        partidas: partidasPessoais.length
    };

    // Benchmarks globais (ajustados para Turbo) para referência
    const benchGlobal = {
        gpm: gpmTurbo,
        gpmBom: gpmBom ? Math.round(gpmBom * TURBO_MULT.gold_per_min * ajustePos.gpm) : null,
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

            // Helper: gera <td> pessoal — se não tem dados, mostra "—" para manter alinhamento
            const temPessoal = metas.pessoal.partidas > 0;
            const tdVazio = temPessoal ? '<td class="metas-valor-pessoal"><span class="metas-na">—</span></td>' : '';

            // K/D/A — estimado proporcionalmente por fase
            const kdaMeta = fase.stats.kda;
            let kdaPessoalHTML = tdVazio;
            if (temPessoal && metas.pessoal.kills !== null) {
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

            // LH / DN — estimados por fase
            const lhMeta = fase.stats.lh_dn;
            let lhPessoalHTML = tdVazio;
            if (temPessoal && metas.pessoal.lh !== null) {
                const lhEstimado = Math.round(metas.pessoal.lh * prop);
                const lhOk = lhEstimado >= lhMeta.metaLH;
                let dnHTML = '—';
                if (metas.pessoal.dn !== null) {
                    const dnEstimado = Math.round(metas.pessoal.dn * prop);
                    const dnOk = dnEstimado >= lhMeta.metaDN;
                    dnHTML = `<span class="${dnOk ? 'metas-bom' : 'metas-ruim'}">${dnEstimado}</span>`;
                }
                lhPessoalHTML = `<td class="metas-valor-pessoal">
                    <span class="${lhOk ? 'metas-bom' : 'metas-ruim'}">${lhEstimado}</span> / ${dnHTML}
                </td>`;
            }
            html += `<tr>
                <td class="metas-stat-nome">LH / DN</td>
                ${lhPessoalHTML}
                <td class="metas-valor-meta">${lhMeta.meta}</td>
            </tr>`;

            // Net Worth — estimado do GPM pessoal × tempo médio da fase
            const nwMeta = fase.stats.nw;
            let nwPessoalHTML = tdVazio;
            if (temPessoal && metas.pessoal.gpm !== null) {
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

            // GPM — estimado por fase (early é menor, late é o pico)
            const gpmMeta = fase.stats.gpm;
            const taxaFase = TAXA_PROGRESSAO[faseKey];
            let gpmPessoalHTML = tdVazio;
            if (temPessoal && metas.pessoal.gpm !== null) {
                const gpmEstimado = Math.round(metas.pessoal.gpm * taxaFase);
                const gpmOk = gpmEstimado >= gpmMeta.meta;
                gpmPessoalHTML = `<td class="metas-valor-pessoal">
                    <span class="${gpmOk ? 'metas-bom' : 'metas-ruim'}">${gpmEstimado}</span>
                </td>`;
            }
            html += `<tr>
                <td class="metas-stat-nome">GPM</td>
                ${gpmPessoalHTML}
                <td class="metas-valor-meta">${gpmMeta.meta}</td>
            </tr>`;

            // XPM — estimado por fase
            const xpmMeta = fase.stats.xpm;
            let xpmPessoalHTML = tdVazio;
            if (temPessoal && metas.pessoal.xpm !== null) {
                const xpmEstimado = Math.round(metas.pessoal.xpm * taxaFase);
                const xpmOk = xpmEstimado >= xpmMeta.meta;
                xpmPessoalHTML = `<td class="metas-valor-pessoal">
                    <span class="${xpmOk ? 'metas-bom' : 'metas-ruim'}">${xpmEstimado}</span>
                </td>`;
            }
            html += `<tr>
                <td class="metas-stat-nome">XPM</td>
                ${xpmPessoalHTML}
                <td class="metas-valor-meta">${xpmMeta.meta}</td>
            </tr>`;

            // DPM — Dano por Minuto, métrica chave na Turbo
            const dpmMeta = fase.stats.dpm;
            let dpmPessoalHTML = tdVazio;
            if (temPessoal && metas.pessoal.dpm !== null) {
                const dpmEstimado = Math.round(metas.pessoal.dpm * taxaFase);
                const dpmOk = dpmEstimado >= dpmMeta.meta;
                dpmPessoalHTML = `<td class="metas-valor-pessoal">
                    <span class="${dpmOk ? 'metas-bom' : 'metas-ruim'}">${dpmEstimado}</span>
                </td>`;
            }
            html += `<tr>
                <td class="metas-stat-nome">DPM</td>
                ${dpmPessoalHTML}
                <td class="metas-valor-meta">${dpmMeta.meta}</td>
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

    // Compara DPM
    if (p.dpm !== null && lateMetas.dpm.meta) {
        if (p.dpm >= lateMetas.dpm.meta) {
            dicas.push({
                tipo: 'bom',
                texto: `Seu DPM (${p.dpm}) está acima da meta (${lateMetas.dpm.meta}). Boa participação nas lutas!`
            });
        } else if (p.dpm < lateMetas.dpm.meta * 0.7) {
            dicas.push({
                tipo: 'melhorar',
                texto: `Seu DPM (${p.dpm}) está bem abaixo da meta (${lateMetas.dpm.meta}). Na Turbo, participe mais das teamfights!`
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
