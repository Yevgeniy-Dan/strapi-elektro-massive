module.exports = ({ env }) => ({
<<<<<<< HEAD
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  url: env('PUBLIC_URL', 'http://3.79.152.196:1337'),
=======
  host: env("HOST", "0.0.0.0"),
  port: env.int("PORT", 1337),
  url: env("PUBLIC_URL", "http://3.78.49.37:1337"),
  admin: {
    url: "/admin",
    serveAdminPanel: true,
  },
>>>>>>> 48d142527fe5ad5b34f5b08bdb7e9f9abfeecf44
  app: {
    keys: env.array("APP_KEYS"),
  },
  webhooks: {
    populateRelations: env.bool("WEBHOOKS_POPULATE_RELATIONS", false),
  },
});
