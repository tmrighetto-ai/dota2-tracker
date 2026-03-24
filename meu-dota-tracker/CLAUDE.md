# Dota 2 Turbo Tracker — Dota Plus Enhancement

## Idioma e tom
- Sempre responda em português brasileiro
- Linguagem simples — o desenvolvedor é iniciante
- Explique o que cada mudança faz antes de aplicar
- Pergunte antes de fazer mudanças grandes

## O que é este projeto
Protótipo de uma melhoria para o Dota Plus focada em partidas Turbo.
O objetivo final é apresentar à Valve como sugestão de atualização.
Projeto desenvolvido por iniciante — priorizar explicações claras e código simples.

## Estrutura de arquivos
meu-dota-tracker/
├── index.html              → estrutura HTML da página
├── css/style.css           → visual dark theme com foco Turbo
├── js/api.js               → chamadas à OpenDota API (incluindo rotas Turbo)
├── js/heroes.js            → cards de heróis mais jogados no Turbo
├── js/matches.js           → tabela de partidas Turbo
├── js/filters.js           → filtros, ordenação e paginação
├── js/turbo.js             → resumo de stats Turbo e gráfico de desempenho
├── js/counters.js          → heróis onde você é forte/fraco no Turbo
├── js/items-recommend.js   → recomendação de itens por herói
├── js/friends.js           → comparativo com amigos da Steam
└── js/main.js              → inicialização e controle geral

## API utilizada
- OpenDota API (sem chave): https://api.opendota.com/api
- Rotas com filtro Turbo: game_mode=23
- Imagens heróis: cdn.cloudflare.steamstatic.com
- Login: Steam OpenID

## O que já funciona
- Login via Steam OpenID + busca por URL/ID
- Banner do jogador com avatar, nome e MMR
- Resumo Turbo: win rate, K/D/A médio, GPM, XPM, dano médio, sequência
- Gráfico de desempenho das últimas 20 partidas Turbo
- Cards de heróis mais jogados no Turbo com win rate
- Seção de counters: heróis onde o jogador é forte/fraco
- Recomendação de itens por herói (early/mid/late/situacional)
- Comparativo com amigos da Steam (partidas juntos, win rate)
- Tabela de partidas Turbo com K/D/A, net worth, dano, duração
- Filtros: herói, data, networth, dano + abas Vitórias/Derrotas
- Paginação com 10 partidas por página
- Busca assíncrona de itens por partida (com account_id correto)

## Fases do projeto
- [x] Fase 1 — Base Turbo (bugs corrigidos, foco Turbo)
- [x] Fase 2 — Análise Inteligente (counters, recomendação de itens)
- [x] Fase 3 — Social (comparativo com amigos)
- [ ] Fase 4 — Protótipo "In-Game" (tela de recomendação em tempo real)

## Regras importantes do código
- Sem frameworks — JavaScript puro (vanilla JS)
- Sem import/export — funções globais
- Compatível com abertura via Live Server no VS Code
- Comentários em português
- Não usar localStorage
