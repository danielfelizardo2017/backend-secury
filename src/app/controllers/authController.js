const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const Police = require("../models/Police");
const User = require("../models/User");
const mailer = require("../../modules/mailer");
const config = require("../../config/auth.json");

function generateToken(params = {}) {
  return jwt.sign(params, config.secret, {
    expiresIn: 86400
  });
}

const router = express.Router();

router.post("/register", async (req, res) => {
  const { usuario, isPolice, data } = req.body;

  if (isPolice === true) {
    try {
      const { email } = req.body.data;

      if (await Police.findOne({ email })) {
        return res.status(403).send({ error: "Police already exists" });
      }

      const police = await Police.create(data);

      mailer.sendMail(
        {
          from: "suporte.security@gmail.com",
          to: email,
          subject: "Welcome",
          template: "/auth/police/welcome",
          context: { email }
        },
        err => {
          if (err) {
            return res
              .status(400)
              .send({ error: "Cannot send forgot password email" });
          }
        }
      );

      police.password = undefined;
      police.cpf = undefined;

      return res.send({
        police,
        token: generateToken({ id: police.id })
      });
    } catch (err) {
      return res.status(400).send({ error: "Error creating new Police" });
    }
  } else if (isPolice === false) {
    try {
      const { email } = req.body.usuario;

      if (await User.findOne({ email })) {
        return res.status(403).send({ error: "User already exists" });
      }

      const user = await User.create(usuario);

      user.password = undefined;

      mailer.sendMail(
        {
          from: "suporte.security@gmail.com",
          to: email,
          subject: "Welcome",
          template: "/auth/user/welcome",
          context: { email }
        },
        err => {
          if (err) {
            return res
              .status(400)
              .send({ error: "Cannot send forgot password email" });
          }
        }
      );

      return res.status(202).send({
        user,
        token: generateToken({ id: user.id })
      });
    } catch (err) {
      return res.status(400).send({ error: "Error creating new User" });
    }
  }
});

router.post("/authenticate", async (req, res) => {
  const { isPolice, usuario, data, token } = req.body;

  if (isPolice === true) {
    const { email, password, cpf } = data;

    try {
      const police = await Police.findOne({ email }).select("+cpf password");

      if (!police) {
        return res.status(404).send({ error: "Police not found" });
      }

      if (!(await bcrypt.compare(password, police.password))) {
        return res.status(401).send({ error: "Invalid password" });
      }

      if (cpf !== police.cpf) {
        return res.status(401).send({ error: "Invalid cpf" });
      }

      mailer.sendMail(
        {
          from: "suporte.security@gmail.com",
          to: email,
          subject: "Authorization",
          template: "/auth/police/authorization",
          context: { email, token }
        },
        err => {
          if (err) {
            return res
              .status(400)
              .send({ error: "Cannot send forgot password email" });
          }
        }
      );

      police.password = undefined;
      police.cpf = undefined;

      return res.status(202).send({
        police,
        token: generateToken({ id: police.id })
      });
    } catch (err) {
      return res.status(400).send({ error: "Error authorization" });
    }
  } else if (isPolice === false) {
    const { email, password } = usuario;

    try {
      const user = await User.findOne({ email }).select("+password");

      if (!user) {
        return res.status(404).send({ error: "User not found" });
      }

      if (!(await bcrypt.compare(password, user.password))) {
        return res.status(401).send({ error: "Invalid password" });
      }

      mailer.sendMail(
        {
          from: "suporte.security@gmail.com",
          to: email,
          subject: "Authorization",
          template: "/auth/user/authorization",
          context: { email, token }
        },
        err => {
          if (err) {
            return res
              .status(400)
              .send({ error: "Cannot send forgot password email" });
          }
        }
      );

      user.password = undefined;

      return res.status(202).send({
        user,
        token: generateToken({ id: user.id })
      });
    } catch (err) {
      return res.status(400).send({ error: "Error authorization" });
    }
  }
});

router.post("/forgot_password", async (req, res) => {
  const { isPolice, usuario, data } = req.body;

  if (isPolice === true) {
    try {
      const { email, cpf } = data;

      const police = await Police.findOne({ email }).select("+cpf");

      if (!police) {
        return res.status(404).send({ error: "User not found" });
      }

      if (cpf !== police.cpf) {
        return res.status(401).send({ error: "Invalid cpf" });
      }

      const token = crypto.randomBytes(20).toString("hex");

      const now = new Date();
      now.setHours(now.getHours() + 1);

      await Police.findByIdAndUpdate(police.id, {
        $set: {
          passwordResetToken: token,
          passwordResetExpires: now
        }
      });

      mailer.sendMail(
        {
          from: "suporte.security@gmail.com",
          to: email,
          subject: "Forgot Password",
          template: "/auth/police/forgot_password",
          context: { email, token }
        },
        err => {
          if (err) {
            return res
              .status(400)
              .send({ error: "Cannot send forgot password email" });
          }
        }
      );

      return res.status(202).send({ police, message: "Email send" });
    } catch (err) {
      return res
        .status(400)
        .send({ error: "Error on forgot password. try again" });
    }
  } else if (isPolice === false) {
    try {
      const { email } = usuario;

      const user = await User.findOne({ email });

      if (!user) {
        return res.status(404).send({ error: "User not found" });
      }

      const token = crypto.randomBytes(20).toString("hex");

      const now = new Date();
      now.setHours(now.getHours() + 1);

      await User.findByIdAndUpdate(user.id, {
        $set: {
          passwordResetToken: token,
          passwordResetExpires: now
        }
      });

      mailer.sendMail(
        {
          from: "suporte.security@gmail.com",
          to: email,
          subject: "Forgot Password",
          template: "/auth/user/forgot_password",
          context: { email, token }
        },
        err => {
          if (err) {
            return res
              .status(400)
              .send({ error: "Cannot send forgot password email" });
          }
        }
      );

      return res.status(202).send({ user, message: "Email send" });
    } catch (err) {
      return res
        .status(400)
        .send({ error: "Error on forgot password. try again" });
    }
  }
});

router.post("/reset_password", async (req, res) => {
  const { isPolice, token, usuario, data } = req.body;

  if (isPolice === true) {
    const { email, cpf, password } = data;

    try {
      const police = await Police.findOne({ email }).select(
        "+passwordResetToken passwordResetExpires cpf password"
      );

      if (!police) {
        return res.status(400).send({ error: "Police not found" });
      }

      if (cpf !== police.cpf) {
        return res.status(401).send({ error: "Invalid cpf" });
      }

      if (await bcrypt.compare(password, police.password)) {
        return res
          .status(400)
          .send({ error: "The password cannot be equals old" });
      }

      if (token !== police.passwordResetToken) {
        return res.status(401).send({ error: "Token invalid" });
      }

      const now = new Date();
      now.setHours(now.getHours() + 1);

      if (now < police.passwordResetExpires) {
        return res
          .status(403)
          .send({ error: "Token Expired, generate a new one" });
      }

      mailer.sendMail(
        {
          from: "suporte.security@gmail.com",
          to: email,
          subject: "Reset Password",
          template: "/auth/police/reset_password",
          context: { email }
        },
        err => {
          if (err) {
            return res
              .status(400)
              .send({ error: "Cannot send forgot password email" });
          }
        }
      );

      police.password = password;

      await police.save();

      police.password = undefined;
      police.cpf = undefined;

      return res
        .status(202)
        .send({ police, message: "Set password, success!" });
    } catch (err) {
      return res.status(404).send({ error: "Cannot set password, try again" });
    }
  } else if (isPolice === false) {
    const { email, password } = usuario;

    try {
      const user = await User.findOne({ email }).select(
        "+passwordResetToken passwordResetExpires password"
      );

      if (!user) {
        return res.status(404).send({ error: "User not found" });
      }

      if (token !== user.passwordResetToken) {
        return res.status(401).send({ error: "Token invalid" });
      }

      if (await bcrypt.compare(password, user.password)) {
        return res
          .status(400)
          .send({ error: "The password cannot be equals old" });
      }

      const now = new Date();
      now.setHours(now.getHours() + 1);

      if (now < user.passwordResetExpires) {
        return res
          .status(403)
          .send({ error: "Token Expired, generate a new one" });
      }

      mailer.sendMail(
        {
          from: "suporte.security@gmail.com",
          to: email,
          subject: "Reset Password",
          template: "/auth/user/reset_password",
          context: { email }
        },
        err => {
          if (err) {
            return res
              .status(404)
              .send({ error: "Cannot send forgot password email" });
          }
        }
      );

      user.password = password;

      await user.save();

      user.password = undefined;

      return res.status(202).send({ user, message: "Email send" });
    } catch (err) {
      return res.status(404).send({ error: "Cannot set password, try again" });
    }
  }
});

module.exports = app => app.use("/auth", router);
