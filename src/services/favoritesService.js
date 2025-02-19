const { extendType, nonNull, arg } = require("nexus");

const getUserFavoritesQuery = extendType({
  type: "Query",
  definition(t) {
    t.field("userFavorites", {
      type: "FavoriteProductResponse",
      args: {
        locale: arg({
          type: nonNull("I18NLocaleCode"),
        }),
      },
      resolve: async (_, { locale }, ctx) => {
        const { state } = ctx;

        if (!state.isAuthenticated) {
          throw new Error("You must be logged in to view your favorites");
        }

        const { id: userId } = ctx.state.user;

        const favoriteProducts = await strapi.db
          .query("api::favorite-product.favorite-product")
          .findMany({
            where: {
              users_permissions_user: userId,
              locale: locale,
            },
            populate: {
              product: {
                populate: ["image", "subcategory"],
              },
              product_type: true,
            },
          });

        if (!favoriteProducts) {
          return { favoriteProducts: [] };
        }

        return { favoriteProducts };
      },
    });
  },
});

const favoritesMutations = extendType({
  type: "Mutation",
  definition(t) {
    t.field("addToFavorites", {
      type: "FavoriteProductResponse",
      args: {
        input: arg({
          type: nonNull("AddToFavoritesInput"),
        }),
        locale: arg({
          type: nonNull("I18NLocaleCode"),
        }),
      },
      resolve: async (_, { input, locale }, ctx) => {
        const { state } = ctx;
        const { productId, productTypeId } = input;

        if (!state.isAuthenticated) {
          throw new Error("You must be logged in to modify your favorites");
        }

        const { id: userId } = ctx.state.user;
        const locales = ["uk", "ru"];

        try {
          for (const currentLocale of locales) {
            const product = await strapi.entityService.findOne(
              "api::product.product",
              productId,
              { populate: ["localizations"] }
            );

            const localizedProductId =
              currentLocale === locale
                ? productId
                : product.localizations.find(
                    (loc) => loc.locale === currentLocale
                  )?.id;

            if (!localizedProductId) {
              console.error(
                `Localized product not found for locale: ${currentLocale}`
              );
              continue;
            }

            const existingFavorite = await strapi.db
              .query("api::favorite-product.favorite-product")
              .findOne({
                where: {
                  users_permissions_user: userId,
                  product: localizedProductId,
                  locale: currentLocale,
                },
              });

            if (existingFavorite) {
              console.log(
                `Product already in favorites for locale: ${currentLocale}`
              );
              continue;
            }

            await strapi.entityService.create(
              "api::favorite-product.favorite-product",
              {
                data: {
                  product: localizedProductId,
                  product_type: productTypeId,
                  users_permissions_user: userId,
                  locale: currentLocale,
                  publishedAt: new Date().toISOString(),
                },
              }
            );
          }

          const updatedFavorites = await strapi.db
            .query("api::favorite-product.favorite-product")
            .findMany({
              where: {
                users_permissions_user: userId,
                locale: locale,
              },
              populate: {
                product: {
                  populate: ["image", "subcategory"],
                },
                product_type: true,
              },
            });

          return { favoriteProducts: updatedFavorites };
        } catch (error) {
          console.error("Error adding to favorites:", error);
          throw new Error("An error occurred while adding to favorites");
        }
      },
    });

    t.field("removeFromFavorites", {
      type: "FavoriteProductResponse",
      args: {
        input: arg({
          type: nonNull("RemoveFromFavoritesInput"),
        }),
        locale: arg({
          type: nonNull("I18NLocaleCode"),
        }),
      },
      resolve: async (_, { input, locale }, ctx) => {
        const { state } = ctx;
        const { productId } = input;

        if (!state.isAuthenticated) {
          throw new Error("You must be logged in to modify your favorites");
        }

        const { id: userId } = ctx.state.user;

        try {
          const locales = ["uk", "ru"];
          for (const currentLocale of locales) {
            const product = await strapi.entityService.findOne(
              "api::product.product",
              productId,
              { populate: ["localizations"] }
            );

            const localizedProductId =
              currentLocale === locale
                ? productId
                : product.localizations.find(
                    (loc) => loc.locale === currentLocale
                  )?.id;

            if (!localizedProductId) {
              console.error(
                `Localized product not found for locale: ${currentLocale}`
              );
              continue;
            }

            const favoriteToRemove = await strapi.db
              .query("api::favorite-product.favorite-product")
              .findOne({
                where: {
                  product: localizedProductId,
                  users_permissions_user: userId,
                  locale: currentLocale,
                },
              });

            if (favoriteToRemove) {
              await strapi.entityService.delete(
                "api::favorite-product.favorite-product",
                favoriteToRemove.id
              );
            }
          }

          const updatedFavorites = await strapi.db
            .query("api::favorite-product.favorite-product")
            .findMany({
              where: {
                users_permissions_user: userId,
                locale: locale,
              },
              populate: {
                product: {
                  populate: ["image", "subcategory"],
                },
                product_type: true,
              },
            });

          return { favoriteProducts: updatedFavorites };
        } catch (error) {
          console.error("Error removing from favorites:", error);
          throw new Error("An error occurred while removing from favorites");
        }
      },
    });
  },
});

module.exports = {
  getUserFavoritesQuery,
  favoritesMutations,
};
