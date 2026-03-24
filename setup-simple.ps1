# Git Setup Script - Simple Version (No special characters)
# Run this in PowerShell

Write-Host "=== Git and GitHub Setup ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Configure Git
Write-Host "[1/6] Configuring Git..." -ForegroundColor Yellow
git config --global user.name "Thiago Righetto"
git config --global user.email "tmrighetto@gmail.com"
Write-Host "Done!" -ForegroundColor Green
Write-Host ""

# Step 2: Navigate to project
Write-Host "[2/6] Navigating to project..." -ForegroundColor Yellow
cd "H:\Backup\Projetos Visual Studio\Dota 2"
Write-Host "Done!" -ForegroundColor Green
Write-Host ""

# Step 3: Initialize Git
Write-Host "[3/6] Initializing Git repository..." -ForegroundColor Yellow
git init
Write-Host "Done!" -ForegroundColor Green
Write-Host ""

# Step 4: Add files
Write-Host "[4/6] Adding all files..." -ForegroundColor Yellow
git add .
Write-Host "Done!" -ForegroundColor Green
Write-Host ""

# Step 5: Create commit
Write-Host "[5/6] Creating commit..." -ForegroundColor Yellow
git commit -m "Initial commit: Dota 2 Tracker project - 5 days of work"
Write-Host "Done!" -ForegroundColor Green
Write-Host ""

# Step 6: GitHub instructions
Write-Host "=== IMPORTANT: Create GitHub repository ===" -ForegroundColor Red
Write-Host ""
Write-Host "1. Open: https://github.com/new" -ForegroundColor White
Write-Host "2. Repository name: dota2-tracker" -ForegroundColor White
Write-Host "3. Make it PUBLIC (very important!)" -ForegroundColor White
Write-Host "4. DO NOT check 'Initialize with README'" -ForegroundColor White
Write-Host "5. Click 'Create repository'" -ForegroundColor White
Write-Host ""
Write-Host "Press ENTER after creating the repository on GitHub..." -ForegroundColor Yellow
Read-Host

# Step 7: Connect and push
Write-Host "[6/6] Connecting to GitHub and pushing..." -ForegroundColor Yellow
git branch -M main
git remote add origin https://github.com/tmrighetto-ai/dota2-tracker.git
git push -u origin main
Write-Host ""
Write-Host "=== SUCCESS! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Your project is now on GitHub!" -ForegroundColor Cyan
Write-Host "View it at: https://github.com/tmrighetto-ai/dota2-tracker" -ForegroundColor Cyan
Write-Host ""
Write-Host "From now on, after working:" -ForegroundColor Yellow
Write-Host "  git add ." -ForegroundColor White
Write-Host "  git commit -m 'What you did'" -ForegroundColor White
Write-Host "  git push" -ForegroundColor White
Write-Host ""
Read-Host "Press ENTER to close"
