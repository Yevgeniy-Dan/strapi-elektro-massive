const queries = [
  require("../services/cartService").getUserCartQuery,
  require("../services/favoritesService").getUserFavoritesQuery,
  require("../services/productService").getFilteredProducts,
  require("../services/productService").getMaxProductPrice,
  require("../services/productService").getProductTypeFilters,
];

module.exports = {
  queries,
};
