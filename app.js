var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var mongodb = require('mongodb');       // 추가
var MongoClient = mongodb.MongoClient;  // 추가

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
const session = require('express-session');
var fileStore = require('session-file-store')(session);

var app = express();

app.use(session({
  secret: process.env.SESSION_SECRET || 'session-login',
  resave: false,
  saveUninitialized: false,
  store: new fileStore({
    path: './sessions',
    ttl: 24 * 60 * 60,
    reapInterval: 60 * 60
  }),
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// MongoDB
async function connectDB() {
  var databaseURL = "mongodb://localhost:27017/tictactoe";

  try {
    const database = await MongoClient.connect(databaseURL, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log("DB 연결 완료: " + databaseURL);
    app.set('database', database.db('tictactoe'));

    // 연결 종료 처리
    process.on("SIGINT", async () => {
      await database.close();
      console.log("DB 연결 종료");
      process.exit(0);
    });
  } catch (err) {
    console.error("DB 연결 실패: " + err);
    process.exit(1);
  }
}

connectDB().catch(err => {
  console.error("초기 DB 연결 실패: " + err);
  process.exit(1);
});



// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;