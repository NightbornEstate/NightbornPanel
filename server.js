var express = require("express");
var app = express();
var server = require('http')
  .Server(app);
var io = require('socket.io')(server);
var bodyParser = require('body-parser');
var hashPassword = require("./helpers/hashPassword");
var session = require("express-session");
var si = require("systeminformation");
var jwt = require("jsonwebtoken");
var fs = require("fs");
var csp = require("chmod-style-permissions");
var ejs = require("ejs");
var sessionMiddleware = session({
  secret: Math.floor(Math.random() * 100000000000)
    .toString(16)
});
io.use(function (socket, next) {
  sessionMiddleware(socket.request, socket.request.res, next);
});
app.use(sessionMiddleware);
app.use(bodyParser.urlencoded({
  extended: true
}));

function requirePermission() {
  console.log(arguments)
  var _arguments = Array.from(arguments);
  /**
   * @type {function}
   */
  return function (req, res, next) {
    _arguments.every(node => {
      return csp.hasPerm(req.session.user.permissions, node)
    }) ? next() : res.redirect("/")
  }
}
app.use(bodyParser.json());
app.use(bodyParser.raw());
app.use(express.static("assets"));
app.set("view engine", ejs);
server.listen(8008);
app.get('/', function (req, res) {
  res.redirect("http://jwte.ch:5678/requestauth?redirect=" + encodeURIComponent("http://jwte.ch:8008/callback?token=$token"))
});
app.get('/panel', requirePermission("nightborn.panel.access"), function (req, res) {
  res.sendfile(__dirname + '/html/panel.html');
});
app.get('/botlogs', requirePermission("nightborn.panel.access"), function (req, res) {
  res.sendfile(__dirname + '/html/botlogs.html');
});
app.get('/m_manager', requirePermission("nightborn.panel.access"), function (req, res) {
  res.sendfile(__dirname + '/html/memberOptions.html');
});
app.get("/callback", (req, res) => {
  var token = req.query.token;
  if (!token) return res.end("go away");
  try {
    var tokendata = jwt.verify(token, fs.readFileSync("./public.key"))
    console.log("passed 1st check")
  } catch (e) {
    console.log(e)
    return res.end("go away")
  }
  if ((tokendata.logintime + 2000) < Date.now()) return res.end("You're not authorized to do this.")
  if (!csp.hasPerm(tokendata.permissions, "nightborn.panel.login")) return res.end("You're not authorized to do this.")
  console.log("passed 2nd check")
  req.session.authed = true
  req.session.username = tokendata.username;
  req.session.user = tokendata;
  res.redirect("/panel")
})
app.post("/auth", (req, res) => {
  var correctPw = "f1cb22cb622f3dd9d1f5e06cc2a1d0e920c40e6a4c2d2bf3dd0c7b52e975d6d9";
  var ecorrect = "63281834752dee45991cd499ff23039a814c0db2ce3c03a73aaab0c985da7823";
  var hookspassword = "214cf157102e1b7a454d37cfa229158fb76434f5e58f724bd89858264c0d9f5b";
  if ((req.body.username === "jay" && (hashPassword(req.body.password) === correctPw)) || (req.body.username === "eddie" && (hashPassword(req.body.password) === ecorrect)) || (req.body.username === "hooks" && (hashPassword(req.body.password) === hookspassword))) {
    req.session.authed = true;
    req.session.username = req.body.username;
    res.json({
      authed: true
    })
  }
})
io.on('connection', function (socket) {
  console.log("Gotten connection")
  if (socket.request.session.authed) {
    console.log("Authed request")
    socket.on("request.sysinfo", () => {
      Promise.all([si.mem(), si.currentLoad()])
        .then((results) => {
          var m = results[0];
          var cl = results[1];
          socket.emit("response.sysinfo", {
            ram: {
              percent: Math.floor((m.used / m.total) * 100)
                .toString() + "%",
              used: m.used,
              free: m.free,
              total: m.total,
              human: Math.floor((m.used / 1000) / 1000) + "mb"
            },
            cpu: {
              percent: cl.currentload + "%",
              load: cl.currentload
            }
          });
        })
    })
    socket.on("forward", (req) => {
      io.emit(req.event, req.packet);
    })
  }
  socket.on("member.find", function (tf) {
    tf.replyId = socket.id;
    io.emit("bot.find", tf);
  })
  socket.on("bot.found", function (res) {
    io.to(res.replyId)
      .emit("member.found", res)
  })
  socket.on("sendLogsSoon <3", function () {
    console.log("Bot connected!");
  });
  socket.on("log", (d) => {
    io.emit("log", d)
  })
});
