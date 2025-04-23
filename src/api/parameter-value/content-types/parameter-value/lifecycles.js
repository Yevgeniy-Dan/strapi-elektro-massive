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
              product_parameters: {
                populate: ["product"],
              },
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

            // Handle product_parameters separately
            if (
              parameterValue.product_parameters &&
              parameterValue.product_parameters.length > 0
            ) {
              // For each product_parameter associated with the Ukrainian parameter value
              for (const productParameter of parameterValue.product_parameters) {
                if (productParameter.product) {
                  // Find localized product
                  const localizedProduct = await strapi.db
                    .query("api::product.product")
                    .findOne({
                      where: {
                        locale: localization.locale,
                        localizations: { id: productParameter.product.id },
                      },
                    });

                  if (localizedProduct) {
                    // Check if a product_parameter already exists for this combination
                    const existingProductParameter = await strapi.db
                      .query("api::product-parameter.product-parameter")
                      .findOne({
                        where: {
                          parameter_value: localization.id,
                          product: localizedProduct.id,
                        },
                      });

                    if (!existingProductParameter) {
                      // Create a new product_parameter for the localized parameter value and product
                      await strapi.db
                        .query("api::product-parameter.product-parameter")
                        .create({
                          data: {
                            parameter_value: localization.id,
                            product: localizedProduct.id,
                            locale: localization.locale,
                            publishedAt: new Date(),
                          },
                        });

                      console.log(
                        `Created product_parameter linking localized parameter value ${localization.id} to localized product ${localizedProduct.id}`
                      );
                    }
                  }
                }
              }
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
