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

  const existingCategory = await strapi.db
    .query("api::category.category")
    .findMany({
      where: {
        slug: slug,
        locale: locale,
      },
    });

  if (existingCategory) {
    throw new Error(
      `The slug "${slug}" already exists in the "${locale}" locale.`
    );
  }
}
