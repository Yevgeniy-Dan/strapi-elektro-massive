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
            nexus.objectType({
              name: "ProductListResult",
              definition(t) {
                t.nonNull.list.nonNull.field("products", { type: "Product" });
                t.nonNull.int("currentPage");
                t.nonNull.int("pageCount");
                t.nonNull.int("totalCount");
                t.string("nextCursor");
              },
            }),
            nexus.inputObjectType({
              name: "FilterInput",
              definition(t) {
                t.nonNull.string("key");
                t.nonNull.string("value");
              },
            }),
            nexus.extendType({
              type: "Query",
              definition(t) {
                t.field("productTypeFilters", {
                  type: "JSON",
                  args: {
                    productTypeId: nexus.idArg(),
                    subcategoryId: nexus.idArg(),
                  },
                  resolve: async (_, { productTypeId, subcategoryId }, ctx) => {
                    // logToFile(`productTypeFilters called with id: ${id}`);

                    try {
                      // Check API token permissions
                      await strapi.auth.verify(ctx.state.auth, {
                        scope: ["api::product.product.find"],
                      });

                      const productService = strapi.service(
                        "api::product.product"
                      );

                      const products = await productService.find({
                        filters: {
                          product_types: {
                            id: {
                              $in: [productTypeId],
                            },
                          },
                          subcategory: {
                            id: {
                              $eq: subcategoryId,
                            },
                          },
                        },
                        populate: {
                          params: {
                            fields: ["key", "value"],
                          },
                        },
                        pagination: {
                          limit: -1, //TODO: consider the pagination
                        },
                      });

                      const allowedFilterKeys = [
                        "Бренд",
                        "Гарантія",
                        "Колірна температура",
                        "Кут розсіювання",
                        "Напруга V",
                        "Особливості",
                        "Потужність",
                        "Світловий потік Lm",
                        "Тип цоколя",
                        "Форма лампи",
                      ];

                      const filters = {};
                      products.results.forEach((product) => {
                        Object.entries(product.params).forEach(
                          ([key, value]) => {
                            if (allowedFilterKeys.includes(key)) {
                              if (!filters[key]) {
                                filters[key] = new Set();
                              }
                              filters[key].add(value);
                            }
                          }
                        );
                      });
                      Object.keys(filters).forEach((key) => {
                        filters[key] = Array.from(filters[key]);
                      });

                      // logToFile(
                      //   `Generated filters: ${JSON.stringify(filters)}`
                      // );

                      return filters;
                    } catch (error) {
                      logToFile(
                        `Error in productTypeFilters: ${error.message}`
                      );
                      throw error;
                    }
                  },
                });

                t.field("filteredProducts", {
                  type: "ProductListResult",
                  args: {
                    productTypeId: nexus.nonNull(nexus.idArg()),
                    subcategoryId: nexus.nonNull(nexus.idArg()),
                    filters: nexus.arg({
                      type: nexus.list(nexus.nonNull("FilterInput")),
                    }),
                    cursor: nexus.stringArg(),
                    page: nexus.intArg(),
                    pageSize: nexus.intArg({
                      defaultValue: 25,
                    }),
                  },
                  resolve: async (_, args, ctx) => {
                    const {
                      productTypeId,
                      subcategoryId,
                      filters,
                      cursor,
                      page,
                      pageSize = 25,
                    } = args;

                    // Check API token permissions
                    await strapi.auth.verify(ctx.state.auth, {
                      scope: ["api::product.product.find"],
                    });

                    const knex = strapi.db.connection;

                    let query = knex("products")
                      .join(
                        "product_types_products_links",
                        "products.id",
                        "product_types_products_links.product_id"
                      )
                      .join(
                        "products_subcategory_links",
                        "products.id",
                        "products_subcategory_links.product_id"
                      )
                      .where(
                        "product_types_products_links.product_type_id",
                        productTypeId
                      )
                      .andWhere(
                        "products_subcategory_links.subcategory_id",
                        subcategoryId
                      );

                    if (filters && filters.length > 0) {
                      query = query.andWhere(function () {
                        filters.forEach(({ key, value }) => {
                          this.orWhereRaw(
                            "params @> ?::jsonb",
                            JSON.stringify({ [key]: value })
                          );
                        });
                      });
                    }

                    const countResult = await query
                      .clone()
                      .countDistinct("products.id as count")
                      .first();
                    const totalCount = parseInt(countResult.count); //TODO: if will be large dataset it should be Materialized Views

                    if (cursor) {
                      query = query.where("products.id", ">", cursor);
                    } else if (page) {
                      const offset = (page - 1) * pageSize;
                      query = query.offset(offset);
                    }

                    const results = await query
                      .select("products.*")
                      .orderBy("products.id", "asc")
                      .limit(pageSize + 1);

                    const hasNextPage = results.length > pageSize;
                    const paginatedResults = results.slice(0, pageSize);

                    const nextCursor = hasNextPage
                      ? paginatedResults[
                          paginatedResults.length - 1
                        ].id.toString()
                      : null;

                    const currentPage =
                      page ||
                      (cursor
                        ? Math.floor(paginatedResults[0].id / pageSize) + 1
                        : 1);

                    const pageCount = Math.ceil(totalCount / pageSize);

                    console.log(
                      `Filtered products found: ${results.length}, Total: ${totalCount}, PageSize: ${pageSize}`
                    );

                    return {
                      products: paginatedResults,
                      currentPage,
                      pageCount,
                      totalCount,
                      nextCursor,
                    };
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
  bootstrap: async ({ strapi }) => {
    const knex = strapi.db.connection;
    // Check if the index already exists
    const indexExists = await knex.raw(`
      SELECT 1
      FROM pg_indexes
      WHERE indexname = 'idx_products_params'
    `);
    if (indexExists.rows.length === 0) {
      // Create the index if it doesn't exist
      await knex.raw(
        "CREATE INDEX idx_products_params ON products USING GIN (params jsonb_path_ops)"
      );
      logToFile("GIN index created on products.params");
    } else {
      logToFile("GIN index already exists on products.params");
    }

    // Check if the index on products.id already exists
    const idIndexExists = await knex.raw(`
    SELECT 1
    FROM pg_indexes
    WHERE indexname = 'idx_products_id'
  `);
    if (idIndexExists.rows.length === 0) {
      // Create the index if it doesn't exist
      await knex.raw("CREATE INDEX idx_products_id ON products (id)");
      logToFile("Index created on products.id");
    } else {
      logToFile("Index already exists on products.id");
    }

    // Check if the composite index on product_types_products_links (product_id, product_type_id) exists
    const productTypeLinkIndexExists = await knex.raw(`
    SELECT 1
    FROM pg_indexes
    WHERE indexname = 'idx_product_types_products_links'
  `);
    if (productTypeLinkIndexExists.rows.length === 0) {
      // Create the composite index if it doesn't exist
      await knex.raw(`
      CREATE INDEX idx_product_types_products_links 
      ON product_types_products_links (product_id, product_type_id)
    `);
      logToFile(
        "Composite index created on product_types_products_links (product_id, product_type_id)"
      );
    } else {
      logToFile(
        "Composite index already exists on product_types_products_links (product_id, product_type_id)"
      );
    }

    // Check if the composite index on products_subcategory_links (product_id, subcategory_id) exists
    const subcategoryLinkIndexExists = await knex.raw(`
    SELECT 1
    FROM pg_indexes
    WHERE indexname = 'idx_products_subcategory_links'
  `);
    if (subcategoryLinkIndexExists.rows.length === 0) {
      // Create the composite index if it doesn't exist
      await knex.raw(`
      CREATE INDEX idx_products_subcategory_links 
      ON products_subcategory_links (product_id, subcategory_id)
    `);
      logToFile(
        "Composite index created on products_subcategory_links (product_id, subcategory_id)"
      );
    } else {
      logToFile(
        "Composite index already exists on products_subcategory_links (product_id, subcategory_id)"
      );
    }
  },
};
