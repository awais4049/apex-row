const r = require('express').Router();
const multer = require('multer');
const { query, tx } = require('../db');
const { requireAdmin } = require('../auth');
const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);
const flash = (res, msg, type = 'ok') => res.cookie('flash', JSON.stringify({ msg, type }), { maxAge: 10000, httpOnly: true });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 6 }, fileFilter: (q, f, cb) => cb(null, /^image\/(jpeg|png|webp|gif)$/.test(f.mimetype)) });
r.use(requireAdmin);

const num = v => (v === undefined || String(v).trim() === '' ? null : Number(v));
async function refs() {
  return { brands: (await query('SELECT id,name FROM brands ORDER BY name')).rows, cats: (await query('SELECT id,name FROM categories ORDER BY id')).rows, colors: (await query('SELECT id,name,hex FROM colors ORDER BY id')).rows };
}
function parse(b) {
  const p = { brand_id: num(b.brand_id), new_brand: String(b.new_brand || '').trim(), category_id: num(b.category_id), model: String(b.model || '').trim(), model_year: num(b.model_year), price_usd: num(b.price_usd), hp: num(b.hp), torque_lbft: num(b.torque_lbft), zero_to_sixty: num(b.zero_to_sixty), top_speed_mph: num(b.top_speed_mph), engine: String(b.engine || '').trim() || null, fuel: b.fuel, drivetrain: String(b.drivetrain || '').trim() || null, transmission: String(b.transmission || '').trim() || null, seats: num(b.seats) ?? 2, stock: num(b.stock) ?? 1, body_hex: b.body_hex, shape: b.shape, description: String(b.description || '').trim() || null };
  const colors = [].concat(b.color_ids || []).map(Number).filter(Boolean);
  let err = null;
  if (!p.model) err = 'Model is required.';
  else if (!(p.price_usd > 0)) err = 'Price must be above 0.';
  else if (!Number.isInteger(p.stock) || p.stock < 0) err = 'Stock must be 0 or more.';
  else if (!['Gas', 'Hybrid', 'Electric'].includes(p.fuel)) err = 'Choose a fuel type.';
  else if (!/^#[0-9a-fA-F]{6}$/.test(p.body_hex || '')) err = 'Body color must be a hex color.';
  else if (!['coupe', 'mid', 'conv'].includes(p.shape)) err = 'Choose an illustration shape.';
  else if (!p.brand_id && !p.new_brand) err = 'Choose a brand or enter a new one.';
  return { p, colors, err };
}
const COLS = 'model,model_year,price_usd,hp,torque_lbft,zero_to_sixty,top_speed_mph,engine,fuel,drivetrain,transmission,seats,stock,body_hex,shape,description'.split(',');

r.get('/', wrap(async (req, res) => {
  const s = (await query(`SELECT (SELECT COUNT(*)::int FROM products) cars,(SELECT COUNT(*)::int FROM users) users,(SELECT COUNT(*)::int FROM orders WHERE status<>'cancelled') orders,
    (SELECT COALESCE(SUM(oi.unit_price_usd),0)::bigint FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE o.status<>'cancelled') reserved,(SELECT COALESCE(SUM(deposit_usd),0)::bigint FROM orders WHERE status<>'cancelled') deposits`)).rows[0];
  const low = (await query('SELECT p.id,p.model,p.stock,b.name brand FROM products p JOIN brands b ON b.id=p.brand_id WHERE p.stock<=1 ORDER BY p.stock,p.id')).rows;
  res.render('admin/dash', { title: 'Admin', s, low });
}));
r.get('/products', wrap(async (req, res) => {
  const rows = (await query('SELECT p.id,p.model,p.price_usd,p.stock,b.name brand,c.name category,(SELECT COUNT(*)::int FROM product_images WHERE product_id=p.id) photos FROM products p JOIN brands b ON b.id=p.brand_id JOIN categories c ON c.id=p.category_id ORDER BY p.id')).rows;
  res.render('admin/products', { title: 'Manage cars', rows });
}));
r.get('/products/new', wrap(async (req, res) => res.render('admin/form', { title: 'Add a car', car: null, images: [], sel: [], error: null, ...(await refs()) })));
r.post('/products', upload.array('images', 6), wrap(async (req, res) => {
  const { p, colors, err } = parse(req.body);
  if (err) return res.status(400).render('admin/form', { title: 'Add a car', car: { ...p, brand_id: p.brand_id }, images: [], sel: colors, error: err, ...(await refs()) });
  const id = await tx(async c => {
    let bid = p.brand_id;
    if (p.new_brand) bid = (await c.query('INSERT INTO brands(name) VALUES($1) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id', [p.new_brand])).rows[0].id;
    const id = (await c.query(`INSERT INTO products(brand_id,category_id,${COLS.join(',')}) VALUES($1,$2,${COLS.map((_, i) => '$' + (i + 3)).join(',')}) RETURNING id`, [bid, p.category_id, ...COLS.map(k => p[k])])).rows[0].id;
    for (const [i, f] of (req.files || []).entries()) await c.query('INSERT INTO product_images(product_id,mime,data,caption,is_primary) VALUES($1,$2,$3,$4,$5)', [id, f.mimetype, f.buffer, p.model, i === 0]);
    for (const k of colors) await c.query('INSERT INTO product_colors(product_id,color_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [id, k]);
    return id;
  });
  flash(res, 'Added ' + p.model + ' as car #' + id + '.'); res.redirect('/admin/products/' + id + '/edit');
}));
r.get('/products/:id/edit', wrap(async (req, res) => {
  const car = (await query('SELECT * FROM products WHERE id=$1', [parseInt(req.params.id, 10) || 0])).rows[0];
  if (!car) return res.status(404).render('error', { title: 'Not found', message: 'That car does not exist.' });
  const images = (await query('SELECT id,is_primary FROM product_images WHERE product_id=$1 ORDER BY is_primary DESC,id', [car.id])).rows;
  const sel = (await query('SELECT color_id FROM product_colors WHERE product_id=$1', [car.id])).rows.map(x => x.color_id);
  res.render('admin/form', { title: 'Edit ' + car.model, car, images, sel, error: null, ...(await refs()) });
}));
r.post('/products/:id', upload.array('images', 6), wrap(async (req, res) => {
  const id = parseInt(req.params.id, 10) || 0, { p, colors, err } = parse(req.body);
  const car = (await query('SELECT * FROM products WHERE id=$1', [id])).rows[0];
  if (!car) return res.status(404).render('error', { title: 'Not found', message: 'That car does not exist.' });
  if (err) { const images = (await query('SELECT id,is_primary FROM product_images WHERE product_id=$1 ORDER BY is_primary DESC,id', [id])).rows; return res.status(400).render('admin/form', { title: 'Edit ' + car.model, car: { ...p, id }, images, sel: colors, error: err, ...(await refs()) }); }
  await tx(async c => {
    let bid = p.brand_id;
    if (p.new_brand) bid = (await c.query('INSERT INTO brands(name) VALUES($1) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id', [p.new_brand])).rows[0].id;
    await c.query(`UPDATE products SET brand_id=$1,category_id=$2,${COLS.map((k, i) => k + '=$' + (i + 3)).join(',')} WHERE id=$${COLS.length + 3}`, [bid, p.category_id, ...COLS.map(k => p[k]), id]);
    const has = (await c.query('SELECT COUNT(*)::int n FROM product_images WHERE product_id=$1', [id])).rows[0].n;
    for (const [i, f] of (req.files || []).entries()) await c.query('INSERT INTO product_images(product_id,mime,data,caption,is_primary) VALUES($1,$2,$3,$4,$5)', [id, f.mimetype, f.buffer, p.model, has === 0 && i === 0]);
    const old = Object.fromEntries((await c.query('SELECT color_id,extra_usd FROM product_colors WHERE product_id=$1', [id])).rows.map(x => [x.color_id, x.extra_usd]));
    await c.query('DELETE FROM product_colors WHERE product_id=$1', [id]);
    for (const k of colors) await c.query('INSERT INTO product_colors(product_id,color_id,extra_usd) VALUES($1,$2,$3)', [id, k, old[k] || 0]);
  });
  flash(res, 'Saved changes to ' + p.model + '.'); res.redirect('/admin/products/' + id + '/edit');
}));
r.post('/products/:id/delete', wrap(async (req, res) => {
  const id = parseInt(req.params.id, 10) || 0;
  try { await query('DELETE FROM products WHERE id=$1', [id]); flash(res, 'Car deleted.'); res.redirect('/admin/products'); }
  catch (e) { if (e.code !== '23503') throw e; flash(res, 'This car has orders, so it cannot be deleted. Set its stock to 0 instead.', 'err'); res.redirect('/admin/products/' + id + '/edit'); }
}));
r.post('/images/:id/primary', wrap(async (req, res) => {
  const im = (await query('SELECT product_id FROM product_images WHERE id=$1', [parseInt(req.params.id, 10) || 0])).rows[0];
  if (!im) return res.sendStatus(404);
  await query('UPDATE product_images SET is_primary=(id=$1) WHERE product_id=$2', [req.params.id, im.product_id]); res.redirect('/admin/products/' + im.product_id + '/edit');
}));
r.post('/images/:id/delete', wrap(async (req, res) => {
  const im = (await query('DELETE FROM product_images WHERE id=$1 RETURNING product_id', [parseInt(req.params.id, 10) || 0])).rows[0];
  if (!im) return res.sendStatus(404);
  await query('UPDATE product_images SET is_primary=true WHERE id=(SELECT id FROM product_images WHERE product_id=$1 ORDER BY id LIMIT 1) AND NOT EXISTS (SELECT 1 FROM product_images WHERE product_id=$1 AND is_primary)', [im.product_id]);
  res.redirect('/admin/products/' + im.product_id + '/edit');
}));

r.get('/orders', wrap(async (req, res) => {
  const rows = (await query(`SELECT o.id,o.status,o.created_at,o.deposit_usd,u.username,u.email,
    (SELECT SUM(unit_price_usd) FROM order_items WHERE order_id=o.id)::int total,
    (SELECT string_agg(b.name||' '||p.model, ', ') FROM order_items oi JOIN products p ON p.id=oi.product_id JOIN brands b ON b.id=p.brand_id WHERE oi.order_id=o.id) items
    FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.id DESC`)).rows;
  res.render('admin/orders', { title: 'Orders', rows });
}));
r.post('/orders/:id/status', wrap(async (req, res) => {
  const id = parseInt(req.params.id, 10) || 0, nw = req.body.status;
  if (!['reserved', 'confirmed', 'delivered', 'cancelled'].includes(nw)) return res.status(400).render('error', { title: 'Bad request', message: 'Unknown status.' });
  try {
    await tx(async c => {
      const o = (await c.query('SELECT status FROM orders WHERE id=$1 FOR UPDATE', [id])).rows[0];
      if (!o) throw Object.assign(new Error('Order not found.'), { user: true });
      await c.query('UPDATE orders SET status=$1 WHERE id=$2', [nw, id]);
      const d = nw === 'cancelled' && o.status !== 'cancelled' ? 1 : o.status === 'cancelled' && nw !== 'cancelled' ? -1 : 0;
      if (d) await c.query('UPDATE products SET stock=stock+$1 WHERE id IN (SELECT product_id FROM order_items WHERE order_id=$2)', [d, id]);
    });
    flash(res, 'Order #' + id + ' is now ' + nw + '.');
  } catch (e) { if (e.code === '23514') flash(res, 'Cannot reopen this order: one of its cars has no stock left.', 'err'); else if (e.user) flash(res, e.message, 'err'); else throw e; }
  res.redirect('/admin/orders');
}));
r.get('/users', wrap(async (req, res) => {
  const rows = (await query('SELECT u.id,u.username,u.email,u.role,u.created_at,(SELECT COUNT(*)::int FROM orders WHERE user_id=u.id) orders FROM users u ORDER BY u.id')).rows;
  res.render('admin/users', { title: 'Users', rows });
}));
r.post('/users/:id/role', wrap(async (req, res) => {
  const id = parseInt(req.params.id, 10) || 0;
  if (id === req.user.id) { flash(res, 'You cannot change your own role.', 'err'); return res.redirect('/admin/users'); }
  if (!['admin', 'customer'].includes(req.body.role)) return res.sendStatus(400);
  await query('UPDATE users SET role=$1 WHERE id=$2', [req.body.role, id]); flash(res, 'Role updated.'); res.redirect('/admin/users');
}));
module.exports = r;
