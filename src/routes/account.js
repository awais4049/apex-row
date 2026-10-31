const r = require('express').Router();
const bcrypt = require('bcryptjs');
const { query, tx } = require('../db');
const { startSession, requireLogin, safeNext } = require('../auth');
const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);
const flash = (res, msg, type = 'ok') => res.cookie('flash', JSON.stringify({ msg, type }), { maxAge: 10000, httpOnly: true });

r.get('/signup', (req, res) => res.render('signup', { title: 'Sign up', error: null, v: {} }));
r.post('/signup', wrap(async (req, res) => {
  const username = String(req.body.username || '').trim(), email = String(req.body.email || '').trim().toLowerCase(), pw = String(req.body.password || '');
  const bad = !/^[A-Za-z0-9_]{3,20}$/.test(username) ? 'Username must be 3 to 20 letters, numbers or underscores.'
    : !/^\S+@\S+\.\S+$/.test(email) ? 'Enter a valid email address.'
    : pw.length < 6 ? 'Password must be at least 6 characters.' : null;
  if (bad) return res.status(400).render('signup', { title: 'Sign up', error: bad, v: { username, email } });
  const dup = (await query('SELECT 1 FROM users WHERE lower(username)=lower($1) OR email=$2', [username, email])).rows.length;
  if (dup) return res.status(409).render('signup', { title: 'Sign up', error: 'That username or email is already registered.', v: { username, email } });
  const u = (await query("INSERT INTO users(username,email,password_hash) VALUES($1,$2,$3) RETURNING id", [username, email, await bcrypt.hash(pw, 10)])).rows[0];
  startSession(res, u); flash(res, 'Welcome to Apex Row, ' + username + '.'); res.redirect('/');
}));

r.get('/login', (req, res) => res.render('login', { title: 'Log in', error: null, next: safeNext(req.query.next) }));
r.post('/login', wrap(async (req, res) => {
  const u = (await query('SELECT * FROM users WHERE lower(username)=lower($1)', [String(req.body.username || '').trim()])).rows[0];
  const next = safeNext(req.body.next);
  if (!u || !(await bcrypt.compare(String(req.body.password || ''), u.password_hash)))
    return res.status(401).render('login', { title: 'Log in', error: 'Wrong username or password.', next });
  startSession(res, u); res.redirect(next);
}));
r.post('/logout', (req, res) => { res.clearCookie('token'); res.redirect('/'); });

r.get('/cart', requireLogin, wrap(async (req, res) => {
  const items = (await query('SELECT p.id,p.model,p.price_usd,p.stock,b.name brand FROM cart_items ci JOIN products p ON p.id=ci.product_id JOIN brands b ON b.id=p.brand_id WHERE ci.user_id=$1 ORDER BY ci.added_at', [req.user.id])).rows;
  res.render('cart', { title: 'Your cart', items, total: items.reduce((t, i) => t + i.price_usd, 0) });
}));
r.post('/cart/add/:id', requireLogin, wrap(async (req, res) => {
  const p = (await query('SELECT stock FROM products WHERE id=$1', [parseInt(req.params.id, 10) || 0])).rows[0];
  if (!p) return res.status(404).render('error', { title: 'Not found', message: 'That car does not exist.' });
  if (p.stock < 1) { flash(res, 'That car is sold out.', 'err'); return res.redirect('back'); }
  await query('INSERT INTO cart_items(user_id,product_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [req.user.id, req.params.id]);
  flash(res, 'Added to your cart.'); res.redirect('/cart');
}));
r.post('/cart/remove/:id', requireLogin, wrap(async (req, res) => {
  await query('DELETE FROM cart_items WHERE user_id=$1 AND product_id=$2', [req.user.id, parseInt(req.params.id, 10) || 0]); res.redirect('/cart');
}));
r.post('/checkout', requireLogin, wrap(async (req, res) => {
  try {
    const oid = await tx(async c => {
      const items = (await c.query('SELECT p.id,p.price_usd,p.model FROM cart_items ci JOIN products p ON p.id=ci.product_id WHERE ci.user_id=$1 ORDER BY p.id FOR UPDATE OF p', [req.user.id])).rows;
      if (!items.length) throw Object.assign(new Error('Your cart is empty.'), { user: true });
      const dep = Math.round(items.reduce((t, i) => t + i.price_usd, 0) * 0.05);
      const id = (await c.query('INSERT INTO orders(user_id,deposit_usd) VALUES($1,$2) RETURNING id', [req.user.id, dep])).rows[0].id;
      for (const i of items) {
        const u = await c.query('UPDATE products SET stock=stock-1 WHERE id=$1 AND stock>0', [i.id]);
        if (!u.rowCount) throw Object.assign(new Error(i.model + ' just sold out. Remove it and try again.'), { user: true });
        await c.query('INSERT INTO order_items(order_id,product_id,unit_price_usd) VALUES($1,$2,$3)', [id, i.id, i.price_usd]);
      }
      await c.query('DELETE FROM cart_items WHERE user_id=$1', [req.user.id]);
      return id;
    });
    flash(res, 'Order #' + oid + ' is reserved. Your deposit has been recorded.'); res.redirect('/orders');
  } catch (e) { if (!e.user) throw e; flash(res, e.message, 'err'); res.redirect('/cart'); }
}));
r.get('/orders', requireLogin, wrap(async (req, res) => {
  const orders = (await query(`SELECT o.id,o.status,o.deposit_usd,o.created_at,
    (SELECT SUM(unit_price_usd) FROM order_items WHERE order_id=o.id)::int total,
    (SELECT string_agg(b.name||' '||p.model, ', ') FROM order_items oi JOIN products p ON p.id=oi.product_id JOIN brands b ON b.id=p.brand_id WHERE oi.order_id=o.id) items
    FROM orders o WHERE o.user_id=$1 ORDER BY o.id DESC`, [req.user.id])).rows;
  res.render('orders', { title: 'Your orders', orders });
}));
module.exports = r;
