"use strict";

const fs = require("fs");
const path = require("path");

const logToFile = (message) => {
  const logPath = path.join(__dirname, "debug.log");
  fs.appendFileSync(logPath, message + "\n");
};

module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register({ strapi }) {
    // Register custom GraphQL resolver if using GraphQL
    if (strapi.plugins.graphql) {
      const extensionService = strapi.plugin("graphql").service("extension");
      extensionService.use(({ nexus }) => {
        return {
          types: [
            nexus.extendType({
              type: "Product",
              definition(t) {
                // Add any fields that might be missing from the original Product type
                t.nonNull.id("id");
              },
            }),
            nexus.extendType({
              type: "Query",
              definition(t) {
                t.field("productTypeFilters", {
                  type: "JSON",
                  args: { id: nexus.idArg() },
                  resolve: async (_, { id }, ctx) => {
                    logToFile(`productTypeFilters called with id: ${id}`);

                    try {
                      // Check API token permissions
                      await strapi.auth.verify(ctx.state.auth, {
                        scope: ["api::product.product.find"],
                      });

                      //TODO: refactore the code to fetch only neccessary filters

                      const productService = strapi.service(
                        "api::product.product"
                      );

                      const products = await productService.find({
                        filters: { product_type: id },
                        populate: {
                          params: {
                            fields: ["key", "value"],
                          },
                        },
                        pagination: {
                          limit: -1, //TODO: consider the pagination
                        },
                      });

                      logToFile(
                        `products: ${JSON.stringify(products.results.length)}`
                      );
                      const filters = {};
                      products.results.forEach((product) => {
                        product.params.forEach((param) => {
                          if (!filters[param.key]) {
                            filters[param.key] = new Set();
                          }
                          filters[param.key].add(param.value);
                        });
                      });
                      Object.keys(filters).forEach((key) => {
                        filters[key] = Array.from(filters[key]);
                      });

                      logToFile(
                        `Generated filters: ${JSON.stringify(filters)}`
                      );

                      return filters;
                    } catch (error) {
                      logToFile(
                        `Error in productTypeFilters: ${error.message}`
                      );
                      throw error;
                    }
                  },
                });

                t.list.field("filteredProducts", {
                  type: "Product",
                  args: {
                    productTypeId: nexus.idArg(),
                    filters: nexus.arg({ type: "JSON" }),
                  },
                  resolve: async (_, { productTypeId, filters }, ctx) => {
                    // Check API token permissions
                    await strapi.auth.verify(ctx.state.auth, {
                      scope: ["api::product.product.find"],
                    });

                    const productService = strapi.service(
                      "api::product.product"
                    );

                    const query = {
                      filters: {
                        product_type: productTypeId,
                        $or: Object.entries(filters).map(([key, value]) => ({
                          params: {
                            $and: [{ key: key }, { value: value }],
                          },
                        })),
                      },
                      populate: {
                        params: {
                          fields: ["key", "value"],
                        },
                      },
                      fields: [
                        "id",
                        "title",
                        "retail",
                        "currency",
                        "image_link",
                      ],
                      pagination: {
                        limit: -1, // Fetch all matching products //TODO: make paginated query
                      },
                    };

                    const result = await productService.find(query);

                    logToFile(
                      `Filtered products found: ${JSON.stringify(
                        result.results
                      )})
                      )}`
                    );

                    return result.results;
                  },
                });
              },
            }),
          ],
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
          },
        };
      });
    }
  },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  bootstrap({ strapi }) {
    logToFile("Custom logging initialized");
  },
};
