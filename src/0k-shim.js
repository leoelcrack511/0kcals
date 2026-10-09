// Stands in for the Shopify storefront on the static build:
//  - answers /cart.js, /cart/add.js, /cart/change.js from a localStorage cart,
//    so the theme's own cart-drawer.js keeps working untouched
//  - paints the cart-dependent pages (/cart, /pages/pedido) on the client
//  - turns the contact forms into a local "¡RECIBIDO!" confirmation
//  - demo mode: wa.me links show the prebuilt order message instead of opening WhatsApp
(function () {
  var CFG = window.__0K || { base: '', variants: {} };
  var BASE = CFG.base || '';
  var KEY = '0k-demo-cart';
  var realFetch = window.fetch.bind(window);

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
  }
  function save(lines) {
    try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch (e) {}
    document.dispatchEvent(new CustomEvent('0k:cart'));
  }
  function money(cents) { return String(Math.round(cents / 100)); }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function cart() {
    var items = load().map(function (l) {
      var v = CFG.variants[l.id];
      if (!v) return null;
      return {
        key: l.id + ':0k', id: l.id, variant_id: l.id, quantity: l.quantity,
        product_title: v.product_title, vendor: v.vendor, url: BASE + v.url,
        featured_image: { url: BASE + v.image }, variant_title: null,
        price: v.price, line_price: v.price * l.quantity, final_line_price: v.price * l.quantity,
        card_color: v.card_color
      };
    }).filter(Boolean);
    return {
      item_count: items.reduce(function (n, i) { return n + i.quantity; }, 0),
      total_price: items.reduce(function (n, i) { return n + i.final_line_price; }, 0),
      currency: 'PEN',
      items: items
    };
  }

  function json(body) {
    return Promise.resolve(new Response(JSON.stringify(body), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    }));
  }

  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : input.url;
    var m = url.split('?')[0].match(/\/cart(\/add|\/change|\/update|\/clear)?\.js$/);
    if (!m) return realFetch(input, init);

    var body = {};
    try { body = JSON.parse((init && init.body) || '{}'); } catch (e) {}
    var lines = load();

    if (m[1] === '/add') {
      var added = body.items || [{ id: body.id, quantity: body.quantity }];
      added.forEach(function (it) {
        var id = parseInt(it.id, 10);
        var qty = parseInt(it.quantity, 10) || 1;
        if (!CFG.variants[id]) return;
        var line = lines.find(function (l) { return l.id === id; });
        if (line) line.quantity += qty; else lines.push({ id: id, quantity: qty });
      });
      save(lines);
      return json({ items: cart().items });
    }
    if (m[1] === '/change') {
      var cid = parseInt(String(body.id).split(':')[0], 10);
      var q = Math.max(0, parseInt(body.quantity, 10) || 0);
      lines = lines
        .map(function (l) { return l.id === cid ? { id: l.id, quantity: q } : l; })
        .filter(function (l) { return l.quantity > 0; });
      save(lines);
    }
    if (m[1] === '/clear') save([]);
    return json(cart());
  };

  // ── /cart: both states are prerendered, show the right one ──
  function syncCartPage() {
    var full = cart().item_count > 0;
    document.querySelectorAll('[data-0k-cart-state]').forEach(function (el) {
      el.hidden = (el.getAttribute('data-0k-cart-state') === 'full') !== full;
    });
  }

  // ── /pages/pedido: same markup as sections/page-pedido.liquid, filled from the cart ──
  function renderPedido() {
    if (!document.body.classList.contains('template-page-pedido')) return;
    var c = cart();
    var box = document.querySelector('#main-content .container');
    if (!box || c.item_count === 0) return;

    var msg = 'Hola! Quiero hacer el siguiente pedido:\n\n' +
      c.items.map(function (i) {
        return '• ' + i.quantity + 'x ' + i.product_title + ' — S/ ' + money(i.final_line_price) + '\n';
      }).join('') +
      '\nTotal: S/ ' + money(c.total_price) + '\n\n¿Cómo procedo con el pago?';
    var waUrl = 'https://wa.me/' + CFG.wa + '?text=' + encodeURIComponent(msg);

    var rows = c.items.map(function (i, idx) {
      var last = idx === c.items.length - 1;
      return '<div style="display:grid;grid-template-columns:60px 1fr auto;gap:14px;align-items:center;' +
        (last ? '' : 'padding-bottom:16px;margin-bottom:16px;border-bottom:1px solid rgba(245,243,235,0.07);') + '">' +
        '<div style="width:60px;height:68px;border-radius:10px;background:' + esc(i.card_color || '#f5f3eb') + ';display:grid;place-items:center;overflow:hidden;">' +
          '<img src="' + esc(i.featured_image.url) + '" loading="lazy" alt="' + esc(i.product_title) + '">' +
        '</div>' +
        '<div>' +
          '<div style="font-size:13px;opacity:0.5;margin-bottom:2px;">' + esc(i.vendor) + '</div>' +
          '<div style="font-weight:700;font-size:14px;line-height:1.3;">' + esc(i.product_title) + '</div>' +
          '<div style="font-size:12px;opacity:0.5;margin-top:4px;">Cant. ' + i.quantity + '</div>' +
        '</div>' +
        '<div style="font-family:\'JetBrains Mono\',monospace;font-weight:800;font-size:15px;white-space:nowrap;">S/ ' + money(i.final_line_price) + '</div>' +
      '</div>';
    }).join('');

    box.innerHTML =
      '<div class="eyebrow" style="color:var(--mint-500);margin-bottom:20px;">// CHECKOUT</div>' +
      '<h1 class="display" style="font-size:clamp(44px,8vw,80px);line-height:0.88;margin:0 0 20px;">' +
        'PAGO POR WEB<br><span style="color:var(--yellow);font-style:italic;">próximamente.</span></h1>' +
      '<div style="margin-bottom:32px;display:flex;justify-content:flex-end;">' +
        '<a href="' + BASE + '/pages/drop002" class="btn btn--yellow btn--lg page-drop-btn">PRE-ORDENA DROP 002 →</a></div>' +
      '<p style="font-size:17px;line-height:1.65;color:rgba(245,243,235,0.7);margin:0 0 48px;max-width:520px;">' +
        'Mientras tanto puedes completar tu pedido por WhatsApp — te respondemos en minutos y coordinamos el pago y el despacho directo.</p>' +
      '<div style="background:rgba(245,243,235,0.05);border:1px solid rgba(245,243,235,0.1);border-radius:16px;padding:28px;margin-bottom:32px;">' +
        '<div class="eyebrow" style="color:var(--mint-500);margin-bottom:20px;font-size:10px;">TU PEDIDO</div>' + rows +
        '<div style="display:flex;justify-content:space-between;align-items:center;padding-top:20px;margin-top:4px;border-top:1px solid rgba(245,243,235,0.12);">' +
          '<div class="display" style="font-size:20px;">TOTAL</div>' +
          '<div class="display" style="font-size:24px;color:var(--mint-500);">S/ ' + money(c.total_price) + '</div>' +
        '</div>' +
      '</div>' +
      '<a href="' + esc(waUrl) + '" target="_blank" rel="noopener" class="btn btn--lg" ' +
        'style="width:100%;justify-content:center;background:#25D366;color:#fff;border-color:#25D366;font-size:18px;gap:12px;text-decoration:none;">' +
        (CFG.waIcon || '') + ' Enviar pedido por WhatsApp</a>' +
      '<div style="text-align:center;margin-top:16px;font-size:11px;opacity:0.35;font-family:\'JetBrains Mono\',monospace;letter-spacing:0.08em;text-transform:uppercase;">' +
        'Te respondemos en menos de 24h · Despacho a todo el Perú</div>' +
      '<div style="margin-top:40px;text-align:center;">' +
        '<a href="' + BASE + '/cart" style="font-size:13px;opacity:0.4;color:var(--bone);text-decoration:underline;">← Volver a mi bolsa</a></div>';
  }

  // ── Contact forms: no backend, so confirm locally ──
  document.addEventListener('submit', function (e) {
    var form = e.target.closest && e.target.closest('[data-0k-form]');
    if (!form) return;
    e.preventDefault();
    if (!form.querySelector('[data-0k-received]')) {
      form.insertAdjacentHTML('afterbegin',
        '<div data-0k-received style="padding:20px;border-radius:16px;background:var(--mint-500);color:var(--green-900);margin-bottom:20px;">' +
        '<div class="display" style="font-size:20px;margin-bottom:4px;">¡RECIBIDO!</div>' +
        '<div style="font-size:14px;">Te respondemos en menos de 24h.</div></div>');
    }
    form.reset();
  });

  // ── WhatsApp (demo mode): show the prebuilt message instead of opening a chat ──
  function showWhatsAppDemo(url) {
    var text = '';
    try { text = new URL(url).searchParams.get('text') || ''; } catch (e) {}
    var prev = document.getElementById('0k-wa-demo');
    if (prev) prev.remove();

    var wrap = document.createElement('div');
    wrap.id = '0k-wa-demo';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-label', 'Demo de portafolio');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:200;display:grid;place-items:center;padding:20px;' +
      'background:rgba(10,20,17,0.6);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);';
    wrap.innerHTML =
      '<div style="background:var(--bone);color:var(--ink);border-radius:24px;padding:28px;width:100%;max-width:460px;max-height:calc(100vh - 40px);overflow:auto;">' +
        '<div class="eyebrow" style="margin-bottom:12px;">// DEMO DE PORTAFOLIO</div>' +
        '<div class="display" style="font-size:clamp(28px,7vw,40px);line-height:0.9;margin-bottom:14px;">ESTO IRÍA<br><span style="color:var(--green-900);">POR WHATSAPP.</span></div>' +
        '<p style="font-size:14px;line-height:1.55;opacity:0.7;margin:0 0 18px;">En la tienda real, este botón abre WhatsApp con el pedido ya armado. Este es el mensaje que se enviaría:</p>' +
        '<pre style="white-space:pre-wrap;font-family:\'JetBrains Mono\',monospace;font-size:12px;line-height:1.6;background:var(--ink);color:var(--mint-200);border-radius:14px;padding:16px;margin:0 0 20px;">' + esc(text) + '</pre>' +
        '<button type="button" data-0k-wa-close class="btn btn--mint btn--lg" style="width:100%;justify-content:center;">Entendido</button>' +
      '</div>';
    document.body.appendChild(wrap);
    document.body.style.overflow = 'hidden';

    function close() {
      wrap.remove();
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }
    wrap.addEventListener('click', function (e) {
      if (e.target === wrap || e.target.closest('[data-0k-wa-close]')) close();
    });
    document.addEventListener('keydown', onKey);
    wrap.querySelector('[data-0k-wa-close]').focus();
  }

  var realOpen = window.open;
  window.open = function (url) {
    if (typeof url === 'string' && url.indexOf('https://wa.me/') === 0) { showWhatsAppDemo(url); return null; }
    return realOpen.apply(window, arguments);
  };
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="https://wa.me/"]');
    if (!a) return;
    e.preventDefault();
    showWhatsAppDemo(a.href);
  });

  document.addEventListener('0k:cart', function () { syncCartPage(); renderPedido(); });
  document.addEventListener('DOMContentLoaded', function () {
    syncCartPage();
    renderPedido();
    if (cart().item_count > 0 && window.__0kRefreshCart) window.__0kRefreshCart();
  });
})();
