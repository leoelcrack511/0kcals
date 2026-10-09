// Renders the 0KCALS Shopify theme (Liquid) into a static site for GitHub Pages.
// The theme is read from ../0kcals-theme (or THEME_DIR) and never modified.
//
//   node build.mjs                 → dist/ for https://<user>.github.io/0kcals/
//   BASE_PATH= node build.mjs      → dist/ served from the domain root

import { Liquid } from 'liquidjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { common as i18nCommon, files as i18nFiles } from './src/i18n/en.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const THEME = path.resolve(process.env.THEME_DIR || path.join(ROOT, '../0kcals-theme'));
const BUILD = path.join(ROOT, '.build');
const OUT = path.join(ROOT, 'dist');
const BASE = (process.env.BASE_PATH ?? '/0kcals').replace(/\/+$/, '');
// Demo mode: 0k-shim.js intercepts every wa.me link, so no real phone number ships.
const WA_PLACEHOLDER = '0';
const SETTINGS_OVERRIDES = { 'page-drop002': { wa_number: WA_PLACEHOLDER } };

const read = (p) => fs.readFileSync(p, 'utf8');
const readJSON = (p) => JSON.parse(read(p));

// ── 1. Copy the theme into .build/, translated to English and stripped of the
//       Shopify-only bits LiquidJS can't parse ──
const schemas = {};
const i18nSeen = new Set();
const i18nCommonUsed = new Set();

function translate(rel, src) {
  i18nSeen.add(rel);
  for (const [from, to] of i18nFiles[rel] || []) {
    if (!src.includes(from)) throw new Error(`i18n: not found in ${rel}: "${from.slice(0, 70)}"`);
    src = src.split(from).join(to);
  }
  for (const [from, to] of i18nCommon) {
    if (!src.includes(from)) continue;
    src = src.split(from).join(to);
    i18nCommonUsed.add(from);
  }
  return src;
}

function preprocess(rel, src) {
  src = src.replace(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/, (_, json) => {
    try { schemas[rel] = JSON.parse(json); } catch { schemas[rel] = {}; }
    return '';
  });
  src = src.replace(/posted_successfully\?/g, 'posted_successfully');

  if (rel === 'layout/theme.liquid') {
    src = src.replace(/\{%-?\s*section\s+'([^']+)'\s*-?%\}/g, "{{ __sections['$1'] }}");
    src = src.replace(/(\{\{-?\s*'cart-drawer\.js')/, '{{ __shim_tags }}\n  $1');
  }
  if (rel === 'sections/main-product.liquid') {
    // Ingredient copy was keyed to the original Shopify handles.
    src = src.replace("h == 'moreee'", "h contains 'peach'").replace("h == 'anaaal'", "h contains 'vanilla'");
  }
  if (rel === 'sections/main-404.liquid') {
    // The giant "0 KCAL HERE" headline broke mid-word on phones and at 1440px; one notch smaller fits.
    if (!src.includes('font-size:clamp(120px,30vw,480px)')) throw new Error('404 headline size changed in theme');
    src = src.replace('font-size:clamp(120px,30vw,480px)', 'font-size:clamp(80px,25vw,360px)');
  }
  return src;
}

fs.rmSync(BUILD, { recursive: true, force: true });
for (const dir of ['layout', 'sections', 'snippets']) {
  fs.mkdirSync(path.join(BUILD, dir), { recursive: true });
  for (const f of fs.readdirSync(path.join(THEME, dir))) {
    if (!f.endsWith('.liquid')) continue;
    const rel = `${dir}/${f}`;
    fs.writeFileSync(path.join(BUILD, rel), preprocess(rel, translate(rel, read(path.join(THEME, rel)))));
  }
}

// ── 2. Catalog: what used to live in the Shopify admin ──
const rawProducts = readJSON(path.join(ROOT, 'src/products.json'));
const products = rawProducts.map((p) => {
  const image = { src: `/media/${p.image}`, alt: p.title };
  const variant = {
    id: p.variant_id, title: 'Default Title', options: ['Default Title'],
    price: p.price, available: true, featured_image: null,
  };
  return {
    id: p.id, handle: p.handle, title: p.title, vendor: p.vendor,
    url: `/products/${p.handle}`, price: p.price, tags: p.tags,
    description: p.description, available: true,
    featured_image: image, images: [image],
    metafields: { custom: { card_color: p.card_color, card_accent: p.card_accent, drop: 'DROP 001', size: p.size } },
    has_only_default_variant: true,
    selected_or_first_available_variant: variant,
    variants: [variant],
    options_with_values: [{ name: 'Title', position: 1, values: ['Default Title'] }],
  };
});

const makeCollection = (handle, title) => ({
  handle, title, url: `/collections/${handle}`, products,
  products_count: products.length,
  all_tags: [...new Set(products.flatMap((p) => p.tags))].sort(),
});
const collections = { all: makeCollection('all', 'Products') };
const emptyCart = { item_count: 0, total_price: 0, items: [] };

// Data the browser-side cart needs (see src/0k-shim.js)
const pedidoSrc = read(path.join(THEME, 'sections/page-pedido.liquid'));
const shimData = {
  base: BASE,
  wa: WA_PLACEHOLDER,
  waIcon: (pedidoSrc.match(/<svg width="22"[\s\S]*?<\/svg>/) || [''])[0],
  variants: Object.fromEntries(products.map((p) => [p.variants[0].id, {
    product_title: p.title, vendor: p.vendor, url: p.url, image: p.featured_image.src,
    price: p.price, card_color: p.metafields.custom.card_color,
  }])),
};
const shimTags =
  `<script>window.__0K = ${JSON.stringify(shimData).replace(/</g, '\\u003c')};</script>\n` +
  `  <script src="/assets/0k-shim.js"></script>`;

// ── 3. Liquid engine with the Shopify filters/tags the theme uses ──
const attr = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const kwargs = (args) => args.filter(Array.isArray);

function makeEngine(globals) {
  const engine = new Liquid({
    root: [path.join(BUILD, 'sections'), path.join(BUILD, 'layout')],
    partials: path.join(BUILD, 'snippets'),
    extname: '.liquid',
    globals,
  });

  engine.registerFilter('asset_url', (name) => `/assets/${name}`);
  engine.registerFilter('image_url', (img) => (typeof img === 'string' ? img : img?.src ?? ''));
  engine.registerFilter('image_tag', (src, ...args) =>
    `<img src="${attr(src)}"${kwargs(args).map(([k, v]) => ` ${k}="${attr(v)}"`).join('')}>`);
  engine.registerFilter('stylesheet_tag', (url) => `<link href="${url}" rel="stylesheet" type="text/css" media="all" />`);
  engine.registerFilter('script_tag', (url) => `<script src="${url}" type="text/javascript"></script>`);
  engine.registerFilter('money_without_currency', (cents) => String(Math.round((Number(cents) || 0) / 100)));
  engine.registerFilter('handleize', (s) => String(s ?? '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''));

  // {% form 'contact', id: '...' %} — static forms are handled client-side by 0k-shim.js
  engine.registerTag('form', {
    parse(token, remainTokens) {
      this.args = token.args;
      this.tpls = [];
      const stream = this.liquid.parser.parseStream(remainTokens)
        .on('tag:endform', () => stream.stop())
        .on('template', (tpl) => this.tpls.push(tpl))
        .on('end', () => { throw new Error(`tag ${token.getText()} not closed`); });
      stream.start();
    },
    * render(ctx, emitter) {
      const type = (this.args.match(/^\s*'([^']+)'/) || [])[1] || 'contact';
      const id = (this.args.match(/id:\s*'([^']+)'/) || [])[1] || '';
      emitter.write(`<form method="post" action="/contact#${id}" id="${id}" accept-charset="UTF-8" class="contact-form" data-0k-form>` +
        `<input type="hidden" name="form_type" value="${type}" />`);
      ctx.push({ form: { posted_successfully: false } });
      yield this.liquid.renderer.renderTemplates(this.tpls, ctx, emitter);
      ctx.pop();
      emitter.write('</form>');
    },
  });

  return engine;
}

async function renderSection(engine, type, id, data = {}) {
  const schema = schemas[`sections/${type}.liquid`] || {};
  const defaults = (list = []) =>
    Object.fromEntries(list.filter((s) => s.id && 'default' in s).map((s) => [s.id, s.default]));
  const blockData = data.blocks || {};
  const blocks = (data.block_order || Object.keys(blockData)).map((bid) => {
    const b = blockData[bid];
    const bSchema = (schema.blocks || []).find((x) => x.type === b.type) || {};
    return { id: bid, type: b.type, settings: { ...defaults(bSchema.settings), ...b.settings }, shopify_attributes: '' };
  });
  const section = { id, settings: { ...defaults(schema.settings), ...data.settings, ...SETTINGS_OVERRIDES[type] }, blocks };
  const html = await engine.renderFile(type, { section });
  return `<div id="shopify-section-${id}" class="shopify-section">${html}</div>`;
}

// ── 4. Pages ──
const pageDefs = [
  { url: '/', template: 'index', page_type: 'index' },
  { url: '/collections/all', template: 'collection', page_type: 'collection', collection: collections.all, title: 'Products' },
  { url: '/collections/zerups', template: 'collection', page_type: 'collection', collection: makeCollection('zerups', 'Zerups'), title: 'Zerups' },
  { url: '/collections/syrups', template: 'collection', page_type: 'collection', collection: makeCollection('syrups', 'Syrups'), title: 'Syrups' },
  ...products.map((p) => ({ url: p.url, template: 'product', page_type: 'product', product: p, title: p.title })),
  { url: '/cart', template: 'cart', page_type: 'cart', title: 'Your bag' },
  { url: '/pages/zerup', template: 'page.zerup', page_type: 'page', title: 'What are Zerups?' },
  { url: '/pages/about', template: 'page.nosotros', page_type: 'page', title: 'About us' },
  { url: '/pages/contact', template: 'page.contacto', page_type: 'page', title: 'Contact' },
  { url: '/pages/drop002', template: 'page.drop002', page_type: 'page', title: 'Drop 002' },
  { url: '/pages/order', template: 'page.pedido', page_type: 'page', title: 'Your order' },
  { url: '/404', template: '404', page_type: '404', title: 'Page not found', file: '404.html' },
];

const prefixBase = (s) => (BASE ? s.replace(/(\s(?:href|src|action|poster)=["'])\/(?!\/)/g, `$1${BASE}/`) : s);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const settings = readJSON(path.join(THEME, 'config/settings_data.json')).current || {};
const written = [];

for (const def of pageDefs) {
  const [tplName, tplSuffix] = def.template.split('.');
  const globals = {
    shop: { name: '0KCALS' },
    routes: { root_url: '/', collections_url: '/collections', cart_url: '/cart' },
    settings,
    cart: emptyCart,
    collections,
    request: { path: def.url, page_type: def.page_type },
    template: { name: tplName, suffix: tplSuffix || null },
    page_title: def.title || '',
    content_for_header: '',
    product: def.product,
    collection: def.collection,
  };
  const engine = makeEngine(globals);
  const tplFile = `templates/${def.template}.json`;
  const tpl = JSON.parse(translate(tplFile, read(path.join(THEME, tplFile))));

  let content = '';
  for (const id of tpl.order) {
    const s = tpl.sections[id];
    if (s.disabled) continue;
    if (def.template === 'cart') {
      // Both cart states are prerendered; 0k-shim.js shows the one matching the browser cart.
      const full = await renderSection(makeEngine({ ...globals, cart: { ...emptyCart, item_count: 1 } }), s.type, id, s);
      content += `<div data-0k-cart-state="empty">${await renderSection(engine, s.type, id, s)}</div>` +
        `<div data-0k-cart-state="full" hidden>${full}</div>`;
    } else {
      content += await renderSection(engine, s.type, id, s);
    }
  }

  const sections = {};
  for (const id of ['header', 'cart-drawer', 'footer']) sections[id] = await renderSection(engine, id, id);

  const html = await engine.renderFile('theme', {
    content_for_layout: content, __sections: sections, __shim_tags: shimTags,
  });

  const file = def.file || path.join(def.url.replace(/^\//, ''), 'index.html');
  fs.mkdirSync(path.dirname(path.join(OUT, file)), { recursive: true });
  fs.writeFileSync(path.join(OUT, file), prefixBase(html));
  written.push(file);
}

// ── 5. Assets: only what the pages reference ──
fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
const referenced = new Set();
for (const file of written) {
  for (const m of read(path.join(OUT, file)).matchAll(/\/assets\/([^"'?#\s)<>]+)/g)) referenced.add(decodeURI(m[1]));
}
referenced.delete('0k-shim.js');
referenced.delete('cart-drawer.js');
for (const name of referenced) {
  const src = path.join(THEME, 'assets', name);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(OUT, 'assets', name));
  else console.warn(`  ! missing asset: ${name}`);
}

// cart-drawer.js: expose refreshCart so the shim can paint a cart restored from localStorage
const cartJs = translate('assets/cart-drawer.js', read(path.join(THEME, 'assets/cart-drawer.js')))
  .replace(/\}\)\(\);\s*$/, '  window.__0kRefreshCart = refreshCart;\n})();\n');
fs.writeFileSync(path.join(OUT, 'assets/cart-drawer.js'), prefixBase(cartJs));
fs.copyFileSync(path.join(ROOT, 'src/0k-shim.js'), path.join(OUT, 'assets/0k-shim.js'));
fs.cpSync(path.join(ROOT, 'src/media'), path.join(OUT, 'media'), { recursive: true });
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

for (const rel of Object.keys(i18nFiles)) if (!i18nSeen.has(rel)) throw new Error(`i18n: ${rel} was never built`);
for (const [from] of i18nCommon) if (!i18nCommonUsed.has(from)) console.warn(`  ! i18n common pair unused: "${from}"`);

console.log(`Built ${written.length} pages + ${referenced.size + 2} assets → dist/ (base: "${BASE || '/'}")`);
