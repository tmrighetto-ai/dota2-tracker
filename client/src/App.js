import React, { useState, useEffect, useMemo } from 'react';
import './App.css';
import { 
  Search, 
  LayoutDashboard, 
  History, 
  Users, 
  TrendingUp, 
  ExternalLink,
  Shield,
  Clock,
  Sword,
  TrendingDown
} from 'lucide-react';
import { 
  to32Bit, 
  fetchPlayerData, 
  fetchRecentMatches, 
  fetchMostPlayedHeroes, 
  fetchHeroConstants,
  getHeroImageUrl,
  formatKDA
} from './utils/api';

function App() {
  const [accountId, setAccountId] = useState('100782689'); // Default sample account
  const [searchId, setSearchId] = useState('');
  const [player, setPlayer] = useState(null);
  const [matches, setMatches] = useState([]);
  const [heroes, setHeroes] = useState([]);
  const [heroConstants, setHeroConstants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [filterHero, setFilterHero] = useState('');

  const [view, setView] = useState('profile'); // 'profile' or 'heroes'

  const idToHeroMap = useMemo(() => {
    const map = {};
    heroConstants.forEach(h => {
      map[h.id] = h;
    });
    return map;
  }, [heroConstants]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [playerData, matchData, heroData, constants] = await Promise.all([
          fetchPlayerData(accountId),
          fetchRecentMatches(accountId),
          fetchMostPlayedHeroes(accountId),
          fetchHeroConstants()
        ]);
        setPlayer(playerData);
        setMatches(matchData);
        setHeroes(heroData.slice(0, 8)); // Top 8 heroes
        setHeroConstants(constants);
      } catch (error) {
        console.error("Error loading Dota data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [accountId]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchId) {
      setAccountId(to32Bit(searchId));
      setView('profile'); // Switch back to profile on search
    }
  };

  const filteredMatches = useMemo(() => {
    return matches.filter(match => {
      const winStatus = (match.player_slot < 128 && match.radiant_win) || (match.player_slot >= 128 && !match.radiant_win);
      const matchesTab = activeTab === 'ALL' || (activeTab === 'WIN' && winStatus) || (activeTab === 'LOSS' && !winStatus);
      
      const heroName = idToHeroMap[match.hero_id]?.localized_name.toLowerCase() || '';
      const matchesHero = !filterHero || heroName.includes(filterHero.toLowerCase());
      
      return matchesTab && matchesHero;
    });
  }, [matches, activeTab, filterHero, idToHeroMap]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p style={{ fontFamily: 'var(--font-accent)', letterSpacing: '2px' }}>LOADING DATA...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="header">
        <div className="logo" style={{ cursor: 'pointer' }} onClick={() => setView('profile')}>
          <Shield size={28} />
          DOTA2<span>PRO</span>
        </div>
        
        <nav className="nav-links">
          <div 
            className={`nav-item ${view === 'profile' ? 'active' : ''}`} 
            onClick={() => setView('profile')}
          >
            Profile
          </div>
          <div className="nav-item">Matches</div>
          <div 
            className={`nav-item ${view === 'heroes' ? 'active' : ''}`} 
            onClick={() => setView('heroes')}
          >
            Heroes
          </div>
          <div className="nav-item">Meta</div>
        </nav>

        <form className="search-bar" onSubmit={handleSearch}>
          <Search size={18} color="var(--text-secondary)" />
          <input 
            type="text" 
            placeholder="Search Steam ID or Account ID..." 
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
          />
        </form>
      </header>

      {view === 'profile' ? (
        <>
          {/* Steam Login Banner */}
          {!player?.profile && (
            <div className="steam-banner">
              <div>
                <h2 style={{ fontFamily: 'var(--font-accent)' }}>CONNECT YOUR PROFILE</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Login with Steam to see your personalized stats and match history.</p>
              </div>
              <button className="btn-steam">
                <LayoutDashboard size={20} />
                SIGN IN WITH STEAM
              </button>
            </div>
          )}

          {/* Player Profile Banner */}
          {player?.profile && (
            <div className="player-banner">
              <img src={player.profile.avatarfull} alt="avatar" className="player-avatar" />
              <div className="player-info">
                <h1>{player.profile.personaname}</h1>
                <div className="player-stats">
                  <div className="stat-item">
                    <div className="label">Estimated MMR</div>
                    <div className="value mmr-value">{player.mmr_estimate?.estimate || 'N/A'}</div>
                  </div>
                  <div className="stat-item">
                    <div className="label">Win Rate</div>
                    <div className="value" style={{ color: 'var(--win-green)' }}>
                      {((player.win / (player.win + player.lose)) * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="stat-item">
                    <div className="label">Recent Win Rate</div>
                    <div className="value">
                      {((matches.filter(m => (m.player_slot < 128 && m.radiant_win) || (m.player_slot >= 128 && !m.radiant_win)).length / matches.length) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Most Played Heroes Grid */}
          <section>
            <h2 className="section-title">
              <TrendingUp size={20} />
              Most Played Heroes
            </h2>
            <div className="hero-grid">
              {heroes.map(hero => {
                const hInfo = idToHeroMap[hero.hero_id];
                const winRate = (hero.win / hero.games) * 100;
                return (
                  <div className="hero-card" key={hero.hero_id}>
                    <img 
                      src={getHeroImageUrl(hInfo?.name || '')} 
                      alt={hInfo?.localized_name} 
                      className="hero-card-img" 
                    />
                    <div className="hero-card-content">
                      <div className="hero-name">{hInfo?.localized_name}</div>
                      <div className="hero-stats">
                        {hero.games} Games • {winRate.toFixed(1)}% Win Rate
                      </div>
                      <div className="winrate-bar-container">
                        <div className="winrate-bar" style={{ width: `${winRate}%` }}></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Recent Matches Table */}
          <section>
            <h2 className="section-title">
              <History size={20} />
              Recent Matches
            </h2>
            <div className="table-container">
              <div className="filters">
                <div className="filter-tabs">
                  <div className={`tab ${activeTab === 'ALL' ? 'active' : ''}`} onClick={() => setActiveTab('ALL')}>ALL</div>
                  <div className={`tab ${activeTab === 'WIN' ? 'active' : ''}`} onClick={() => setActiveTab('WIN')}>WINS</div>
                  <div className={`tab ${activeTab === 'LOSS' ? 'active' : ''}`} onClick={() => setActiveTab('LOSS')}>LOSSES</div>
                </div>
                <div className="search-bar" style={{ width: '250px' }}>
                  <Sword size={16} color="var(--text-secondary)" />
                  <input 
                    type="text" 
                    placeholder="Filter by hero..." 
                    value={filterHero}
                    onChange={(e) => setFilterHero(e.target.value)}
                  />
                </div>
              </div>
              
              <table className="match-table">
                <thead>
                  <tr>
                    <th>Hero</th>
                    <th>Result</th>
                    <th>Type</th>
                    <th>K/D/A</th>
                    <th>Duration</th>
                    <th>Damage</th>
                    <th>Net Worth</th>
                    <th>Match ID</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMatches.map(match => {
                    const hInfo = idToHeroMap[match.hero_id];
                    const isWin = (match.player_slot < 128 && match.radiant_win) || (match.player_slot >= 128 && !match.radiant_win);
                    return (
                      <tr className="match-row" key={match.match_id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <img 
                              src={getHeroImageUrl(hInfo?.name || '')} 
                              style={{ width: '45px', borderRadius: '4px' }} 
                              alt="hero" 
                            />
                            <span style={{ fontWeight: '600' }}>{hInfo?.localized_name}</span>
                          </div>
                        </td>
                        <td>
                          <span className={isWin ? 'res-win' : 'res-loss'}>
                            {isWin ? 'WIN' : 'LOSS'}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                          {match.lobby_type === 7 ? 'Ranked' : 'Normal'}
                        </td>
                        <td>
                          <div className="kda-val">
                            {match.kills} / <span style={{ color: 'var(--loss-red)' }}>{match.deaths}</span> / {match.assists}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {formatKDA(match.kills, match.deaths, match.assists)} KDA
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Clock size={14} color="var(--text-secondary)" />
                            {Math.floor(match.duration / 60)}:{(match.duration % 60).toString().padStart(2, '0')}
                          </div>
                        </td>
                        <td>
                          <div style={{ color: 'var(--accent-cyan)', fontWeight: '600' }}>
                            {(match.hero_damage / 1000).toFixed(1)}k
                          </div>
                        </td>
                        <td>
                          <div style={{ color: 'var(--mmr-gold)', fontWeight: '600' }}>
                            {(match.gold_per_min * (match.duration / 60) / 1000).toFixed(1)}k
                          </div>
                        </td>
                        <td>
                          <a 
                            href={`https://www.opendota.com/matches/${match.match_id}`} 
                            target="_blank" 
                            rel="noreferrer"
                            style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-secondary)' }}
                          >
                            {match.match_id}
                            <ExternalLink size={14} />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredMatches.length === 0 && (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No matches found with current filters.
                </div>
              )}
            </div>
          </section>
        </>
      ) : (
        <section>
          <h2 className="section-title">
            <Users size={20} />
            Dota 2 Heroes
          </h2>
          <div className="hero-grid">
            {[...heroConstants].sort((a, b) => a.localized_name.localeCompare(b.localized_name)).map(hero => (
              <div className="hero-card" key={hero.id}>
                <img 
                  src={getHeroImageUrl(hero.name)} 
                  alt={hero.localized_name} 
                  className="hero-card-img" 
                />
                <div className="hero-card-content">
                  <div className="hero-name">{hero.localized_name}</div>
                  <div className="hero-stats" style={{ color: 'var(--accent-cyan)' }}>
                    {hero.roles.join(' • ')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );

}

export default App;
