'use strict';

/**
 * parameter-value service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::parameter-value.parameter-value');
