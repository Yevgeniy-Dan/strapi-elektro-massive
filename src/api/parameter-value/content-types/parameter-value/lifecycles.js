module.exports = {
  async afterUpdate(event) {
    const { result } = event;

    // Define Ukrainian as the source of truth for relations
    const sourceLocale = "uk";

    try {
      // When Ukrainian version is updated, synchronize all other localizations
      if (result.locale === sourceLocale) {
        const localizations = await strapi.db
          .query("api::parameter-value.parameter-value")
          .findMany({
            where: {
              id: { $in: result.localizations?.map((l) => l.id) || [] },
            },
          });

        const parameterValue = await strapi.db
          .query("api::parameter-value.parameter-value")
          .findOne({
            where: {
              id: result.id,
            },
            populate: {
              parameter_type: true,
              product: true,
            },
          });

        if (localizations && localizations.length > 0) {
          for (const localization of localizations) {
            const relationsToUpdate = {};

            // Find localized parameter type that matches the current localization's language
            if (parameterValue.parameter_type) {
              const localizedParameterType = await strapi.db
                .query("api::parameter-type.parameter-type")
                .findOne({
                  where: {
                    locale: localization.locale,
                    localizations: { id: parameterValue.parameter_type.id },
                  },
                });

              if (localizedParameterType) {
                relationsToUpdate.parameter_type = localizedParameterType.id;
              }
            }

            // Find localized product that matches the current localization's language
            if (parameterValue.product) {
              const localizedProduct = await strapi.db
                .query("api::product.product")
                .findOne({
                  where: {
                    locale: localization.locale,
                    localizations: { id: parameterValue.product.id },
                  },
                });

              if (localizedProduct) {
                relationsToUpdate.product = localizedProduct.id;
              }
            }

            // Update relations if we found any to update
            if (Object.keys(relationsToUpdate).length > 0) {
              await strapi.db
                .query("api::parameter-value.parameter-value")
                .update({
                  where: { id: localization.id },
                  data: relationsToUpdate,
                });

              console.log(
                `Localized relations copied from Ukrainian version to ${localization.locale} version for parameter value ${localization.id}`
              );
            }
          }
        }
      }
    } catch (error) {
      console.error(
        `Error copying relations to newly created parameter value ${result.id}:`,
        error
      );
    }
  },
};
