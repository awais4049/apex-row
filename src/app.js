const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { attach } = require('./auth');
const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.locals.money = n => '$' + Number(n).toLocaleString('en-US');
app.locals.num = (v, u = '') => (v === null || v === undefined ? '—' : v + u);
app.locals.date = d => (d ? new Date(d).toISOString().slice(0, 10) : '');
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(attach);
app.use((req, res, next) => {
  res.locals.flash = null;
  if (req.cookies.flash) { try { res.locals.flash = JSON.parse(req.cookies.flash); } catch (e) { /* ignore */ } res.clearCookie('flash'); }
  next();
});
app.use(require('./routes/public'));
app.use(require('./routes/account'));
app.use('/admin', require('./routes/admin'));
app.use((req, res) => res.status(404).render('error', { title: 'Not found', message: 'That page does not exist.' }));
app.use((err, req, res, next) => {
  console.error(err);
  const bad = err.code === 'LIMIT_FILE_SIZE' || err.name === 'MulterError';
  res.status(bad ? 400 : 500).render('error', { title: 'Error', message: bad ? 'Upload problem: images must be under 5 MB each, up to 6 files.' : 'Something went wrong on the server.' });
});
module.exports = app;
