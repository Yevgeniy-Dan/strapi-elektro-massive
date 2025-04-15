const { objectType, extendType, inputObjectType } = require("nexus");

const ProductListResult = objectType({
  name: "ProductListResult",
  definition(t) {
    t.nonNull.list.nonNull.field("products", { type: "Product" });
    t.nonNull.int("currentPage");
    t.nonNull.int("pageCount");
    t.nonNull.int("totalCount");
    t.string("nextCursor");
  },
});

const CartResponse = objectType({
  name: "CartResponse",
  definition(t) {
    t.nonNull.field("cart", { type: "Cart" });
  },
});

const AddToCartInput = inputObjectType({
  name: "AddToCartInput",
  definition(t) {
    t.nonNull.id("productId");
    t.nonNull.int("quantity");
  },
});

const UpdateCartItemInput = inputObjectType({
  name: "UpdateCartItemInput",
  definition(t) {
    t.nonNull.id("productId");
    t.nonNull.int("qtyChange");
  },
});

const RemoveFromCartInput = inputObjectType({
  name: "RemoveFromCartInput",
  definition(t) {
    t.nonNull.id("productId");
  },
});

const AddFavoritesInput = inputObjectType({
  name: "AddToFavoritesInput",
  definition(t) {
    t.nonNull.id("productId");
    t.nonNull.id("productTypeId");
  },
});

const RemoveFromFavoritesInput = inputObjectType({
  name: "RemoveFromFavoritesInput",
  definition(t) {
    t.nonNull.id("productId");
  },
});

const FavoriteProductResponse = objectType({
  name: "FavoriteProductResponse",
  definition(t) {
    t.nonNull.list.nonNull.field("favoriteProducts", {
      type: "FavoriteProduct",
    });
  },
});

const CartProduct = objectType({
  name: "CartProduct",
  definition(t) {
    t.nonNull.id("id");
    t.nonNull.int("quantity");
  },
});

const FilterInput = inputObjectType({
  name: "FilterInput",
  definition(t) {
    t.nonNull.string("key");
    t.nonNull.string("code");
  },
});

const CartProductInput = inputObjectType({
  name: "CartProductInput",
  definition(t) {
    t.nonNull.id("productId", {
      description: "The ID of the product",
    });
    t.nonNull.int("quantity");
  },
});

const SyncCartInput = inputObjectType({
  name: "SyncCartInput",
  definition(t) {
    t.nonNull.list.nonNull.field("products", {
      type: "CartProductInput",
    });
  },
});

const ProductExtension = extendType({
  type: "Product",
  definition(t) {
    // Add any fields that might be missing from the original Product type
    t.nonNull.id("id");
    t.nonNull.string("slug");
  },
});

const CartExtension = extendType({
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
});

const CartItemExtension = extendType({
  type: "CartItem",
  definition(t) {
    // Only add fields that might be missing from the original CartItem type
    t.nonNull.id("id", { description: "Cart item ID" });
    t.nonNull.field("product", { type: "Product" });
    t.nonNull.int("quantity");
  },
});

module.exports = {
  ProductListResult,
  ProductExtension,
  CartExtension,
  CartItemExtension,
  CartResponse,
  AddToCartInput,
  UpdateCartItemInput,
  RemoveFromCartInput,
  AddFavoritesInput,
  RemoveFromFavoritesInput,
  FavoriteProductResponse,
  CartProduct,
  FilterInput,
  CartProductInput,
  SyncCartInput,
};
