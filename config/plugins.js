module.exports = ({ env }) => ({
  graphql: {
    enabled: true,
    config: {
      playgroundAlways: true,
      defaultLimit: 25,
      maxLimit: 200,
      apolloServer: {
        tracing: true,
      },
    },
  },
  "users-permissions": {
    config: {
      providers: {
        google: {
          enabled: true,
          icon: "google",
          key: env("GOOGLE_CLIENT_ID"),
          secret: env("GOOGLE_CLIENT_SECRET"),
          callback: "/api/auth/google/callback",
          scope: ["email", "profile"],
        },
      },
    },
  },
});
