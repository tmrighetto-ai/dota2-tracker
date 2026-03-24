export const getHeroImage = (heroName) => {
  // OpenDota hero images are at https://cdn.opendota.com/apps/dota2/images/heroes/{hero_name}_full.png
  return `https://cdn.opendota.com/apps/dota2/images/heroes/${heroName}_full.png`;
};

export const getItemImage = (itemName) => {
  // OpenDota item images are at https://cdn.opendota.com/apps/dota2/images/items/{item_name}_lg.png
  return `https://cdn.opendota.com/apps/dota2/images/items/${itemName}_lg.png`;
};
