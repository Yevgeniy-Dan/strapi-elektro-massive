const { errors } = require("@strapi/utils");
const { ApplicationError } = errors;

module.exports = {
  beforeCreate: async (event) => {
    const { data } = event.params;

    const locale = data.locale;
    const sourceLocale = "uk";

    console.log("Creating product parameter:", data);

    let productId, parameterValueId;

    if (data.product?.connect?.[0]?.id) {
      productId = data.product.connect[0].id;
    } else if (data.product) {
      productId = data.product;
    }

    if (data.parameter_value?.connect?.[0]?.id) {
      parameterValueId = data.parameter_value.connect[0].id;
    } else if (data.parameter_value) {
      parameterValueId = data.parameter_value;
    }

    console.log(data.product?.connect?.[0]);
    console.log(
      "Product ID:",
      productId,
      "Parameter Value ID:",
      parameterValueId
    );

    const existingEntry = await strapi.entityService.findMany(
      "api::product-parameter.product-parameter",
      {
        filters: {
          product: { id: productId },
          parameter_value: { id: parameterValueId },
          locale: locale || sourceLocale,
        },
      }
    );

    if (existingEntry?.length > 0) {
      throw new ApplicationError(
        `A product parameter with product ID ${productId} and parameter value ID ${parameterValueId} already exists.`,
        {
          isExists: true,
          existingId: existingEntry[0].id,
        }
      );
    }
  },

  beforeUpdate: async (event) => {
    const { data, where } = event.params;

    const currentEntry = await strapi.entityService.findOne(
      "api::product-parameter.product-parameter",
      where.id,
      {
        populate: ["product", "parameter_value"],
      }
    );

    const newProductId =
      data.product?.connect?.[0]?.id || data.product || currentEntry.product.id;
    const newParameterValueId =
      data.parameter_value?.connect?.[0]?.id ||
      data.parameter_value ||
      currentEntry.parameter_value.id;

    console.log(
      "newProductId ID:",
      newProductId,
      "newParameterValueId:",
      newParameterValueId
    );

    const existingEntry = await strapi.entityService.findMany(
      "api::product-parameter.product-parameter",
      {
        filters: {
          id: { $ne: where.id },
          product: { id: newProductId },
          parameter_value: { id: newParameterValueId },
        },
      }
    );

    if (existingEntry?.length > 0) {
      throw new ApplicationError(
        `A product parameter with product ID ${newProductId} and parameter value ID ${newParameterValueId} already exists.`,
        {
          isExists: true,
          existingId: existingEntry[0].id,
        }
      );
    }
  },
  afterCreate: async (event) => {
    const { result } = event;
    const sourceLocale = "uk";

    if (result.locale === sourceLocale) {
      const entry = await strapi.entityService.findOne(
        "api::product-parameter.product-parameter",
        result.id,
        {
          populate: {
            product: {
              populate: ["localizations"],
            },
            parameter_value: {
              populate: ["localizations"],
            },
            localizations: true,
          },
        }
      );

      if (!entry.product || !entry.parameter_value) {
        console.log("Missing product or parameter_value realation");
        return;
      }

      const productLocales = entry.product.localizations
        ? entry.product.localizations.map((loc) => loc.locale)
        : [];
      const parameterValueLocales = entry.parameter_value.localizations
        ? entry.parameter_value.localizations.map((loc) => loc.locale)
        : [];

      const commonLocales = productLocales.filter((locale) =>
        parameterValueLocales.includes(locale)
      );

      console.log(`Common locales found: ${commonLocales.join(", ")}`);

      const localizationIds = [entry.id];
      if (entry.localizations && entry.localizations.length > 0) {
        entry.localizations.forEach((loc) => localizationIds.push(loc.id));
      }
      for (const locale of commonLocales) {
        try {
          const localizedProduct = entry.product.localizations.find(
            (loc) => loc.locale === locale
          );
          const localizedParameterValue =
            entry.parameter_value.localizations.find(
              (loc) => loc.locale === locale
            );
          if (localizedProduct && localizedParameterValue) {
            const newLocalization = await strapi.entityService.create(
              "api::product-parameter.product-parameter",
              {
                data: {
                  product: localizedProduct.id,
                  parameter_value: localizedParameterValue.id,
                  locale: locale,
                  localizations: localizationIds,
                  publishedAt: new Date().toISOString(),
                },
              }
            );

            localizationIds.push(newLocalization.id);

            await strapi.db
              .query("api::product-parameter.product-parameter")
              .update({
                where: { id: result.id },
                data: {
                  localizations: localizationIds,
                },
              });

            console.log(`Created localization for ${locale}`);
          }
        } catch (error) {
          console.error(`Failed to create localization for ${locale}:`, error);
        }
      }
    }
  },
  afterUpdate: async (event) => {
    const { result } = event;

    const sourceLocale = "uk";

    if (result.locale === sourceLocale) {
      const entry = await strapi.entityService.findOne(
        "api::product-parameter.product-parameter",
        result.id,
        {
          populate: {
            product: {
              populate: ["localizations"],
            },
            parameter_value: {
              populate: ["localizations"],
            },
            localizations: true,
          },
        }
      );

      if (!entry.product || !entry.parameter_value) {
        console.log("Missing product or parameter_value relation");
        return;
      }

      if (entry.localizations && entry.localizations.length > 0) {
        for (const localization of entry.localizations) {
          try {
            const localizedProduct = entry.product.localizations.find(
              (loc) => loc.locale === localization.locale
            );

            const localizedParameterValue =
              entry.parameter_value.localizations.find(
                (loc) => loc.locale === localization.locale
              );

            if (localizedProduct && localizedParameterValue) {
              await strapi.entityService.update(
                "api::product-parameter.product-parameter",
                localization.id,
                {
                  data: {
                    product: localizedProduct.id,
                    parameter_value: localizedParameterValue.id,
                    publishedAt: new Date().toISOString(),
                  },
                }
              );
              console.log(`Updated localization for ${localization.locale}`);
            }
          } catch (error) {
            console.error(
              `Failed to update localization ${localization.id}:`,
              error
            );
          }
        }
      }
    }
  },
};
