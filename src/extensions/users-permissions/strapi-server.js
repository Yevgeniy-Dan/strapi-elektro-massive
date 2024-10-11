"use strict";

const twilio = {
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  phoneNumber: process.env.TWILIO_PHONE_NUMBER,
};

const smsClient = require("twilio")(twilio.accountSid, twilio.authToken);

const OTP_EXPIRATION_TIME = 5 * 60 * 1000; // 5 minutes in milliseconds

module.exports = async (plugin) => {
  plugin.controllers.auth.sendOTP = async (ctx) => {
    const { phone } = ctx.request.body;

    if (!phone) return ctx.badRequest("missing.phone");

    let user = await strapi.db.query("plugin::users-permissions.user").findOne({
      where: {
        phone,
      },
    });

    const token = Math.floor(Math.random() * 900000) + 100000;
    const generatedAt = Date.now();

    if (!user) {
      // User doesn't exist, create a new one
      const advanced = await strapi
        .store({ type: "plugin", name: "users-permissions", key: "advanced" })
        .get();

      const defaultRole = await strapi.db
        .query("plugin::users-permissions.role")
        .findOne({
          where: { type: advanced.default_role },
        });

      const newUser = {
        username: phone, // Use phone number as username
        phone,
        provider: "local",
        role: defaultRole.id,
      };

      try {
        user = await strapi.db.query("plugin::users-permissions.user").create({
          data: newUser,
        });
      } catch (error) {
        return ctx.badRequest(null, error);
      }
    }

    // Update user with new token
    await strapi.db.query("plugin::users-permissions.user").update({
      where: { id: user.id },
      data: {
        token: token.toString(),
        otpGeneratedAt: generatedAt,
      },
    });

    // Send OTP via SMS
    try {
      await smsClient.messages.create({
        body: `Ваш код перевірки ElektroMassive: ${token}`,
        from: twilio.phoneNumber,
        to: phone,
      });
    } catch (error) {
      return ctx.badRequest("sms.error", "Failed to send SMS");
    }

    ctx.send({ status: "success", message: "OTP sent successfully" });
  };

  plugin.controllers.auth.verifyOTP = async (ctx) => {
    const { phone, token } = ctx.request.body;

    if (!phone) return ctx.badRequest("missing.phone");
    if (!token) return ctx.badRequest("missing.token");

    const user = await strapi.db
      .query("plugin::users-permissions.user")
      .findOne({
        where: {
          phone,
          token,
        },
      });

    if (!user) {
      return ctx.send(
        {
          error: "invalid.credentials",
          message: "Номер телефону або код підтвердження недійсний",
        },
        400
      );
    }

    const currentTime = Date.now();
    const otpGeneratedAt = new Date(user.otpGeneratedAt).getTime();

    // Check if the OTP has expired
    if (currentTime - otpGeneratedAt > OTP_EXPIRATION_TIME) {
      return ctx.send(
        {
          error: "otp.expired",
          message: "Код підтвердження вийшов з терміну дії",
        },
        400
      );
    }

    const updateData = {
      token: null,
      confirmed: true,
    };

    const data = await strapi.db
      .query("plugin::users-permissions.user")
      .update({
        where: { id: user.id },
        data: updateData,
      });

    const jwt = strapi.plugins["users-permissions"].services.jwt.issue({
      id: user.id,
    });

    ctx.send({ jwt, user: sanitizeUser(data) });
  };

  plugin.routes["content-api"].routes.push(
    {
      method: "POST",
      path: "/auth/local/send-otp",
      handler: "auth.sendOTP",
      config: {
        policies: [],
        prefix: "",
      },
    },
    {
      method: "POST",
      path: "/auth/verify-otp",
      handler: "auth.verifyOTP",
      config: {
        prefix: "",
        policies: [],
      },
    }
  );

  return plugin;
};

const sanitizeUser = (user) => {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    phone: user.phone,
    provider: user.provider,
    confirmed: user.confirmed,
    blocked: user.blocked,
    role: user.role,
  };
};
