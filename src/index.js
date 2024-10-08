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
                t.nonNull.string("slug");
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

            nexus.extendType({
              type: "CartItem",
              definition(t) {
                // Only add fields that might be missing from the original CartItem type
                t.nonNull.id("id", { description: "Cart item ID" });
                t.nonNull.field("product", { type: "Product" });
                t.nonNull.int("quantity");
              },
            }),

            nexus.inputObjectType({
              name: "FilterInput",
              definition(t) {
                t.nonNull.string("key");
                t.nonNull.string("value");
              },
            }),

            nexus.inputObjectType({
              name: "CartProductInput",
              definition(t) {
                t.nonNull.id("productId", {
                  description: "The ID of the product",
                });
                t.nonNull.int("quantity");
              },
            }),

            nexus.objectType({
              name: "FavoriteProductResponse",
              definition(t) {
                t.nonNull.list.nonNull.field("favoriteProducts", {
                  type: "FavoriteProduct",
                });
              },
            }),

            nexus.inputObjectType({
              name: "SyncCartInput",
              definition(t) {
                t.nonNull.list.nonNull.field("products", {
                  type: "CartProductInput",
                });
              },
            }),

            nexus.objectType({
              name: "CartProduct",
              definition(t) {
                t.nonNull.id("id");
                t.nonNull.int("quantity");
              },
            }),

            nexus.extendType({
              type: "Cart",
              definition(t) {
                t.nonNull.list.nonNull.field("cart_items", {
                  type: "CartItem",
                  resolve: async (parent, _, ctx) => {
                    const { cart_items } = await strapi.entityService.findOne(
                      "api::cart.cart",
                      parent.id,
                      {
                        populate: ["cart_items.product"],
                      }
                    );
                    return cart_items;
                  },
                });
                t.nonNull.field("users_permissions_user", {
                  type: "UsersPermissionsUser",
                });
              },
            }),

            nexus.objectType({
              name: "CartResponse",
              definition(t) {
                t.nonNull.field("cart", { type: "Cart" });
              },
            }),

            nexus.inputObjectType({
              name: "AddToCartInput",
              definition(t) {
                t.nonNull.id("productId");
                t.nonNull.int("quantity");
              },
            }),

            nexus.inputObjectType({
              name: "UpdateCartItemInput",
              definition(t) {
                t.nonNull.id("productId");
                t.nonNull.int("qtyChange");
              },
            }),

            nexus.inputObjectType({
              name: "RemoveFromCartInput",
              definition(t) {
                t.nonNull.id("productId");
              },
            }),

            nexus.inputObjectType({
              name: "AddToFavoritesInput",
              definition(t) {
                t.nonNull.id("productId");
                t.nonNull.id("productTypeId");
              },
            }),

            nexus.inputObjectType({
              name: "RemoveFromFavoritesInput",
              definition(t) {
                t.nonNull.id("productId");
              },
            }),

            nexus.extendType({
              type: "Query",
              definition(t) {
                t.field("productTypeFilters", {
                  type: "JSON",
                  args: {
                    productTypeId: nexus.idArg(),
                    subcategoryId: nexus.nonNull(nexus.idArg()),
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

                      const queryFilters = {
                        subcategory: {
                          id: {
                            $eq: subcategoryId,
                          },
                        },
                      };

                      if (productTypeId) {
                        queryFilters.product_types = {
                          id: {
                            $in: [productTypeId],
                          },
                        };
                      }

                      const products = await productService.find({
                        filters: queryFilters,
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

                      const resultFilters = {};
                      products.results.forEach((product) => {
                        Object.entries(product.params).forEach(
                          ([key, value]) => {
                            if (allowedFilterKeys.includes(key)) {
                              if (!resultFilters[key]) {
                                resultFilters[key] = new Set();
                              }
                              resultFilters[key].add(value);
                            }
                          }
                        );
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

                      // logToFile(
                      //   `Generated filters: ${JSON.stringify(resultFilters)}`
                      // );
                      return resultFilters;
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
                    productTypeId: nexus.idArg(),
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
                        "products_subcategory_links",
                        "products.id",
                        "products_subcategory_links.product_id"
                      )
                      .where(
                        "products_subcategory_links.subcategory_id",
                        subcategoryId
                      );

                    if (productTypeId) {
                      query = query
                        .join(
                          "product_types_products_links",
                          "products.id",
                          "product_types_products_links.product_id"
                        )
                        .where(
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

            nexus.extendType({
              type: "Query",
              definition(t) {
                t.field("userFavorites", {
                  type: "FavoriteProductResponse",
                  resolve: async (_, __, ctx) => {
                    const { state } = ctx;

                    if (!state.isAuthenticated) {
                      throw new Error(
                        "You must be logged in to view your favorites"
                      );
                    }

                    const { id: userId } = ctx.state.user;

                    const favoriteProducts = await strapi.db
                      .query("api::favorite-product.favorite-product")
                      .findMany({
                        where: { users_permissions_user: userId },
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
            }),

            nexus.extendType({
              type: "Query",
              definition(t) {
                t.field("userCart", {
                  type: "CartResponse",
                  resolve: async (_, __, ctx) => {
                    const { state } = ctx;

                    if (!state.isAuthenticated) {
                      throw new Error(
                        "You must be logged in to view your cart"
                      );
                    }

                    const { id: userId } = ctx.state.user;

                    const cart = await strapi.db
                      .query("api::cart.cart")
                      .findOne({
                        where: { users_permissions_user: userId },
                        populate: {
                          cart_items: {
                            populate: {
                              product: {
                                fields: ["id", "title", "price"],
                              },
                            },
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
            }),

            nexus.extendType({
              type: "Mutation",
              definition(t) {
                t.field("syncCartBySingIn", {
                  type: "CartResponse",
                  args: {
                    input: nexus.arg({ type: nexus.nonNull("SyncCartInput") }),
                  },
                  resolve: async (_, { input }, ctx) => {
                    const { state } = ctx;
                    const { products } = input;

                    if (!state.isAuthenticated) {
                      throw new Error(
                        "You must be logged in to sync your cart"
                      );
                    }

                    const { id: userId } = ctx.state.user;

                    let cart;
                    try {
                      cart = await strapi.db.query("api::cart.cart").findOne({
                        where: { users_permissions_user: userId },
                        populate: [
                          "cart_items.product",
                          "users_permissions_user",
                        ],
                      });

                      if (!cart) {
                        const newCart = await strapi.entityService.create(
                          "api::cart.cart",
                          {
                            data: {
                              users_permissions_user: userId,
                              publishedAt: new Date().toISOString(),
                            },
                          }
                        );

                        cart = await strapi.entityService.findOne(
                          "api::cart.cart",
                          newCart.id,
                          {
                            populate: [
                              "cart_items.product",
                              "users_permissions_user",
                            ],
                          }
                        );
                      }
                    } catch (error) {
                      console.error("Error creating or fetching cart:", error);
                      throw new Error(
                        "An error occurred while managing the cart"
                      );
                    }

                    for (const product of products) {
                      try {
                        // First, verify that the product exists
                        const existingProduct =
                          await strapi.entityService.findOne(
                            "api::product.product",
                            product.productId,
                            { fields: ["id"] }
                          );

                        if (!existingProduct) {
                          console.error(
                            `Product with ID ${product.productId} not found`
                          );
                          continue; // Skip this product if it doesn't exist
                        }

                        // Check if the product already exists in the cart
                        const existingCartItem = await strapi.db
                          .query("api::cart-item.cart-item")
                          .findOne({
                            where: {
                              cart: cart.id,
                              product: existingProduct.id,
                            },
                            populate: ["product"],
                          });

                        if (existingCartItem) {
                          // Update the quantity if the cart item already exists

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
                          // Create a new cart item if it doesn't exist

                          await strapi.entityService.create(
                            "api::cart-item.cart-item",
                            {
                              data: {
                                product: existingProduct.id,
                                quantity: Math.max(1, product.quantity),
                                cart: cart.id,
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

                    // After processing all products, fetch the updated cart with populated relations
                    const updatedCart = await strapi.entityService.findOne(
                      "api::cart.cart",
                      cart.id,
                      {
                        populate: {
                          cart_items: {
                            populate: ["product"],
                          },
                          users_permissions_user: true,
                        },
                      }
                    );

                    return { cart: updatedCart };
                  },
                });

                t.field("addToCart", {
                  type: "CartResponse",
                  args: {
                    input: nexus.arg({ type: nexus.nonNull("AddToCartInput") }),
                  },
                  resolve: async (_, { input }, ctx) => {
                    const { state } = ctx;
                    const { productId, quantity } = input;

                    if (!state.isAuthenticated) {
                      throw new Error(
                        "You must be logged in to modify your cart"
                      );
                    }

                    const { id: userId } = ctx.state.user;

                    try {
                      let cart = await strapi.db
                        .query("api::cart.cart")
                        .findOne({
                          where: { users_permissions_user: userId },
                          populate: ["cart_items.product"],
                        });

                      if (!cart) {
                        cart = await strapi.entityService.create(
                          "api::cart.cart",
                          {
                            data: {
                              users_permissions_user: userId,
                              publishedAt: new Date().toISOString(),
                            },
                          }
                        );
                      }

                      const existingCartItem = cart.cart_items.find(
                        (item) => item.product.id === productId
                      );

                      if (existingCartItem) {
                        await strapi.entityService.update(
                          "api::cart-item.cart-item",
                          existingCartItem.id,
                          {
                            data: {
                              quantity: Math.max(
                                1,
                                existingCartItem.quantity + quantity
                              ),
                            },
                          }
                        );
                      } else {
                        await strapi.entityService.create(
                          "api::cart-item.cart-item",
                          {
                            data: {
                              product: productId,
                              quantity: Math.max(1, quantity),
                              cart: cart.id,
                              publishedAt: new Date().toISOString(),
                            },
                          }
                        );
                      }

                      const updatedCart = await strapi.entityService.findOne(
                        "api::cart.cart",
                        cart.id,
                        {
                          populate: [
                            "cart_items.product",
                            "users_permissions_user",
                          ],
                        }
                      );

                      return { cart: updatedCart };
                    } catch (error) {
                      console.error("Error adding to cart:", error);
                      throw new Error(
                        "An error occurred while adding to the cart"
                      );
                    }
                  },
                });

                t.field("updateCartItem", {
                  type: "CartResponse",
                  args: {
                    input: nexus.arg({
                      type: nexus.nonNull("UpdateCartItemInput"),
                    }),
                  },
                  resolve: async (_, { input }, ctx) => {
                    const { state } = ctx;
                    const { productId, qtyChange } = input;

                    if (!state.isAuthenticated) {
                      throw new Error(
                        "You must be logged in to modify your cart"
                      );
                    }

                    const { id: userId } = ctx.state.user;

                    try {
                      let cart = await strapi.db
                        .query("api::cart.cart")
                        .findOne({
                          where: { users_permissions_user: userId },
                          populate: ["cart_items.product"],
                        });

                      if (!cart) {
                        // Создаем корзину, если она не существует
                        cart = await strapi.entityService.create(
                          "api::cart.cart",
                          {
                            data: {
                              users_permissions_user: userId,
                              publishedAt: new Date().toISOString(),
                            },
                          }
                        );
                      }

                      const existingCartItem = cart.cart_items.find(
                        (item) =>
                          item.product.id.toString() === productId.toString()
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
                        // Добавляем новый товар
                        await strapi.entityService.create(
                          "api::cart-item.cart-item",
                          {
                            data: {
                              product: productId,
                              quantity: Math.max(1, qtyChange),
                              cart: cart.id,
                              publishedAt: new Date().toISOString(),
                            },
                          }
                        );
                      }

                      const updatedCart = await strapi.entityService.findOne(
                        "api::cart.cart",
                        cart.id,
                        {
                          populate: [
                            "cart_items.product",
                            "users_permissions_user",
                          ],
                        }
                      );

                      return { cart: updatedCart };
                    } catch (error) {
                      console.error("Error updating cart:", error);
                      throw new Error(
                        "An error occurred while updating the cart"
                      );
                    }
                  },
                });

                t.field("removeFromCart", {
                  type: "CartResponse",
                  args: {
                    input: nexus.arg({
                      type: nexus.nonNull("RemoveFromCartInput"),
                    }),
                  },
                  resolve: async (_, { input }, ctx) => {
                    const { state } = ctx;
                    const { productId } = input;

                    if (!state.isAuthenticated) {
                      throw new Error(
                        "You must be logged in to modify your cart"
                      );
                    }

                    const { id: userId } = ctx.state.user;

                    try {
                      const cart = await strapi.db
                        .query("api::cart.cart")
                        .findOne({
                          where: { users_permissions_user: userId },
                          populate: ["cart_items.product"],
                        });

                      if (!cart) {
                        throw new Error("Cart not found");
                      }

                      const cartItem = cart.cart_items.find(
                        (item) =>
                          item.product.id.toString() === productId.toString()
                      );

                      if (cartItem) {
                        await strapi.entityService.delete(
                          "api::cart-item.cart-item",
                          cartItem.id
                        );
                      }

                      const updatedCart = await strapi.entityService.findOne(
                        "api::cart.cart",
                        cart.id,
                        {
                          populate: [
                            "cart_items.product",
                            "users_permissions_user",
                          ],
                        }
                      );

                      return { cart: updatedCart };
                    } catch (error) {
                      console.error("Error removing from cart:", error);
                      throw new Error(
                        "An error occurred while removing from the cart"
                      );
                    }
                  },
                });
                t.field("clearCart", {
                  type: "CartResponse",
                  resolve: async (_, __, ctx) => {
                    const { state } = ctx;

                    if (!state.isAuthenticated) {
                      throw new Error(
                        "You must be logged in to modify your cart"
                      );
                    }

                    const { id: userId } = ctx.state.user;

                    try {
                      const cart = await strapi.db
                        .query("api::cart.cart")
                        .findOne({
                          where: { users_permissions_user: userId },
                          populate: ["cart_items"],
                        });

                      if (!cart) {
                        throw new Error("Cart not found");
                      }

                      // Delete all cart items
                      await Promise.all(
                        cart.cart_items.map((item) =>
                          strapi.entityService.delete(
                            "api::cart-item.cart-item",
                            item.id
                          )
                        )
                      );

                      // Fetch the updated cart
                      const updatedCart = await strapi.entityService.findOne(
                        "api::cart.cart",
                        cart.id,
                        {
                          populate: [
                            "cart_items.product",
                            "users_permissions_user",
                          ],
                        }
                      );

                      return { cart: updatedCart };
                    } catch (error) {
                      console.error("Error clearing cart:", error);
                      throw new Error(
                        "An error occurred while clearing the cart"
                      );
                    }
                  },
                });
              },
            }),
            nexus.extendType({
              type: "Mutation",
              definition(t) {
                t.field("addToFavorites", {
                  type: "FavoriteProductResponse",
                  args: {
                    input: nexus.arg({
                      type: nexus.nonNull("AddToFavoritesInput"),
                    }),
                  },
                  resolve: async (_, { input }, ctx) => {
                    const { state } = ctx;
                    const { productId, productTypeId } = input;

                    if (!state.isAuthenticated) {
                      throw new Error(
                        "You must be logged in to modify your favorites"
                      );
                    }

                    const { id: userId } = ctx.state.user;

                    try {
                      const existingFavorite = await strapi.db
                        .query("api::favorite-product.favorite-product")
                        .findOne({
                          where: {
                            users_permissions_user: userId,
                            product: productId,
                          },
                        });

                      if (existingFavorite) {
                        throw new Error(
                          "This product is already in your favorites"
                        );
                      }

                      await strapi.entityService.create(
                        "api::favorite-product.favorite-product",
                        {
                          data: {
                            product: productId,
                            product_type: productTypeId,
                            users_permissions_user: userId,
                            publishedAt: new Date().toISOString(),
                          },
                        }
                      );

                      const updatedFavorites = await strapi.db
                        .query("api::favorite-product.favorite-product")
                        .findMany({
                          where: { users_permissions_user: userId },
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
                      throw new Error(
                        "An error occurred while adding to favorites"
                      );
                    }
                  },
                });

                t.field("removeFromFavorites", {
                  type: "FavoriteProductResponse",
                  args: {
                    input: nexus.arg({
                      type: nexus.nonNull("RemoveFromFavoritesInput"),
                    }),
                  },
                  resolve: async (_, { input }, ctx) => {
                    const { state } = ctx;
                    const { productId } = input;

                    if (!state.isAuthenticated) {
                      throw new Error(
                        "You must be logged in to modify your favorites"
                      );
                    }

                    const { id: userId } = ctx.state.user;

                    try {
                      const favoriteToRemove = await strapi.db
                        .query("api::favorite-product.favorite-product")
                        .findOne({
                          where: {
                            product: productId,
                            users_permissions_user: userId,
                          },
                        });

                      if (!favoriteToRemove) {
                        throw new Error("Favorite product not found");
                      }

                      await strapi.entityService.delete(
                        "api::favorite-product.favorite-product",
                        favoriteToRemove.id
                      );

                      const updatedFavorites = await strapi.db
                        .query("api::favorite-product.favorite-product")
                        .findMany({
                          where: { users_permissions_user: userId },
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
                      throw new Error(
                        "An error occurred while removing from favorites"
                      );
                    }
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

    await strapi
      .service("plugin::users-permissions.providers-registry")
      .register(`google`, ({ purest }) => async ({ query }) => {
        const google = purest({ provider: "google" });

        const res = await google
          .get("https://www.googleapis.com/oauth2/v3/userinfo")
          .auth(query.access_token)
          .request();

        const { body } = res;

        return {
          email: body.email,
          firstname: body.given_name,
          lastname: body.family_name,
          picture: body.picture,
          provider: "google",
          username: body.name,
        };
      });
  },
};
