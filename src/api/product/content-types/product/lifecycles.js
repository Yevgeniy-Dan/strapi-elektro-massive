module.exports = {
  async beforeCreate(event) {
    await validateUniquesSlug(event);

    // Initialize langMatches for the new product, adding a match between the current language and the slug.
    // For example, if locale: "uk" and slug: "telefony", then langMatches will be { "uk": "telefony" }
    const { data } = event.params;

    if (data.slug) {
      const langMatches = {
        [data.locale]: data.slug,
      };
      data.langMatches = langMatches;
    }

    if (data.retail) {
      data.lastPriceUpdatedAt = new Date();
    }
  },

  async beforeUpdate(event) {
    await validateUniquesSlug(event);

    // When updating a product, we first find it with all its language versions (localizations).
    // Then we create a map of all available translations: we start with the current language's slug,
    // and then add slugs from all other language versions. This way langMatches will contain
    // something like { "en": "phones", "uk": "telefony", "ru": "telefony" }
    const { data, where } = event.params;

    // If the rettail field is changed, we update the lastPriceUpdatedAt field.
    if (data.retail) {
      const currentProduct = await strapi.db
        .query("api::product.product")
        .findOne({
          where: { id: where.id },
          select: ["retail", "discount"],
        });

      if (data.retail && data.retail !== currentProduct.retail) {
        data.lastPriceUpdatedAt = new Date();
        console.log(
          `Price changed for product ${where.id}, updating lastPriceUpdatedAt`
        );
      }
    }

    if (data.slug) {
      const product = await strapi.db.query("api::product.product").findOne({
        where: {
          id: where.id,
        },
        populate: ["localizations"],
      });

      if (!product.locale) {
        console.error(`No locale found for product ${where.id}`);
        throw new Error("Locale is required for product update");
      }

      const langMatches = {};
      langMatches[product.locale] = data.slug;

      if (product.localizations) {
        product.localizations.forEach((localization) => {
          langMatches[localization.locale] = localization.slug;
        });
      }

      data.langMatches = langMatches;
    }
  },

  async afterCreate(event) {
    const { result } = event;

    /**
     * Product afterCreate lifecycle hook
     *
     * This function handles copying relation fields (product_types and subcategory) when
     * creating localized versions of products. It solves the issue where Strapi's "Fill in from another"
     * functionality doesn't properly copy relation fields between localized content.
     *
     * The process works as follows:
     * 1. If the newly created product is not in Ukrainian locale (our source of truth)
     * 2. Find the Ukrainian version of this product from its localizations
     * 3. For each product_type (many-to-many relation) in the Ukrainian version:
     *    - Find its localized version matching the current product's locale
     *    - Build an array of localized product_type IDs
     * 4. For the subcategory (one-to-one relation):
     *    - Find its localized version matching the current product's locale
     * 5. Update the current product with these localized relation IDs
     *
     * This ensures that proper localized versions of relations are linked, accommodating
     * Strapi's design where the same content has different IDs across locales.
     */

    const sourceLocale = "uk";

    if (result.locale !== sourceLocale) {
      try {
        const ukrainianProduct = await strapi.db
          .query("api::product.product")
          .findOne({
            where: {
              locale: sourceLocale,
              id: { $in: result.localizations?.map((l) => l.id) || [] },
            },
            populate: {
              product_parameters: {
                populate: {
                  parameter_value: {
                    populate: ["localizations"],
                  },
                },
              },
              product_types: {
                populate: ["localizations"],
              },
              subcategory: {
                populate: ["localizations"],
              },
            },
          });

        if (ukrainianProduct) {
          const relationsToUpdate = {};

          if (
            ukrainianProduct.product_types &&
            ukrainianProduct.product_types.length > 0
          ) {
            const localizedProductTypeIds = [];

            for (const productType of ukrainianProduct.product_types) {
              const localizedProductType = productType.localizations?.find(
                (loc) => loc.locale === result.locale
              );

              localizedProductTypeIds.push(localizedProductType?.id);
            }

            relationsToUpdate.product_types =
              localizedProductTypeIds.filter(Boolean);
          }

          if (ukrainianProduct.subcategory) {
            const localizedSubcategory =
              ukrainianProduct.subcategory.localizations?.find(
                (loc) => loc.locale === result.locale
              );

            relationsToUpdate.subcategory = localizedSubcategory?.id;
          }

          if (
            ukrainianProduct.product_parameters &&
            ukrainianProduct.product_parameters.length > 0
          ) {
            const localizedProductParameters = [];

            for (const productParameter of ukrainianProduct.product_parameters) {
              const localizedParameterValue =
                productParameter.parameter_value.localizations?.find(
                  (val) => val.locale === result.locale
                );

              if (localizedParameterValue) {
                localizedProductParameters.push({
                  parameter_value: localizedParameterValue.id,
                });
              }
            }

            relationsToUpdate.product_parameters = localizedProductParameters;
          }
          if (Object.keys(relationsToUpdate).length > 0) {
            await strapi.db.query("api::product.product").update({
              where: { id: result.id },
              data: relationsToUpdate,
            });

            console.log(
              `Localized relations copied to ${result.locale} version for product ${result.id}`
            );
          }
        }
      } catch (error) {
        console.error("Error copying relations from Ukrainian version:", error);
      }
    }
    // After creating a new product:
    // 1. We create a mapping of language codes to their respective slugs (updatedLangMatches)
    // 2. Start with the current product's language and slug
    // 3. Add slugs from all localized versions
    // 4. Finally, update ALL related product records (both the original and its translations)
    //    with this complete mapping, so each version knows how to find its siblings

    if (result.localizations) {
      const updatedLangMatches = {};

      updatedLangMatches[result.locale] = result.slug;

      result.localizations.forEach((localization) => {
        updatedLangMatches[localization.locale] = localization.slug;
      });

      await strapi.db.query("api::product.product").updateMany({
        where: {
          id: {
            $in: [...result.localizations.map((l) => l.id), result.id],
          },
        },
        data: {
          langMatches: updatedLangMatches,
        },
      });
    }
  },

  async afterUpdate(event) {
    const { result } = event;

    const sourceLocale = "uk";

    if (result.locale === sourceLocale) {
      try {
        const localizations = await strapi.db
          .query("api::product.product")
          .findMany({
            where: {
              id: { $in: result.localizations?.map((l) => l.id) || [] },
            },
          });

        if (localizations && localizations.length > 0) {
          await Promise.all(
            localizations.map(async (localization) => {
              const priceChanged = localization.retail !== result.retail;

              const updateData = {
                retail: result.retail,
                discount: result.discount,
                currency: result.currency,
              };

              if (priceChanged) {
                updateData.lastPriceUpdatedAt = result.lastPriceUpdatedAt;
              }

              await strapi.db.query("api::product.product").update({
                where: { id: localization.id },
                data: updateData,
              });

              if (priceChanged) {
                console.log(
                  `Price changed and synchronized from ${result.locale} to ${localization.locale} version for product ${localization.id}`
                );
              } else {
                console.log(
                  `Price synchronized from ${result.locale} to ${localization.locale} version for product ${localization.id} (no change)`
                );
              }
            })
          );
        }
      } catch (error) {
        console.error(
          "Error synchronizing prices between localizations:",
          error
        );
      }

      try {
        // We receive an updated product with its localizations
        const product = await strapi.db.query("api::product.product").findOne({
          where: { id: result.id },
          populate: ["localizations"],
        });

        if (
          !product ||
          !product.localizations ||
          product.localizations.length === 0
        ) {
          return;
        }

        // We receive all localizations of the product
        const localizationIds = product.localizations.map((l) => l.id);

        // Get relationship information for the current product
        // Use direct database query for efficiency
        const knex = strapi.db.connection;

        // 1. Synchronize subcategory
        // Get the subcategory ID of the current product
        const productSubcategoryResult = await knex(
          "products_subcategory_links"
        )
          .select("subcategory_id")
          .where("product_id", product.id)
          .first();

        if (
          productSubcategoryResult &&
          productSubcategoryResult.subcategory_id
        ) {
          const subcategoryId = productSubcategoryResult.subcategory_id;

          const subcategoryLocalizations = await knex(
            "subcategories_localizations_links"
          )
            .select(["subcategory_id", "inv_subcategory_id"])
            .where("subcategory_id", subcategoryId)
            .orWhere("inv_subcategory_id", subcategoryId);

          // Create a set of all subcategory IDs (including localizations)
          const allSubcategoryIds = new Set([subcategoryId]);
          subcategoryLocalizations.forEach((link) => {
            allSubcategoryIds.add(link.subcategory_id);
            allSubcategoryIds.add(link.inv_subcategory_id);
          });

          // For each localization of the product, find the corresponding localization of the subcategory
          for (const localizationId of localizationIds) {
            // Get the locale of the product localization
            const localizationResult = await knex("products")
              .select("locale")
              .where("id", localizationId)
              .first();

            if (localizationResult && localizationResult.locale) {
              const locale = localizationResult.locale;

              // Find the localization of the subcategory with the same locale
              const localizedSubcategoryResult = await knex("subcategories")
                .select("id")
                .where("locale", locale)
                .whereIn("id", Array.from(allSubcategoryIds))
                .first();

              if (localizedSubcategoryResult && localizedSubcategoryResult.id) {
                await knex("products_subcategory_links")
                  .where("product_id", localizationId)
                  .del();

                await knex("products_subcategory_links").insert({
                  product_id: localizationId,
                  subcategory_id: localizedSubcategoryResult.id,
                });

                console.log(
                  `Updated subcategory for product localization ${localizationId}`
                );
              }
            }
          }
        } else {
          for (const localizationId of localizationIds) {
            await knex("products_subcategory_links")
              .where("product_id", localizationId)
              .del();

            console.log(
              `Removed subcategory for product localization ${localizationId}`
            );
          }
        }

        // 2. Synchronize product_types
        // Get the ID of the product types of the current product
        const productTypesResult = await knex("product_types_products_links")
          .select("product_type_id")
          .where("product_id", product.id);

        if (productTypesResult && productTypesResult.length > 0) {
          const productTypeIds = productTypesResult.map(
            (pt) => pt.product_type_id
          );

          // For each product type, get its localizations
          const productTypeLocalizationsMap = {};

          for (const productTypeId of productTypeIds) {
            const typeLocalizations = await knex(
              "product_types_localizations_links"
            )
              .select(["product_type_id", "inv_product_type_id"])
              .where("product_type_id", productTypeId)
              .orWhere("inv_product_type_id", productTypeId);

            // Create a set of all IDs of this product type (including localizations)
            const allTypeIds = new Set([productTypeId]);
            typeLocalizations.forEach((link) => {
              allTypeIds.add(link.product_type_id);
              allTypeIds.add(link.inv_product_type_id);
            });

            productTypeLocalizationsMap[productTypeId] = Array.from(allTypeIds);
          }

          // For each localization of the product
          for (const localizationId of localizationIds) {
            // Get the locale of the product localization
            const localizationResult = await knex("products")
              .select("locale")
              .where("id", localizationId)
              .first();

            if (localizationResult && localizationResult.locale) {
              const locale = localizationResult.locale;

              // First, delete all existing relationships with product types
              await knex("product_types_products_links")
                .where("product_id", localizationId)
                .del();

              // For each product type, find its localization with the same locale
              for (const productTypeId of productTypeIds) {
                const allTypeIds =
                  productTypeLocalizationsMap[productTypeId] || [];

                const localizedProductTypeResult = await knex("product_types")
                  .select("id")
                  .where("locale", locale)
                  .whereIn("id", allTypeIds)
                  .first();

                if (
                  localizedProductTypeResult &&
                  localizedProductTypeResult.id
                ) {
                  // Add a relationship between the product localization and the product type localization
                  await knex("product_types_products_links").insert({
                    product_id: localizationId,
                    product_type_id: localizedProductTypeResult.id,
                  });
                }
              }

              console.log(
                `Updated product_types for product localization ${localizationId}`
              );
            }
          }
        } else {
          for (const localizationId of localizationIds) {
            await knex("product_types_products_links")
              .where("product_id", localizationId)
              .del();

            console.log(
              `Removed product_types for product localization ${localizationId}`
            );
          }
        }

        console.log(
          `Successfully synchronized all relations for product ${product.id}`
        );
      } catch (error) {
        console.error("Error synchronizing relations:", error);
        console.error(error.stack);
      }
    }
  },
};

async function validateUniquesSlug(event) {
  const { data } = event.params;
  const slug = data.slug;
  const locale = data.locale;

  if (!slug || !locale) return;

  const existingProduct = await strapi.db
    .query("api::product.product")
    .findOne({
      where: {
        slug: slug,
        locale: locale,
      },
    });

  if (existingProduct) {
    throw new Error(
      `The slug "${slug}" already exists in the "${locale}" locale.`
    );
  }
}
