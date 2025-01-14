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

  const existingProductType = await strapi.db
    .query("api::product-type.product-type")
    .findMany({
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
