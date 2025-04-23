module.exports = ({ env }) => ({
  graphql: {
    enabled: true,
    config: {
      playgroundAlways: true,
      defaultLimit: 25,
      maxLimit: 200,
      apolloServer: {
        tracing: true,
        formatError: (error) => {
          const { originalError } = error;

          // If it is an ApplicationError, include additional data
          if (originalError && originalError.data) {
            return {
              message: error.message,
              extensions: {
                ...error.extensions,
                data: originalError.data,
              },
            };
          }

          return error;
        },
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
