const { extendType, arg } = require("nexus");

const { idArg, nonNull, list, stringArg, intArg, floatArg } = require("nexus");

const getProductTypeFilters = extendType({
  type: "Query",
  definition(t) {
    t.field("productTypeFilters", {
      type: "JSON",
      args: {
        productTypeId: idArg(),
        subcategoryId: nonNull(idArg()),
        locale: nonNull("I18NLocaleCode"),
      },
      resolve: async (_, { productTypeId, subcategoryId, locale }, ctx) => {
        try {
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
              "product_types_subcategories_links",
              "product_types_products_links.product_type_id",
              "product_types_subcategories_links.product_type_id"
            )
            .where({
              "product_types_subcategories_links.subcategory_id": subcategoryId,
              "products.locale": locale,
            });

          if (productTypeId) {
            query = query.where(
              "product_types_products_links.product_type_id",
              productTypeId
            );
          }

          const results = await query
            .select("products.params")
            .whereNotNull("products.params");

          const allowedFilterKeys = {
            uk: [
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
            ],
            ru: [
              "Бренд",
              "Гарантийный термин",
              "Цветовая температура света",
              "Угол рассеяния",
              "Напряжение V",
              "Особенности",
              "Мощность",
              "Световой поток Lm",
              "Тип цоколя",
              "Форма лампы",
            ],
          };

          const resultFilters = {};
          results.forEach((result) => {
            const params =
              typeof result.params === "string"
                ? JSON.parse(result.params)
                : result.params;
            Object.entries(params).forEach(([key, value]) => {
              if (allowedFilterKeys[locale].includes(key)) {
                if (!resultFilters[key]) {
                  resultFilters[key] = new Set();
                }
                resultFilters[key].add(value);
              }
            });
          });

          const sortMixedValues = (arr) => {
            return arr.sort((a, b) => {
              const numA = parseFloat(a.match(/^-?\d+\.?\d*/));
              const numB = parseFloat(b.match(/^-?\d+\.?\d*/));

              if (isNaN(numA)) return 1;
              if (isNaN(numB)) return -1;

              return numA - numB;
            });
          };

          Object.keys(resultFilters).forEach((key) => {
            resultFilters[key] = sortMixedValues(
              Array.from(resultFilters[key])
            );
          });

          return resultFilters;
        } catch (error) {
          // logToFile(
          //   `Error in productTypeFilters: ${error.message}`
          // );
          throw error;
        }
      },
    });
  },
});

const getFilteredProducts = extendType({
  type: "Query",
  definition(t) {
    t.field("filteredProducts", {
      type: "ProductListResult",
      args: {
        productTypeId: idArg(),
        subcategoryId: nonNull(idArg()),
        filters: arg({
          type: list(nonNull("FilterInput")),
        }),
        cursor: stringArg(),
        page: intArg(),

        pageSize: intArg({ default: 25 }),
        locale: arg({
          type: nonNull("I18NLocaleCode"),
        }),
        sort: list("String"),
        minPrice: floatArg(),
        maxPrice: floatArg(),
      },
      resolve: async (_, args, ctx) => {
        const {
          productTypeId,
          subcategoryId,
          filters,
          cursor,
          page,
          pageSize = 25,
          locale,
          sort,
          minPrice,
          maxPrice,
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
            "product_types_subcategories_links",
            "product_types_products_links.product_type_id",
            "product_types_subcategories_links.product_type_id"
          )
          .where(
            "product_types_subcategories_links.subcategory_id",
            subcategoryId
          )
          .where("products.locale", locale);

        if (minPrice) {
          query = query.where("products.retail", ">=", minPrice);
        }

        if (maxPrice) {
          query = query.where("products.retail", "<=", maxPrice);
        }

        if (productTypeId) {
          query = query.where(
            "product_types_products_links.product_type_id",
            productTypeId
          );
        }

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
        const totalCount = parseInt(countResult.count.toString()); //TODO: if will be large dataset it should be Materialized Views

        if (cursor) {
          query = query.where("products.id", ">", cursor);
        } else if (page) {
          const offset = (page - 1) * pageSize;
          query = query.offset(offset);
        }

        if (sort && sort.length > 0) {
          sort.forEach((sortItem) => {
            const [field, direction] = sortItem.split(":");

            if (field === "retail") {
              query = query.orderBy("products.retail", direction);
            }
          });
        } else {
          query = query.orderBy("products.id", "asc");
        }

        const results = await query
          .select("products.*")
          // .orderBy("products.id", "asc")
          .limit(pageSize + 1);

        const hasNextPage = results.length > pageSize;
        const paginatedResults = results.slice(0, pageSize);

        const nextCursor = hasNextPage
          ? paginatedResults[paginatedResults.length - 1].id.toString()
          : null;

        const currentPage =
          page ||
          (cursor ? Math.floor(paginatedResults[0].id / pageSize) + 1 : 1);

        const pageCount = Math.ceil(totalCount / pageSize);

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
});

const getMaxProductPrice = extendType({
  type: "Query",
  definition(t) {
    t.field("maxProductPrice", {
      type: "Float",
      args: {
        subcategoryId: nonNull(idArg()),
        productTypeId: idArg(),
        locale: arg({
          type: nonNull("I18NLocaleCode"),
        }),
      },
      resolve: async (_, { subcategoryId, productTypeId, locale }, ctx) => {
        console.log("maxProductPrice resolver called with:", {
          subcategoryId,
          productTypeId,
          locale,
        });

        const knex = strapi.db.connection;

        let query = knex("products")
          .join(
            "product_types_products_links",
            "products.id",
            "product_types_products_links.product_id"
          )
          .join(
            "product_types_subcategories_links",
            "product_types_products_links.product_type_id",
            "product_types_subcategories_links.product_type_id"
          )
          .where(
            "product_types_subcategories_links.subcategory_id",
            subcategoryId
          )
          .where("products.locale", locale);

        if (productTypeId) {
          query = query.where(
            "product_types_products_links.product_type_id",
            productTypeId
          );
        }

        console.log("SQL Query:", query.toString());

        const result = await query.max("products.retail as maxRetail").first();

        console.log("Query result:", result);
        return result.maxRetail || 0;
      },
    });
  },
});

module.exports = {
  getProductTypeFilters,
  getMaxProductPrice,
  getFilteredProducts,
};
