var express = require("express");
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var bodyParser = require('body-parser');
var hashPassword = require("./helpers/hashPassword");
var session = require("express-session");
var si = require("systeminformation");

var sessionMiddleware = session({
  secret: Math.floor(Math.random() * 100000000000).toString(16)
});
io.use(function (socket, next) {
  sessionMiddleware(socket.request, socket.request.res, next);
});
app.use(sessionMiddleware);
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());
app.use(bodyParser.raw());
app.use(express.static("assets"))
server.listen(8008);

app.get('/', function (req, res) {
  res.sendfile(__dirname + '/html/login.html');
});
app.get('/panel', function (req, res) {
  if (req.session.authed) {
    res.sendfile(__dirname + '/html/panel.html');
  } else {
    res.end("Unauthorized")
  }

});
app.get('/botlogs', function (req, res) {
  if (req.session.authed) {
    res.sendfile(__dirname + '/html/botlogs.html');
  } else {
    res.end("Unauthorized")
  }
});
app.get('/m_manager', function (req, res) {
  if (req.session.authed) {
    res.sendfile(__dirname + '/html/memberOptions.html');
  } else {
    res.end("Unauthorized")
  }
});

app.post("/auth", (req, res) => {
  var correctPw = "f1cb22cb622f3dd9d1f5e06cc2a1d0e920c40e6a4c2d2bf3dd0c7b52e975d6d9";
  var ecorrect = "63281834752dee45991cd499ff23039a814c0db2ce3c03a73aaab0c985da7823"
  if ((req.body.username === "jay" && (hashPassword(req.body.password) === correctPw)) || (req.body.username === "eddie" && (hashPassword(req.body.password) === ecorrect))) {
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
      Promise.all([si.mem(), si.currentLoad()]).then((results) => {
        var m = results[0];
        var cl = results[1];
        socket.emit("response.sysinfo", {
          ram: {
            percent: Math.floor((m.used / m.total) * 100).toString() + "%",
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
    io.to(res.replyId).emit("member.found", res)
  })

  socket.on("sendLogsSoon <3", function () {
    console.log("Bot connected!");
  });
  socket.on("log", (d) => {
    io.emit("log", d)
  })
});