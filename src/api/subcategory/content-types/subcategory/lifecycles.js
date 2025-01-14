module.exports = {
  async beforeCreate(event) {
    await validateUniquesSlug(event);
  },

  async beforeUpdate(event) {
    await validateUniquesSlug(event);
  },
};

async function validateUniquesSlug(event) {
  const { data } = event.params;
  const slug = data.slug;
  const locale = data.locale;

  if (!slug || !locale) return;

  const existingSubcategory = await strapi.db
    .query("api::subcategory.subcategory")
    .findMany({
      where: {
        slug: slug,
        locale: locale,
      },
    });

  if (existingSubcategory) {
    throw new Error(
      `The slug "${slug}" already exists in the "${locale}" locale.`
    );
  }
}
