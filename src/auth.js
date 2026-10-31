const jwt = require('jsonwebtoken');
const { query } = require('./db');
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const safeNext = n => (typeof n === 'string' && n.startsWith('/') && !n.startsWith('//') ? n : '/');
async function attach(req, res, next) {
  req.user = null; res.locals.cartCount = 0;
  const t = req.cookies && req.cookies.token;
  if (t) {
    try {
      const { id } = jwt.verify(t, SECRET);
      req.user = (await query('SELECT id,username,email,role FROM users WHERE id=$1', [id])).rows[0] || null;
      if (req.user) res.locals.cartCount = (await query('SELECT COUNT(*)::int n FROM cart_items WHERE user_id=$1', [req.user.id])).rows[0].n;
    } catch (e) { /* invalid token: treat as logged out */ }
  }
  res.locals.user = req.user;
  next();
}
const startSession = (res, u) => res.cookie('token', jwt.sign({ id: u.id }, SECRET, { expiresIn: '7d' }), { httpOnly: true, sameSite: 'lax', maxAge: 7 * 864e5, secure: process.env.COOKIE_SECURE === 'true' });
const requireLogin = (req, res, next) => req.user ? next() : res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
const requireAdmin = (req, res, next) => !req.user ? res.redirect('/login?next=' + encodeURIComponent(req.originalUrl))
  : req.user.role === 'admin' ? next() : res.status(403).render('error', { title: 'Not allowed', message: 'Only the admin can open this page.' });
module.exports = { attach, startSession, requireLogin, requireAdmin, safeNext };
