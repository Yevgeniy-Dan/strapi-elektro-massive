const { extendType, nonNull, arg } = require("nexus");

const getUserCartQuery = extendType({
  type: "Query",
  definition(t) {
    t.field("userCart", {
      type: "CartResponse",
      args: {
        locale: arg({
          type: nonNull("I18NLocaleCode"),
        }),
      },
      resolve: async (_, { locale }, ctx) => {
        const { state } = ctx;

        if (!state.isAuthenticated) {
          throw new Error("You must be logged in to view your cart");
        }

        const { id: userId } = ctx.state.user;

        const cart = await strapi.db.query("api::cart.cart").findOne({
          where: {
            users_permissions_user: userId,
            locale: locale,
          },
          populate: {
            cart_items: {
              populate: ["product"],
            },
            users_permissions_user: true,
          },
        });

        if (!cart) {
          return { cart: null };
        }

        return { cart };
      },
    });
  },
});

const syncCartMutation = extendType({
  type: "Mutation",
  definition(t) {
    t.field("syncCartBySingIn", {
      type: "CartResponse",
      args: {
        input: arg({ type: nonNull("SyncCartInput") }),
        locale: arg({
          type: nonNull("I18NLocaleCode"),
        }),
      },
      resolve: async (_, { input, locale }, ctx) => {
        const { state } = ctx;
        const { products } = input;

        if (!state.isAuthenticated) {
          throw new Error("You must be logged in to sync your cart");
        }

        const { id: userId } = ctx.state.user;
        const locales = ["uk", "ru"];

        try {
          for (const currentLocale of locales) {
            let cart = await strapi.db.query("api::cart.cart").findOne({
              where: {
                users_permissions_user: userId,
                locale: currentLocale,
              },
              populate: ["cart_items.product", "users_permissions_user"],
            });

            if (!cart) {
              const newCart = await strapi.entityService.create(
                "api::cart.cart",
                {
                  data: {
                    users_permissions_user: userId,
                    locale: currentLocale,
                    publishedAt: new Date().toISOString(),
                  },
                }
              );

              cart = await strapi.entityService.findOne(
                "api::cart.cart",
                newCart.id,
                {
                  populate: ["cart_items.product", "users_permissions_user"],
                }
              );
            }

            for (const product of products) {
              try {
                const existingProduct = await strapi.entityService.findOne(
                  "api::product.product",
                  product.productId,
                  { populate: ["localizations"] }
                );

                if (!existingProduct) {
                  console.error(
                    `Product with ID ${product.productId} not found`
                  );
                  continue;
                }

                const localizedProductId =
                  currentLocale === locale
                    ? product.productId
                    : existingProduct.localizations.find(
                        (loc) => loc.locale === currentLocale
                      )?.id;

                if (!localizedProductId) {
                  console.error(
                    `Localized product not found for locale: ${currentLocale}`
                  );
                  continue;
                }

                const existingCartItem = await strapi.db
                  .query("api::cart-item.cart-item")
                  .findOne({
                    where: {
                      cart: cart.id,
                      product: localizedProductId,
                    },
                    populate: ["product"],
                  });

                if (existingCartItem) {
                  await strapi.entityService.update(
                    "api::cart-item.cart-item",
                    existingCartItem.id,
                    {
                      data: {
                        quantity: Math.max(
                          1,
                          product.quantity + existingCartItem.quantity
                        ),
                      },
                    }
                  );
                } else {
                  await strapi.entityService.create(
                    "api::cart-item.cart-item",
                    {
                      data: {
                        product: localizedProductId,
                        quantity: Math.max(1, product.quantity),
                        cart: cart.id,
                        locale: currentLocale,
                        publishedAt: new Date().toISOString(),
                      },
                    }
                  );
                }
              } catch (error) {
                console.error(
                  `Error processing cart item for product ${product.productId}:`,
                  error
                );
              }
            }
          }

          // Fetch the updated cart for the requested locale
          const updatedCart = await strapi.db.query("api::cart.cart").findOne({
            where: {
              users_permissions_user: userId,
              locale: locale,
            },
            populate: {
              cart_items: {
                populate: ["product"],
              },
              users_permissions_user: true,
            },
          });

          return { cart: updatedCart };
        } catch (error) {
          console.error("Error syncing cart:", error);
          throw new Error("An error occurred while syncing the cart");
        }
      },
    });
  },
});

const cartMutations = extendType({
  type: "Mutation",
  definition(t) {
    t.field("updateCartItem", {
      type: "CartResponse",
      args: {
        input: arg({
          type: nonNull("UpdateCartItemInput"),
        }),
        locale: arg({
          type: nonNull("I18NLocaleCode"),
        }),
      },
      resolve: async (_, { input, locale }, ctx) => {
        const { state } = ctx;
        const { productId, qtyChange } = input;

        if (!state.isAuthenticated) {
          throw new Error("You must be logged in to modify your cart");
        }

        const { id: userId } = ctx.state.user;

        try {
          const locales = ["uk", "ru"];
          for (const currentLocale of locales) {
            let cart = await strapi.db.query("api::cart.cart").findOne({
              where: {
                users_permissions_user: userId,
                locale: currentLocale,
              },
              populate: ["cart_items.product"],
            });

            if (!cart) {
              cart = await strapi.entityService.create("api::cart.cart", {
                data: {
                  users_permissions_user: userId,
                  locale: currentLocale,
                  publishedAt: new Date().toISOString(),
                },
              });
            }

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

            const existingCartItem = cart.cart_items.find(
              (item) =>
                item.product.id.toString() === localizedProductId.toString()
            );

            if (existingCartItem) {
              const newQuantity = Math.max(
                1,
                existingCartItem.quantity + qtyChange
              );
              await strapi.entityService.update(
                "api::cart-item.cart-item",
                existingCartItem.id,
                {
                  data: { quantity: newQuantity },
                }
              );
            } else {
              await strapi.entityService.create("api::cart-item.cart-item", {
                data: {
                  product: localizedProductId,
                  quantity: Math.max(1, qtyChange),
                  cart: cart.id,
                  locale: currentLocale,
                  publishedAt: new Date().toISOString(),
                },
              });
            }
          }

          const updatedCart = await strapi.db.query("api::cart.cart").findOne({
            where: {
              users_permissions_user: userId,
              locale: locale,
            },
            populate: {
              cart_items: {
                populate: ["product"],
              },
              users_permissions_user: true,
            },
          });

          return { cart: updatedCart };
        } catch (error) {
          console.error("Error updating cart:", error);
          throw new Error("An error occurred while updating the cart");
        }
      },
    });

    t.field("removeFromCart", {
      type: "CartResponse",
      args: {
        input: arg({
          type: nonNull("RemoveFromCartInput"),
        }),
        locale: arg({
          type: nonNull("I18NLocaleCode"),
        }),
      },
      resolve: async (_, { input, locale }, ctx) => {
        const { state } = ctx;
        const { productId } = input;

        if (!state.isAuthenticated) {
          throw new Error("You must be logged in to modify your cart");
        }

        const { id: userId } = ctx.state.user;

        try {
          const locales = ["uk", "ru"];
          for (const currentLocale of locales) {
            const cart = await strapi.db.query("api::cart.cart").findOne({
              where: {
                users_permissions_user: userId,
                locale: currentLocale,
              },
              populate: ["cart_items.product"],
            });

            if (!cart) continue;

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

            const cartItem = cart.cart_items.find(
              (item) =>
                item.product.id.toString() === localizedProductId.toString()
            );

            if (cartItem) {
              await strapi.entityService.delete(
                "api::cart-item.cart-item",
                cartItem.id
              );
            }
          }

          const updatedCart = await strapi.db.query("api::cart.cart").findOne({
            where: {
              users_permissions_user: userId,
              locale: locale,
            },
            populate: {
              cart_items: {
                populate: ["product"],
              },
              users_permissions_user: true,
            },
          });

          return { cart: updatedCart };
        } catch (error) {
          console.error("Error removing from cart:", error);
          throw new Error("An error occurred while removing from the cart");
        }
      },
    });

    t.field("clearCart", {
      type: "CartResponse",
      args: {
        locale: arg({
          type: nonNull("I18NLocaleCode"),
        }),
      },
      resolve: async (_, { locale }, ctx) => {
        const { state } = ctx;

        if (!state.isAuthenticated) {
          throw new Error("You must be logged in to modify your cart");
        }

        const { id: userId } = ctx.state.user;

        try {
          const locales = ["uk", "ru"];
          for (const currentLocale of locales) {
            const cart = await strapi.db.query("api::cart.cart").findOne({
              where: {
                users_permissions_user: userId,
                locale: currentLocale,
              },
              populate: ["cart_items"],
            });

            if (cart) {
              await Promise.all(
                cart.cart_items.map((item) =>
                  strapi.entityService.delete(
                    "api::cart-item.cart-item",
                    item.id
                  )
                )
              );
            }
          }

          const updatedCart = await strapi.db.query("api::cart.cart").findOne({
            where: {
              users_permissions_user: userId,
              locale: locale,
            },
            populate: {
              cart_items: {
                populate: ["product"],
              },
              users_permissions_user: true,
            },
          });

          return { cart: updatedCart };
        } catch (error) {
          console.error("Error clearing cart:", error);
          throw new Error("An error occurred while clearing the cart");
        }
      },
    });
  },
});

module.exports = {
  getUserCartQuery,
  syncCartMutation,
  cartMutations,
};
