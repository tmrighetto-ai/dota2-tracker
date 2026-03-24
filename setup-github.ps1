# Script para configurar Git e GitHub - Dota 2 Tracker
# Criado automaticamente por Claude

Write-Host "🚀 Configurando Git e GitHub para seu projeto Dota 2 Tracker..." -ForegroundColor Cyan
Write-Host ""

# Etapa 1: Configurar Git com seu nome e email
Write-Host "📝 [1/6] Configurando seu nome e email no Git..." -ForegroundColor Yellow
git config --global user.name "Thiago Righetto"
git config --global user.email "tmrighetto@gmail.com"
Write-Host "✅ Configuração do Git concluída!" -ForegroundColor Green
Write-Host ""

# Etapa 2: Inicializar repositório Git
Write-Host "📦 [2/6] Inicializando repositório Git..." -ForegroundColor Yellow
cd "H:\Backup\Projetos Visual Studio\Dota 2"
git init
Write-Host "✅ Repositório Git inicializado!" -ForegroundColor Green
Write-Host ""

# Etapa 3: Adicionar todos os arquivos
Write-Host "📂 [3/6] Adicionando todos os arquivos ao Git..." -ForegroundColor Yellow
git add .
Write-Host "✅ Arquivos adicionados!" -ForegroundColor Green
Write-Host ""

# Etapa 4: Fazer primeiro commit com todo o trabalho
Write-Host "💾 [4/6] Criando commit com todo o trabalho dos últimos 5 dias..." -ForegroundColor Yellow
git commit -m "feat: Projeto Dota 2 Tracker - 5 dias de desenvolvimento

- Implementação inicial do tracker
- Interface HTML/CSS desenvolvida
- Sistema de dados implementado
- Funcionalidades JavaScript criadas
- Estrutura do projeto organizada"
Write-Host "✅ Commit criado com sucesso!" -ForegroundColor Green
Write-Host ""

# Etapa 5: Instruções para criar repositório no GitHub
Write-Host "🌐 [5/6] AÇÃO NECESSÁRIA: Criar repositório no GitHub" -ForegroundColor Red
Write-Host ""
Write-Host "Agora você precisa criar o repositório no GitHub:" -ForegroundColor White
Write-Host "1. Abra https://github.com/new" -ForegroundColor White
Write-Host "2. Nome do repositório: dota2-tracker" -ForegroundColor White
Write-Host "3. Deixe como PUBLIC (muito importante!)" -ForegroundColor White
Write-Host "4. NÃO marque 'Initialize with README'" -ForegroundColor White
Write-Host "5. Clique em 'Create repository'" -ForegroundColor White
Write-Host ""
Write-Host "Pressione ENTER após criar o repositório no GitHub..." -ForegroundColor Yellow
Read-Host

# Etapa 6: Conectar ao GitHub e fazer push
Write-Host "🔗 [6/6] Conectando ao GitHub e enviando código..." -ForegroundColor Yellow
git branch -M main
git remote add origin https://github.com/tmrighetto-ai/dota2-tracker.git
git push -u origin main
Write-Host ""
Write-Host "✅✅✅ TUDO PRONTO! ✅✅✅" -ForegroundColor Green
Write-Host ""
Write-Host "🎉 Seu projeto agora está no GitHub!" -ForegroundColor Cyan
Write-Host "🔗 Veja em: https://github.com/tmrighetto-ai/dota2-tracker" -ForegroundColor Cyan
Write-Host ""
Write-Host "📊 Suas contribuições dos últimos 5 dias agora aparecerão no seu perfil!" -ForegroundColor Green
Write-Host ""
Write-Host "💡 Dica: A partir de agora, toda vez que trabalhar no projeto:" -ForegroundColor Yellow
Write-Host "   git add ." -ForegroundColor White
Write-Host "   git commit -m 'Descrição do que você fez'" -ForegroundColor White
Write-Host "   git push" -ForegroundColor White
Write-Host ""
Read-Host "Pressione ENTER para fechar"
