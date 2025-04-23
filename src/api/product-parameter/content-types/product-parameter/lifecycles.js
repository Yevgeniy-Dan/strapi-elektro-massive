const { errors } = require("@strapi/utils");
const { ApplicationError } = errors;

module.exports = {
  beforeCreate: async (event) => {
    const { data } = event.params;

    const locale = data.locale;
    const sourceLocale = "uk";

    console.log("Creating product parameter:", data);

    const productId = data.product?.connect?.[0]?.id;
    const parameterValueId = data.parameter_value?.connect?.[0]?.id;

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
      data.product?.connect?.[0]?.id || currentEntry.product.id;
    const newParameterValueId =
      data.parameter_value?.connect?.[0]?.id || currentEntry.parameter_value.id;

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
        `A product parameter with product ID ${data.product} and parameter value ID ${data.parameter_value} already exists.`,
        {
          isExists: true,
          existingId: existingEntry[0].id,
        }
      );
    }
  },
};
