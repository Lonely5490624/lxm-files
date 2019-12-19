var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var expressJwt = require('express-jwt')
var fileupload = require('express-fileupload')

var checkToken = require('./controller/checkToken');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var depRouter = require('./routes/department');
var jobRouter = require('./routes/job');
var dirRouter = require('./routes/dir');
var fileRouter = require('./routes/file')
var shareRouter = require('./routes/share')
var perRouter = require('./routes/permission')
var collectRouter = require('./routes/collect')

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.all('*', function(req, res, next) {
  res.header('Access-Control-Allow-Origin', req.headers.origin);
  res.header('Access-Control-Allow-Methods', 'PUT GET POST DELETE OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, Content-Type, Content-Length, Authorization, Accept, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', true);
  next();
})

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(fileupload())

app.use(checkToken)
// app.use(expressJwt({
//   secret: 'lexuemao_2019_jwt'
// }))

app.use('/api/', indexRouter);
app.use('/api/users', usersRouter);
app.use('/api/users', depRouter)
app.use('/api/users', jobRouter)
app.use('/api/files', dirRouter)
app.use('/api/files', fileRouter)
app.use('/api/files', shareRouter)
app.use('/api/pers', perRouter)
app.use('/api/files', collectRouter)

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
