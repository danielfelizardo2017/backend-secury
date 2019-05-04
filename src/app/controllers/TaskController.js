const express = require("express");
const bcrypt = require("bcryptjs");
const authMiddleware = require("../middleware/auth");

const Task = require("../models/Task");
const User = require("../models/User");
const Police = require("../models/Police");

const router = express.Router();

router.use(authMiddleware);

// listar as tasks não completadas
router.post("/list", async (req, res) => {
  try {
    const tasks = await Task.find({ completed: false });

    if (!tasks) {
      return res.status(404).send({ error: "Error loading tasks" });
    }

    return res.status(202).send({ tasks });
  } catch (err) {
    return res.status(400).send({ error: "Error loading tasks" });
  }
});

// Criar tarefa
router.post("/", async (req, res) => {
  try {
    const { email, occurrence } = req.body;

    const user = await User.findByIdAndUpdate(
      req.userId,
      { email },
      { new: true }
    )
      .select("+password occurrence")
      .populate("Task");

    if (!user) {
      return res.status(400).send({ error: "User not found" });
    }

    await Promise.all(
      occurrence.map(async task => {
        const userTask = new Task({ ...task, assignedTo: user._id });

        await userTask.save();

        user.occurrence.push(userTask);

        req.io.sockets.in(user._id).emit("taskCreate", task);
      })
    );

    await user.save();
    user.password = undefined;

    return res.status(200).send({ user });
  } catch (err) {
    return res.status(400).send({ error: "Error creating task of user" });
  }
});

// Ao policial clicar no botão "Aceitar" ou quando concluir a tarefa, no front-end
router.post("/:id", async (req, res) => {
  const { email } = req.body;
  try {
    const task = await Task.findById(req.params.id);

    const user = await User.findById(req.userId)
      .select("+password")
      .populate("occurrence");

    const police = await Police.findOne({ email }).select(
      "+password cpf assignedTo"
    );

    if (police.assignedTo != req.userId) {
      await Police.findByIdAndUpdate(police.id, {
        $set: {
          assignedTo: user._id
        }
      });
      await Task.findByIdAndUpdate(task.id, {
        $set: {
          completed: false
        }
      });
    } else if (police.assignedTo == req.userId) {
      await Police.findByIdAndUpdate(police.id, {
        $set: {
          assignedTo: undefined
        }
      });
      await Task.findByIdAndUpdate(task.id, {
        $set: {
          completed: true
        }
      });

      const { occurrence } = user;

      await Task.findByIdAndRemove(task.id);
      user.occurrence = [];
      Task.remove({ assignedTo: user._id });

      await Promise.all(
        occurrence.map(async task => {
          const userTask = new Task({ ...task });

          await userTask.save();

          user.occurrence.push(userTask);

          req.io.sockets.in(user._id).emit("taskCreate", task);
        })
      );
    }
    await user.save();
    await task.save();
    await police.save();

    req.io.sockets.in(police._id).emit("taskUpdate", user);
    return res
      .status(200)
      .send({ message: "Task updated and deleted was success!" });
  } catch (err) {
    return res.status(400).send({ error: "Error loading task" });
  }
});

// atualizar task
router.put("/:id", async (req, res) => {
  try {
    const { email, password, location, occurrence } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        email,
        password,
        location
      },
      { new: true }
    ).select("+password");

    user.occurrence = [];
    await Task.remove({ assignedTo: user._id });

    await Promise.all(
      occurrence.map(async task => {
        const userTask = new Task({ ...task, assignedTo: user._id });

        await userTask.save();

        user.occurrence.push(userTask);
        req.io.sockets.in(user._id).emit("taskUpdate", task);
      })
    );

    await user.save();
    user.password = undefined;

    return res.status(200).send({ user });
  } catch (err) {
    return res.status(400).send({ error: "Error updating task" });
  }
});

// Deletar uma task
router.delete("/:id", async (req, res) => {
  try {
    await Task.findByIdAndRemove(req.params.id);

    return res.status(200).send({ message: "Task remove with success." });
  } catch (err) {
    return res.status(400).send({ error: "Error deleting occurrence" });
  }
});

module.exports = app => app.use("/task", router);
