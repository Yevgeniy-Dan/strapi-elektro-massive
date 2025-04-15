const fs = require("fs");
const path = require("path");

const logToFile = (message) => {
  const logPath = path.join(__dirname, "debug.log");
  fs.appendFileSync(logPath, message + "\n");
};

const setupDatabase = async (strapi) => {
  const knex = strapi.db.connection;

  const tables = ["products", "product_types", "categories", "subcategories"];

  for (const table of tables) {
    try {
      const constraintName = `unique_slug_locale_${table}`;

      // Check if the index already exists
      const constraintExists = await knex.raw(
        `
          SELECT 1
          FROM pg_constraint
          WHERE conname = ? AND conrelid = quote_ident(?)::regclass::oid
        `,
        [constraintName, table]
      );

      if (constraintExists.rows.length === 0) {
        await knex.raw(`DROP INDEX IF EXISTS ${constraintName}`);

        await knex.raw(`
            ALTER TABLE ${table}
            ADD CONSTRAINT ${constraintName}
            UNIQUE (slug, locale)
          `);
        console.log(`Created unique constrain on ${table} (slug, locale)`);
      } else {
        console.log(`Constraint already exists on ${table} (slug, locale)`);
      }
    } catch (error) {
      console.error(`Error handling constraint for ${table}:`, error);
    }
  }

  // Check if the index on products.id already exists
  const idIndexExists = await knex.raw(`
    SELECT 1
    FROM pg_indexes
    WHERE indexname = 'idx_products_id'
  `);
  if (idIndexExists.rows.length === 0) {
    // Create the index if it doesn't exist
    await knex.raw("CREATE INDEX idx_products_id ON products (id)");
    logToFile("Index created on products.id");
  } else {
    logToFile("Index already exists on products.id");
  }

  // Check if the composite index on product_types_products_links (product_id, product_type_id) exists
  const productTypeLinkIndexExists = await knex.raw(`
    SELECT 1
    FROM pg_indexes
    WHERE indexname = 'idx_product_types_products_links'
  `);
  if (productTypeLinkIndexExists.rows.length === 0) {
    // Create the composite index if it doesn't exist
    await knex.raw(`
      CREATE INDEX idx_product_types_products_links 
      ON product_types_products_links (product_id, product_type_id)
    `);
    logToFile(
      "Composite index created on product_types_products_links (product_id, product_type_id)"
    );
  } else {
    logToFile(
      "Composite index already exists on product_types_products_links (product_id, product_type_id)"
    );
  }

  // Check if the composite index on products_subcategory_links (product_id, subcategory_id) exists
  const subcategoryLinkIndexExists = await knex.raw(`
    SELECT 1
    FROM pg_indexes
    WHERE indexname = 'idx_products_subcategory_links'
  `);
  if (subcategoryLinkIndexExists.rows.length === 0) {
    // Create the composite index if it doesn't exist
    await knex.raw(`
      CREATE INDEX idx_products_subcategory_links 
      ON products_subcategory_links (product_id, subcategory_id)
    `);
    logToFile(
      "Composite index created on products_subcategory_links (product_id, subcategory_id)"
    );
  } else {
    logToFile(
      "Composite index already exists on products_subcategory_links (product_id, subcategory_id)"
    );
  }

  const categoriesSubcategoriesLinkIndexExists = await knex.raw(`
    SELECT 1
    FROM pg_indexes
    WHERE indexname = 'idx_subcategories_categories_links'
  `);
  if (categoriesSubcategoriesLinkIndexExists.rows.length === 0) {
    await knex.raw(`
      CREATE INDEX idx_subcategories_categories_links 
      ON subcategories_categories_links (category_id, subcategory_id)
    `);
    logToFile(
      "Composite index created on subcategories_categories_links (category_id, subcategory_id)"
    );
  } else {
    logToFile(
      "Composite index already exists on subcategories_categories_links (category_id, subcategory_id)"
    );
  }

  const productTypesSubcategoriesLinkIndexExists = await knex.raw(`
    SELECT 1
    FROM pg_indexes
    WHERE indexname = 'idx_product_types_subcategories_links'
  `);
  if (productTypesSubcategoriesLinkIndexExists.rows.length === 0) {
    await knex.raw(`
      CREATE INDEX idx_product_types_subcategories_links 
      ON product_types_subcategories_links (product_type_id, subcategory_id)
    `);
    logToFile(
      "Composite index created on product_types_subcategories_links (product_type_id, subcategory_id)"
    );
  } else {
    logToFile(
      "Composite index already exists on product_types_subcategories_links (product_type_id, subcategory_id)"
    );
  }

  await strapi
    .service("plugin::users-permissions.providers-registry")
    .register(`google`, ({ purest }) => async ({ query }) => {
      const google = purest({ provider: "google" });

      const res = await google
        .get("https://www.googleapis.com/oauth2/v3/userinfo")
        .auth(query.access_token)
        .request();

      const { body } = res;

      return {
        email: body.email,
        firstname: body.given_name,
        lastname: body.family_name,
        picture: body.picture,
        provider: "google",
        username: body.name,
      };
    });
};

module.exports = { setupDatabase };
