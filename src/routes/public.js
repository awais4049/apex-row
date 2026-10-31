const r = require('express').Router();
const { query } = require('../db');
const { search } = require('../cars');
const art = require('../illustration');
const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

r.get('/', wrap(async (req, res) => {
  const [cars, brands, cats, total] = await Promise.all([
    search(req.query),
    query('SELECT DISTINCT b.id,b.name FROM brands b JOIN products p ON p.brand_id=b.id ORDER BY b.name'),
    query('SELECT DISTINCT c.id,c.name FROM categories c JOIN products p ON p.category_id=c.id ORDER BY c.id'),
    query('SELECT COUNT(*)::int n FROM products')]);
  res.render('index', { title: 'Apex Row', cars, brands: brands.rows, cats: cats.rows, f: req.query, total: total.rows[0].n });
}));

r.get('/cars/:id', wrap(async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return res.status(404).render('error', { title: 'Not found', message: 'That car does not exist.' });
  const p = (await query('SELECT p.*,b.name brand,b.country,b.founded,c.name category FROM products p JOIN brands b ON b.id=p.brand_id JOIN categories c ON c.id=p.category_id WHERE p.id=$1', [req.params.id])).rows[0];
  if (!p) return res.status(404).render('error', { title: 'Not found', message: 'That car does not exist.' });
  const images = (await query('SELECT id,caption FROM product_images WHERE product_id=$1 ORDER BY is_primary DESC,id', [p.id])).rows;
  const colors = (await query('SELECT c.name,c.hex,pc.extra_usd FROM product_colors pc JOIN colors c ON c.id=pc.color_id WHERE pc.product_id=$1 ORDER BY c.id', [p.id])).rows;
  const sel = images.find(i => String(i.id) === req.query.img) || images[0];
  res.render('car', { title: p.brand + ' ' + p.model, p, images, colors, sel });
}));

r.get('/cars/:id/image', wrap(async (req, res) => {
  const id = parseInt(req.params.id, 10), n = parseInt(req.query.n, 10);
  if (!id) return res.sendStatus(404);
  const row = (n ? await query('SELECT mime,data FROM product_images WHERE id=$1 AND product_id=$2', [n, id])
    : await query('SELECT mime,data FROM product_images WHERE product_id=$1 ORDER BY is_primary DESC,id LIMIT 1', [id])).rows[0];
  if (row) return res.set('Content-Type', row.mime).set('Cache-Control', 'public, max-age=300').send(row.data);
  const p = (await query('SELECT shape,body_hex FROM products WHERE id=$1', [id])).rows[0];
  if (!p) return res.sendStatus(404);
  res.type('image/svg+xml').send(art(p.shape, p.body_hex));
}));

r.get('/api/health', wrap(async (req, res) => { await query('SELECT 1'); res.json({ status: 'ok', database: 'up' }); }));
r.get('/api/products', wrap(async (req, res) => res.json((await search(req.query)).map(({ description, ...p }) => p))));
module.exports = r;
