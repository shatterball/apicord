const express = require("express");
const cors = require("cors");
const sha256 = require("sha256");
const jwt = require("jsonwebtoken");
const DB = require("./DataHandler");
const db = new DB("./data/data.db");
const app = express();

// Scratch Variables
var chatBuffer = [];
var connectedSockets = [];

// Middlewares
app.use(cors());
app.use(express.json());
function authorize(req, res, next) {
  if (req.body.token != undefined) {
    jwt.verify(req.body.token, KEY, (err, decoded) => {
      if (err) {
        res.status(401).json({ error: "Not authorized!" });
        return;
      }
      res.locals.user = decoded.user;
      return next();
    });
  } else {
    res.status(401).json({ error: "Not authorized!" });
    return;
  }
}

// Global Variables
const PORT = process.env.PORT || 3000;
const KEY = "imrohan550@gmail.com";

// Asynchronous write messages to DB
setInterval(() => {
  if (chatBuffer.length > 0) {
    chatBuffer.forEach(message => {
      db.addMessage(message);
    });
  }
  chatBuffer = [];
}, 1000);

// The Routes
app.post("/api/login", (req, res) => {
  db.authenticate(req.body.username, sha256(req.body.passwd), data => {
    var response = {
      token: undefined
    };
    if (data.status == 200) {
      response.token = jwt.sign({ user: data.user }, KEY);
      res.status(data.status).json(response);
      return;
    }
    res.status(data.status).json({ error: "Username or password incorrect" });
  });
});
app.post("/api/register", (req, res) => {
  db.getUsers(allUsers => {
    var response = {
      status: 200
    };
    allUsers.forEach(element => {
      if (
        element.username == req.body.username ||
        element.email == req.body.email
      ) {
        response.status = 400;
        res
          .status(response.status)
          .json({ error: "Username or email already registered" });
      }
    });
    if (response.status == 200) {
      var user = {
        fname: req.body.fname,
        lname: req.body.lname,
        username: req.body.username,
        email: req.body.email,
        hash: sha256(req.body.passwd),
        sex: req.body.sex
      };
      db.addUser(user);
      res.status(response.status).json({ message: "User Registered!" });
    }
  });
});
app.post("/api/users", authorize, (req, res) => {
  db.getUsers(users => {
    user = res.locals.user;
    users.forEach(user => {
      delete user.hash;
    });
    users = users.filter(item => item.username != user.username);
    res.json(users);
    return;
  });
});
app.post("/api/chats", authorize, (req, res) => {
  user = res.locals.user;
  db.getChat(user.id, req.body.target, data => {
    res.json(data);
  });
});

// Setting up the server
const server = app.listen(PORT, () => {
  console.log("Server running at " + PORT);
});

// Socket.io
const io = require("socket.io")(server);
io.on("connection", socket => {
  socket.on("disconnect", () => {
    connectedSockets = connectedSockets.filter(user => user.socket != socket);
  });
  socket.on("login", id => {
    connectedSockets = [...connectedSockets, { id: id, socket: socket }];
  });
  socket.on("message-send", data => {
    var tmp = connectedSockets.find(user => user.id == data.dest_id);
    chatBuffer.push(data);
    if (tmp != undefined) {
      tmp.socket.emit("message-recv", data);
    }
  });
});
