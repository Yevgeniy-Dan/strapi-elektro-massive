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
              parameter_values: {
                populate: ["localizations"],
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
            ukrainianProduct.parameter_values &&
            ukrainianProduct.parameter_values.length > 0
          ) {
            const localizedParameterValueIds = [];

            for (const parameterValue of ukrainianProduct.parameter_values) {
              const localizedParameterValue =
                parameterValue.localizations?.find(
                  (val) => val.locale === result.locale
                );

              localizedParameterValueIds.push(localizedParameterValue?.id);
            }

            relationsToUpdate.parameter_values =
              localizedParameterValueIds.filter(Boolean);
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
                  `Price changed and synchronized from Ukrainian to ${localization.locale} version for product ${localization.id}`
                );
              } else {
                console.log(
                  `Price synchronized from Ukrainian to ${localization.locale} version for product ${localization.id} (no change)`
                );
              }
            })
          );
        }
      } catch (error) {
        console.error(
          "Error synchronizing prices from Ukrainian version:",
          error
        );
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
