const pw = process.env.HI_G1_EP_PW; //database password

const PORT = 8080;
const {
  addUser,
  findUserByEmail,
  addTask,
  updateTask,
  deleteTask,
  filterTasks,
} = require("./databasefunctions");

const config = require("./knexfile");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const app = express();
const bodyParser = require("body-parser");

//login and session
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;

// database
const pg = require("pg");
const knex = require("knex");
const db = knex(config);

// middleware start
app.use(cors({ credentials: true, origin: "http://localhost:5173" })); //allows cookies to be transmitted across origins and specifies a domain to be allowed
app.use(bodyParser.json());

app.use(
  session({
    secret: "secret",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, sameSite: "none" }, //never do this in prod, however localhost has no https
  })
);

app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new LocalStrategy(
    {
      usernameField: "email",
    },
    async (email, password, done) => {
      const user = await findUserByEmail(email);
      // const user = await db
      //   .select("id", "email", "hashedpassword")
      //   .from("users")
      //   .where("email", email)
      //   .first()
      //   .then(function (user) {
      //     return user;
      //   });
      console.log(user);
      if (!user) {
        console.log("wrong email ");
        return done(null, false, { message: "No user exists" });
      }
      const matchedPassword = await bcrypt.compare(
        password,
        user.hashedpassword
      );
      if (!matchedPassword) {
        console.log("wrong password");
        return done(null, false, { message: "Wrong password" });
      }
      return done(null, user);
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.email);
});

passport.deserializeUser(async (email, done) => {
  const user = await findUserByEmail(email);
  done(null, user);
});

app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  if (await findUserByEmail(email)) {
    console.log("user already exists");
    return res.status(500).json("User already exists.");
  }
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  const user = { username, email, hashedPassword };
  addUser(user);
  res.status(201).json("User registered successfully.");
});

app.get("/v1/todo", (req, res) => {
  if (req.isAuthenticated()) {
    console.log(req.user.id);
    //Todo (lol ironic) migrate this code to the databasefunctions.js
    db.select()
      .from("todos")
      .where("user_id", req.user.id)
      .then(function (todo) {
        res.json(todo);
      });
  } else {
    res.status(401).json("Unauthorized");
  }
});

app.post("/login", passport.authenticate("local"), (req, res) => {
  console.log("Successful login for: " + req.user.email);
  res.json("Welcome " + req.user.username);
});

app.post("/v1/todo/add", (req, res) => {
  if (req.isAuthenticated()) {
    const { title, description, dueDate, completed } = req.body;
    //allowing for validation later
    const task = {
      title,
      description,
      due_date: dueDate,
      completed,
    };
    console.log(req.user.id);
    addTask(task, req.user.id);
    res.status(200).json("Successfully added task");
  } else {
    res.status(401).json("Unauthorized");
  }
});

app.put("/v1/todo/update", (req, res) => {
  if (req.isAuthenticated()) {
    const { id, title, description, dueDate, completed } = req.body;
    //allowing for validation later
    const task = {
      title,
      description,
      due_date: dueDate,
      completed,
    };
    updateTask(task, id);
    res.status(200).json("Successfully edited task");
  } else {
    res.status(401).json("Unauthorized");
  }
});

app.delete("/v1/todo/delete", (req, res) => {
  if (req.isAuthenticated()) {
    const { id } = req.body;
    //allowing for validation later
    deleteTask(id);
    res.status(200).json("Successfully deleted task");
  } else {
    res.status(401).json("Unauthorized");
  }
});

app.post("/v1/todo/fiter", async (req, res) => {
  if (req.isAuthenticated()) {
    const { page, filter } = req.body;
    //allowing for validation later

    console.log(req.user.id);
    const results = await filterTasks(req.user.id, page, filter);
    res.status(200).json(results);
  } else {
    res.status(401).json("Unauthorized");
  }
});

app.listen(PORT, () => {
  console.log("Server listening on port:" + PORT);
});
