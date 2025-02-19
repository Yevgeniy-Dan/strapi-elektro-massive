const queries = require("./queries.js");
const mutations = require("./mutations.js");
const customTypes = require("./types.js");

const setupGraphQl = (strapi) => {
  // Register custom GraphQL resolver if using GraphQL
  if (strapi.plugins.graphql) {
    const extensionService = strapi.plugin("graphql").service("extension");

    extensionService.use(({ nexus }) => ({
      types: [customTypes, queries, mutations],
      resolversConfig: {
        "Query.productTypeFilters": {
          auth: {
            scope: ["api::product.product.find"],
          },
        },
        "Query.filteredProducts": {
          auth: {
            scope: ["api::product.product.find"],
          },
        },
        "Query.maxProductPrice": {
          auth: {
            scope: ["api::product.product.find"],
          },
        },
        "Mutation.syncCart": {
          auth: {
            scope: ["api::cart.cart.update"],
          },
        },
        "Mutation.updateCart": {
          auth: {
            scope: ["api::cart.cart.update"],
          },
        },
      },
    }));
  }
};

module.exports = { setupGraphQl };
