import axios from 'axios';

const BASE_URL = 'https://api.opendota.com/api';

/**
 * Converts a 64-bit Steam ID to a 32-bit account ID.
 */
export const to32Bit = (steamId64) => {
  const diff = BigInt('76561197960265728');
  try {
    const id = BigInt(steamId64);
    return (id - diff).toString();
  } catch (e) {
    return steamId64; // Might already be 32-bit
  }
};

export const fetchPlayerData = async (accountId) => {
  const response = await axios.get(`${BASE_URL}/players/${accountId}`);
  return response.data;
};

export const fetchRecentMatches = async (accountId) => {
  const response = await axios.get(`${BASE_URL}/players/${accountId}/recentMatches`);
  return response.data;
};

export const fetchMostPlayedHeroes = async (accountId) => {
  const response = await axios.get(`${BASE_URL}/players/${accountId}/heroes`);
  return response.data;
};

export const fetchHeroConstants = async () => {
  const response = await axios.get(`${BASE_URL}/heroes`);
  return response.data;
};

export const getHeroImageUrl = (heroName) => {
  // Clean hero name for URL (e.g., npc_dota_hero_antimage -> antimage)
  const name = heroName.replace('npc_dota_hero_', '');
  return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${name}.png`;
};

export const formatKDA = (kills, deaths, assists) => {
  if (deaths === 0) return (kills + assists).toFixed(1);
  return ((kills + assists) / deaths).toFixed(1);
};
