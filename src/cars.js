const { query } = require('./db');
const SORTS = { featured: 'p.id', low: 'p.price_usd', high: 'p.price_usd DESC', fast: 'p.zero_to_sixty ASC NULLS LAST', power: 'p.hp DESC NULLS LAST' };
async function search(f = {}) {
  const w = [], a = [];
  const add = (sql, v) => { a.push(v); w.push(sql.replace('?', '$' + a.length)); };
  String(f.q || '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6)
    .forEach(t => add("lower(b.name||' '||p.model||' '||coalesce(p.engine,'')||' '||c.name||' '||p.fuel) LIKE ?", '%' + t + '%'));
  if (/^\d+$/.test(f.brand || '')) add('p.brand_id = ?', +f.brand);
  if (/^\d+$/.test(f.category || '')) add('p.category_id = ?', +f.category);
  if (['Gas', 'Hybrid', 'Electric'].includes(f.fuel)) add('p.fuel = ?', f.fuel);
  const m = /^(\d+)-(\d*)$/.exec(f.price || '');
  if (m) { add('p.price_usd >= ?', +m[1]); if (m[2]) add('p.price_usd < ?', +m[2]); }
  const sql = `   SELECT p.*, b.name AS brand, c.name AS category, EXISTS(SELECT 1 FROM product_images i WHERE i.product_id=p.id) AS has_photo FROM products p JOIN brands b ON b.id=p.brand_id JOIN categories c ON c.id=p.category_id ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY ${SORTS[f.sort] || SORTS.featured}, p.id`;
  return (await query(sql, a)).rows;
}
module.exports = { search };
