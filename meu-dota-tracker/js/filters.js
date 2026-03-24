/**
 * Módulo de filtros, ordenação e paginação.
 */

let currentData = [];
let sortDirection = {};
let itemsPerPage = 10;
let currentPage = 1;

/**
 * Inicializa os filtros e eventos da tabela.
 */
function initFilters(data, heroConstants, itemConstants) {
    currentData = [...data];

    const filterHeroInput     = document.getElementById('filter-hero');
    const filterDateInput     = document.getElementById('filter-date');
    const filterNetworthInput = document.getElementById('filter-networth');
    const filterDamageInput   = document.getElementById('filter-damage');
    const tabButtons          = document.querySelectorAll('[data-filter]');

const applyAllFilters = () => {
    const query     = filterHeroInput.value.toLowerCase();
    const dateVal   = filterDateInput.value;
    const minNet    = parseFloat(filterNetworthInput.value) || 0;
    const minDmg    = parseFloat(filterDamageInput.value) || 0;
    const activeTab = document.querySelector('[data-filter].active')?.dataset.filter || 'all';

    const filtered = data.filter(match => {
        const hInfo = heroConstants[match.hero_id];
        const nameMatch = !query || (hInfo && hInfo.localized_name.toLowerCase().includes(query));

        const matchDate = new Date(match.start_time * 1000).toISOString().split('T')[0];
        const dateMatch = !dateVal || matchDate >= dateVal;

        const netWorth = match.net_worth || 0;
        const netMatch = netWorth >= minNet;
        const dmgMatch = (match.hero_damage || 0) >= minDmg;

        const isWin = (match.player_slot < 128 && match.radiant_win) ||
                      (match.player_slot >= 128 && !match.radiant_win);

        // Filtro por resultado (tudo já é Turbo)
        const tabMatch =
            activeTab === 'all'  ? true :
            activeTab === 'win'  ? isWin :
            activeTab === 'loss' ? !isWin : true;

        return nameMatch && dateMatch && netMatch && dmgMatch && tabMatch;
    });

    currentData = filtered;
    currentPage = 1;
    updateDisplay(heroConstants, itemConstants);
};

    filterHeroInput.addEventListener('input', applyAllFilters);
    filterDateInput.addEventListener('change', applyAllFilters);
    filterNetworthInput.addEventListener('input', applyAllFilters);
    filterDamageInput.addEventListener('input', applyAllFilters);

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            applyAllFilters();
        });
    });

    // Ordenação por coluna
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const prop = th.dataset.sort;

            // CORREÇÃO 2: Ordenação alternada (asc/desc) ao clicar duas vezes
            sortDirection[prop] = sortDirection[prop] === 'desc' ? 'asc' : 'desc';
            sortData(prop, sortDirection[prop]);

            // Indicador visual na coluna ativa
            document.querySelectorAll('th[data-sort]').forEach(t => t.classList.remove('sorted'));
            th.classList.add('sorted');

            updateDisplay(heroConstants, itemConstants);
        });
    });
}

/**
 * Ordena os dados pelo campo e direção indicados.
 */
function sortData(prop, direction) {
    currentData.sort((a, b) => {
        let valA, valB;

        if (prop === 'hero') {
            // Ordena por nome do herói alfabeticamente
            valA = a.hero_id;
            valB = b.hero_id;
        } else if (prop === 'kda') {
            // Ordena por kills
            valA = a.kills;
            valB = b.kills;
        } else {
            valA = a[prop] || 0;
            valB = b[prop] || 0;
        }

        return direction === 'asc' ? valA - valB : valB - valA;
    });
}

/**
 * Atualiza a tabela com a página atual.
 */
function updateDisplay(heroConstants, itemConstants) {
    const start = (currentPage - 1) * itemsPerPage;
    const end   = start + itemsPerPage;
    const paginatedData = currentData.slice(start, end);

    renderMatchesTable(paginatedData, heroConstants, itemConstants);
    renderPagination();
}

/**
 * Renderiza os botões de paginação.
 */
function renderPagination() {
    const nav        = document.getElementById('pagination');
    const totalPages = Math.ceil(currentData.length / itemsPerPage);

    if (totalPages <= 1) {
        nav.innerHTML = '';
        return;
    }

    let html = '';

    // Botão anterior
    html += `<button class="page-btn" onclick="changePage(${currentPage - 1})"
        ${currentPage === 1 ? 'disabled' : ''}>‹</button>`;

    // Numeração das páginas
    for (let i = 1; i <= totalPages; i++) {
        html += `<button class="page-btn ${i === currentPage ? 'active' : ''}"
            onclick="changePage(${i})">${i}</button>`;
    }

    // Botão próximo
    html += `<button class="page-btn" onclick="changePage(${currentPage + 1})"
        ${currentPage === totalPages ? 'disabled' : ''}>›</button>`;

    nav.innerHTML = html;
}

/**
 * Muda a página atual.
 */
function changePage(page) {
    const totalPages = Math.ceil(currentData.length / itemsPerPage);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    window.dispatchEvent(new CustomEvent('pageChange', { detail: page }));
}