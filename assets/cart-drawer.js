(function () {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-overlay');

  function openCart() {
    drawer?.classList.add('is-open');
    overlay?.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    drawer?.setAttribute('aria-hidden', 'false');
  }
  function closeCart() {
    drawer?.classList.remove('is-open');
    overlay?.classList.remove('is-open');
    document.body.style.overflow = '';
    drawer?.setAttribute('aria-hidden', 'true');
  }

  document.getElementById('cart-open-btn')?.addEventListener('click', openCart);
  overlay?.addEventListener('click', closeCart);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCart(); });

  // Close btn uses delegation because the button gets re-rendered on each refresh
  document.addEventListener('click', (e) => {
    if (e.target.closest('#cart-close-btn')) closeCart();
  });

  // Add to cart desde product cards — capture phase para interceptar antes que el <a> navegue
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-card-atc]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const variantId = btn.dataset.variantId;
    if (!variantId) return;
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '✓';
    try {
      const res = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ items: [{ id: parseInt(variantId), quantity: 1 }] })
      });
      if (res.ok) {
        await refreshCart();
        openCart();
      }
    } catch (err) {
      console.error('Card ATC error:', err);
    }
    btn.disabled = false;
    btn.innerHTML = original;
  }, true); // capture phase

  // Add to cart — click directo en el botón (type=button, sin submit)
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('#add-btn');
    if (!btn) return;
    const form = document.getElementById('product-form');
    if (!form) return;
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Agregando...';
    try {
      const variantId = document.getElementById('variant-id')?.value;
      const quantity = document.getElementById('qty-input')?.value || '1';
      const res = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ items: [{ id: parseInt(variantId), quantity: parseInt(quantity) }] })
      });
      if (!res.ok) {
        btn.innerHTML = original;
        btn.disabled = false;
        return;
      }
      await refreshCart();
      openCart();
      btn.disabled = false;
      btn.innerHTML = original;
    } catch (err) {
      console.error('Cart add error:', err);
      btn.disabled = false;
      btn.innerHTML = original;
    }
  });

  // Qty buttons (delegation — works after re-render)
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-qty-action]');
    if (!btn) return;
    const row = btn.closest('[data-item-key]');
    const itemKey = row?.dataset.itemKey;
    const qtyEl = row?.querySelector('[data-qty-value]');
    const current = parseInt(qtyEl?.textContent || '1');
    const next = btn.dataset.qtyAction === 'increase' ? current + 1 : Math.max(0, current - 1);
    await updateItem(itemKey, next);
  });

  // Remove item (delegation)
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-remove-key]');
    if (!btn) return;
    await updateItem(btn.dataset.removeKey, 0);
  });

  async function updateItem(itemKey, quantity) {
    try {
      const res = await fetch('/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemKey, quantity }),
      });
      if (!res.ok) {
        console.error('Cart change error:', await res.json());
        return;
      }
      await refreshCart();
    } catch (err) {
      console.error('Cart update error:', err);
    }
  }

  function money(cents) {
    return (cents / 100).toFixed(0);
  }

  async function refreshCart() {
    try {
      const cart = await fetch('/cart.js').then(r => r.json());
      renderDrawer(cart);
      document.querySelectorAll('#cart-count').forEach(el => {
        el.textContent = cart.item_count;
        el.style.display = cart.item_count > 0 ? '' : 'none';
      });
    } catch (err) {
      console.error('Cart refresh error:', err);
    }
  }

  function renderDrawer(cart) {
    const inner = document.getElementById('cart-drawer-inner');
    if (!inner) return;

    const header = `
      <div style="padding:24px 28px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(0,0,0,0.08);">
        <div class="display" style="font-size:28px;">YOUR BAG</div>
        <button id="cart-close-btn" aria-label="Close" style="width:36px;height:36px;border-radius:999px;border:1.5px solid rgba(0,0,0,0.12);background:transparent;cursor:pointer;font-size:16px;font-weight:700;">✕</button>
      </div>`;

    if (cart.item_count === 0) {
      inner.innerHTML = header + `
        <div style="flex:1;display:grid;place-items:center;padding:32px;text-align:center;">
          <div>
            <div class="display" style="font-size:48px;margin-bottom:12px;">EMPTY</div>
            <p style="opacity:0.6;margin-bottom:20px;">Nothing added yet.<br>Now <em>that</em> costs calories.</p>
            <a href="/0kcals/collections/all" class="btn btn--mint">Shop products →</a>
          </div>
        </div>`;
      return;
    }

    const items = cart.items.map(item => {
      const img = item.featured_image?.url
        ? `<img src="${item.featured_image.url}" alt="${item.product_title}" loading="lazy" style="width:100%;height:100%;object-fit:contain;">`
        : '';
      const variant = (item.variant_title && item.variant_title !== 'Default Title')
        ? `<div style="font-size:12px;opacity:0.6;margin-bottom:6px;">${item.variant_title}</div>` : '';
      return `
        <div data-item-key="${item.key}" style="display:grid;grid-template-columns:88px 1fr auto;gap:16px;padding:20px 0;border-bottom:1px solid rgba(0,0,0,0.06);">
          <a href="${item.url}" style="width:88px;height:100px;border-radius:12px;background:#f5f3eb;display:grid;place-items:center;overflow:hidden;flex-shrink:0;">${img}</a>
          <div>
            <div class="eyebrow" style="margin-bottom:4px;">${item.vendor}</div>
            <div style="font-weight:700;margin-bottom:6px;font-size:14px;line-height:1.3;">${item.product_title}</div>
            ${variant}
            <div style="display:flex;align-items:center;gap:8px;">
              <button data-qty-action="decrease" style="width:28px;height:28px;border-radius:999px;border:1.5px solid rgba(0,0,0,0.12);background:transparent;cursor:pointer;">−</button>
              <span data-qty-value style="min-width:20px;text-align:center;font-weight:700;">${item.quantity}</span>
              <button data-qty-action="increase" style="width:28px;height:28px;border-radius:999px;border:1.5px solid rgba(0,0,0,0.12);background:transparent;cursor:pointer;">+</button>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
            <span style="font-weight:800;font-family:'JetBrains Mono',monospace;white-space:nowrap;">S/. ${money(item.final_line_price)}</span>
            <button data-remove-key="${item.key}" aria-label="Remove ${item.product_title}" style="opacity:0.4;font-size:12px;background:none;border:0;cursor:pointer;">✕</button>
          </div>
        </div>`;
    }).join('');

    inner.innerHTML = header + `
      <div style="flex:1;overflow-y:auto;padding:8px 28px;">${items}</div>
      <div style="padding:24px 28px;border-top:1px solid rgba(0,0,0,0.08);background:rgba(0,0,0,0.02);">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px;opacity:0.6;">
          <span>Shipping</span><span>Calculated at checkout</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:16px;">
          <span class="display" style="font-size:22px;">SUBTOTAL</span>
          <span class="display" style="font-size:22px;">S/. ${money(cart.total_price)}</span>
        </div>
        <a href="/0kcals/pages/order" class="btn btn--mint btn--lg" style="width:100%;justify-content:center;">Go to checkout →</a>
        <div style="text-align:center;margin-top:12px;font-size:11px;opacity:0.5;font-family:'JetBrains Mono',monospace;letter-spacing:0.08em;text-transform:uppercase;">
          Order via WhatsApp · 24h dispatch
        </div>
      </div>`;
  }
  window.__0kRefreshCart = refreshCart;
})();
