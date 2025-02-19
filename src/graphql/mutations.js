const mutations = [
  require("../services/cartService").cartMutations,
  require("../services/cartService").syncCartMutation,
  require("../services/favoritesService").favoritesMutations,
];

module.exports = {
  mutations,
};
