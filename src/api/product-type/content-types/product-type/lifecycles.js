module.exports = {
  async beforeCreate(event) {
    await validateUniquesSlug(event);

    // Initialize langMatches for the new product-type, adding a match between the current language and the slug.
    // For example, if locale: "uk" and slug: "telefony", then langMatches will be { "uk": "telefony" }
    const { data } = event.params;

    if (data.slug) {
      const langMatches = {
        [data.locale]: data.slug,
      };
      data.langMatches = langMatches;
    }
  },

  async beforeUpdate(event) {
    await validateUniquesSlug(event);

    // When updating a product-type, we first find it with all its language versions (localizations).
    // Then we create a map of all available translations: we start with the current language's slug,
    // and then add slugs from all other language versions. This way langMatches will contain
    // something like { "en": "phones", "uk": "telefony", "ru": "telefony" }
    const { data, where } = event.params;

    if (data.slug) {
      const productType = await strapi.db
        .query("api::product-type.product-type")
        .findOne({
          where: {
            id: where.id,
          },
          populate: ["localizations"],
        });

      if (!productType.locale) {
        console.error(`No locale found for productType ${where.id}`);
        throw new Error("Locale is required for productType update");
      }

      const langMatches = {};
      langMatches[productType.locale] = data.slug;

      if (productType.localizations) {
        productType.localizations.forEach((localization) => {
          langMatches[localization.locale] = localization.slug;
        });
      }

      data.langMatches = langMatches;
    }
  },

  async afterCreate(event) {
    // After creating a new product-type:
    // 1. We create a mapping of language codes to their respective slugs (updatedLangMatches)
    // 2. Start with the current product-type's language and slug
    // 3. Add slugs from all localized versions
    // 4. Finally, update ALL related product-type records (both the original and its translations)
    //    with this complete mapping, so each version knows how to find its siblings
    const { result } = event;

    if (result.localizations) {
      const updatedLangMatches = {};

      updatedLangMatches[result.locale] = result.slug;

      result.localizations.forEach((localization) => {
        updatedLangMatches[localization.locale] = localization.slug;
      });

      await strapi.db.query("api::product-type.product-type").updateMany({
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
};

async function validateUniquesSlug(event) {
  const { data } = event.params;
  const slug = data.slug;
  const locale = data.locale;

  if (!slug || !locale) return;

  const existingProductType = await strapi.db
    .query("api::product-type.product-type")
    .findOne({
      where: {
        slug: slug,
        locale: locale,
      },
    });

  if (existingProductType) {
    throw new Error(
      `The slug "${slug}" already exists in the "${locale}" locale.`
    );
  }
}
