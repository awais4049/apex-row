const wheels = (a, b) => `<circle cx="${a}" cy="102" r="21" fill="#15191d"/><circle cx="${a}" cy="102" r="9" fill="#9aa3ac"/><circle cx="${b}" cy="102" r="21" fill="#15191d"/><circle cx="${b}" cy="102" r="9" fill="#9aa3ac"/>`;
const glass = 'fill="#121a22" fill-opacity=".78"';
const SHAPES = {
  coupe: `<path fill="HEX" d="M16 96C16 84 34 80 76 74L128 54C152 44 204 40 248 44C292 48 322 64 348 74C376 78 388 84 388 96V102H16Z"/><path ${glass} d="M136 58C158 50 202 47 240 50C268 53 292 64 310 72H146Z"/>${wheels(96, 308)}`,
  conv: `<path fill="HEX" d="M16 96C16 84 34 80 76 74L132 62C170 56 230 56 262 62C300 68 330 72 352 76C378 80 388 86 388 96V102H16Z"/><path ${glass} d="M140 62L168 51L184 53L176 63Z"/>${wheels(96, 308)}`,
  mid: `<path fill="HEX" d="M16 96C16 86 36 82 70 78L150 56C170 48 210 44 250 46C300 50 340 66 372 76C386 80 388 88 388 96V102H16Z"/><path ${glass} d="M158 60C182 52 220 50 252 52C282 56 304 66 318 74H166Z"/>${wheels(98, 312)}`
};
module.exports = (shape, hex) => {
  const h = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : '#C8102E';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 130">${(SHAPES[shape] || SHAPES.coupe).replace('HEX', h)}</svg>`;
};
