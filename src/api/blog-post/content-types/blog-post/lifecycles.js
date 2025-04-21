module.exports = {
  async beforeCreate(event) {
    await validateUniquesSlug(event);

    // Initialize langMatches for the new blogPost, adding a match between the current language and the slug.
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

    // When updating a blogPost, we first find it with all its language versions (localizations).
    // Then we create a map of all available translations: we start with the current language's slug,
    // and then add slugs from all other language versions. This way langMatches will contain
    // something like { "en": "phones", "uk": "telefony", "ru": "telefony" }
    const { data, where } = event.params;

    if (data.slug) {
      const blogPost = await strapi.db
        .query("api::blog-post.blog-post")
        .findOne({
          where: {
            id: where.id,
          },
          populate: ["localizations"],
        });

      if (!blogPost.locale) {
        console.error(`No locale found for blog-post ${where.id}`);
        throw new Error("Locale is required for blog-post update");
      }

      const langMatches = {};
      langMatches[blogPost.locale] = data.slug;

      if (blogPost.localizations) {
        blogPost.localizations.forEach((localization) => {
          langMatches[localization.locale] = localization.slug;
        });
      }

      data.langMatches = langMatches;
    }
  },

  async afterCreate(event) {
    // After creating a new blogPost:
    // 1. We create a mapping of language codes to their respective slugs (updatedLangMatches)
    // 2. Start with the current blogPost's language and slug
    // 3. Add slugs from all localized versions
    // 4. Finally, update ALL related blogPost records (both the original and its translations)
    //    with this complete mapping, so each version knows how to find its siblings
    const { result } = event;

    if (result.localizations) {
      const updatedLangMatches = {};

      updatedLangMatches[result.locale] = result.slug;

      result.localizations.forEach((localization) => {
        updatedLangMatches[localization.locale] = localization.slug;
      });

      await strapi.db.query("api::blog-post.blog-post").updateMany({
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

  const existingBlogPost = await strapi.db
    .query("api::blog-post.blog-post")
    .findOne({
      where: {
        slug: slug,
        locale: locale,
      },
    });

  if (existingBlogPost) {
    throw new Error(
      `The slug "${slug}" already exists in the "${locale}" locale.`
    );
  }
}
