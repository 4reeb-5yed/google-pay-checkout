// Google Pay Store V2 — Single Page Store Application
// HTML5 History API Routing & Vanilla JS UI Components

(function () {
  'use strict';

  // --- Session Management ---
  function getSessionId() {
    let sessionId = localStorage.getItem('gpay_session_id');
    if (!sessionId) {
      sessionId = 'session_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
      localStorage.setItem('gpay_session_id', sessionId);
    }
    return sessionId;
  }

  // --- API Fetch Wrapper ---
  async function apiFetch(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'X-Session-ID': getSessionId(),
      ...(options.headers || {})
    };

    try {
      const response = await fetch(path, { ...options, headers });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Server request failed');
      }
      return data;
    } catch (err) {
      console.error(`API Error [${path}]:`, err);
      throw err;
    }
  }

  // Expose globally for checkout module
  window.appApiFetch = apiFetch;

  // --- Toast Manager ---
  function showToast(message, actionText = null, actionCallback = null) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>${message}</span>`;

    if (actionText && actionCallback) {
      const undoBtn = document.createElement('span');
      undoBtn.className = 'toast-undo';
      undoBtn.textContent = actionText;
      undoBtn.onclick = () => {
        actionCallback();
        toast.remove();
      };
      toast.appendChild(undoBtn);
    }

    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 4000);
  }

  window.showToast = showToast;

  // --- Cart Badge Update ---
  async function updateCartCount() {
    try {
      const cart = await apiFetch('/api/cart');
      const badge = document.getElementById('cart-badge-count');
      if (badge) {
        badge.textContent = cart.itemCount || 0;
      }
      return cart;
    } catch (err) {
      console.error('Failed to update cart count:', err);
    }
  }

  // --- HTML5 History API Routing ---
  function navigate(path) {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    route();
  }

  window.navigate = navigate;

  window.addEventListener('popstate', () => {
    route();
  });

  document.addEventListener('click', (e) => {
    const anchor = e.target.closest('a');
    if (anchor && anchor.getAttribute('href') && anchor.getAttribute('href').startsWith('/')) {
      const href = anchor.getAttribute('href');
      if (!href.startsWith('/api/') && !href.startsWith('//')) {
        e.preventDefault();
        navigate(href);
      }
    }
  });

  async function route() {
    const path = window.location.pathname;
    const appEl = document.getElementById('app');
    if (!appEl) return;

    updateHeaderNav(path);
    updateCartCount();

    if (path === '/' || path === '/index.html') {
      await renderCatalogPage(appEl);
    } else if (path.startsWith('/product/')) {
      const productId = path.replace('/product/', '').trim();
      await renderProductDetailPage(appEl, productId);
    } else if (path === '/cart') {
      await renderCartPage(appEl);
    } else if (path === '/checkout') {
      if (typeof window.renderCheckoutPage === 'function') {
        await window.renderCheckoutPage(appEl);
      } else {
        appEl.innerHTML = `<div style="color: var(--error); padding: 2rem;">Checkout page module not loaded.</div>`;
      }
    } else {
      await renderCatalogPage(appEl);
    }
  }

  function updateHeaderNav(path) {
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => {
      const tabPath = tab.getAttribute('href');
      if (path === '/' && tabPath === '/') {
        tab.classList.add('active');
      } else if (tabPath !== '/' && path.startsWith(tabPath)) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
  }

  // --- Header Component ---
  function renderHeader() {
    const headerContainer = document.getElementById('main-header');
    if (!headerContainer) return;

    headerContainer.innerHTML = `
      <div class="header-container">
        <a href="/" class="brand-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#2563EB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="#2563EB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="#2563EB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Google Pay Store <span class="brand-badge">V2 Real Store</span>
        </a>

        <nav class="nav-links">
          <a href="/" class="nav-tab active">Catalog</a>
        </nav>

        <a href="/cart" class="cart-button" title="View Cart">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="9" cy="21" r="1"/>
            <circle cx="20" cy="21" r="1"/>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
          </svg>
          <span>Cart</span>
          <span id="cart-badge-count" class="cart-badge">0</span>
        </a>
      </div>
    `;
  }

  // --- CATALOG PAGE VIEW ---
  let currentCategory = null;

  async function renderCatalogPage(container) {
    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Creator Hardware & Hardware Extensions</h1>
        <p class="page-subtitle">Premium physical devices, accessories, and integrated dev cloud plans.</p>
      </div>

      <div class="filter-bar">
        <button class="filter-btn ${!currentCategory ? 'active' : ''}" data-category="ALL">All Products</button>
        <button class="filter-btn ${currentCategory === 'Devices' ? 'active' : ''}" data-category="Devices">Devices</button>
        <button class="filter-btn ${currentCategory === 'Accessories' ? 'active' : ''}" data-category="Accessories">Accessories</button>
        <button class="filter-btn ${currentCategory === 'Plans' ? 'active' : ''}" data-category="Plans">Plans & Subscriptions</button>
      </div>

      <div id="product-grid-container" class="product-grid">
        <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-secondary);">
          Loading catalog...
        </div>
      </div>
    `;

    container.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const cat = e.target.getAttribute('data-category');
        currentCategory = (cat === 'ALL') ? null : cat;
        
        container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');

        await loadProductsGrid();
      });
    });

    await loadProductsGrid();
  }

  async function loadProductsGrid() {
    const gridEl = document.getElementById('product-grid-container');
    if (!gridEl) return;

    try {
      const url = currentCategory ? `/api/products?category=${encodeURIComponent(currentCategory)}` : '/api/products';
      const data = await apiFetch(url);
      const products = data.products || [];

      if (products.length === 0) {
        gridEl.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem;">No products found in this category.</div>`;
        return;
      }

      gridEl.innerHTML = products.map(p => {
        const svgIcon = (typeof getProductSVG === 'function') ? getProductSVG(p.id) : '';
        const isSub = p.type === 'subscription';

        return `
          <a href="/product/${p.id}" class="product-card">
            <div class="product-card-image">
              ${svgIcon}
            </div>
            <div class="product-card-body">
              <div class="product-category-tag">${p.category}</div>
              <h2 class="product-card-title">${p.name}</h2>
              <p class="product-card-desc">${p.description}</p>
              <div class="product-card-footer">
                <span class="product-price">${p.priceFormatted}${isSub ? '/mo' : ''}</span>
                <span class="product-type-badge ${isSub ? 'subscription' : ''}">
                  ${isSub ? 'Subscription' : 'Physical'}
                </span>
              </div>
            </div>
          </a>
        `;
      }).join('');
    } catch (err) {
      gridEl.innerHTML = `<div style="grid-column: 1/-1; color: var(--error); padding: 2rem;">Failed to load catalog products. Please refresh.</div>`;
    }
  }

  // --- PRODUCT DETAIL PAGE VIEW ---
  async function renderProductDetailPage(container, productId) {
    container.innerHTML = `
      <div style="padding: 2rem 0; text-align: center; color: var(--text-secondary);">
        Loading product details...
      </div>
    `;

    try {
      const [prodData, estimateData] = await Promise.all([
        apiFetch(`/api/products/${productId}`),
        apiFetch('/api/checkout/estimate', { method: 'POST' }).catch(() => null)
      ]);

      const p = prodData.product;
      const svgIcon = (typeof getProductSVG === 'function') ? getProductSVG(p.id) : '';
      const isSub = p.type === 'subscription';
      const estimateText = estimateData?.estimate?.disclosureText || 'Est. total resolves dynamically at checkout';

      container.innerHTML = `
        <div style="margin-bottom: 1.5rem;">
          <a href="/" style="font-size: 0.9rem; font-weight: 500; display: inline-flex; align-items: center; gap: 0.3rem;">
            ← Back to Catalog
          </a>
        </div>

        <div class="product-detail-container">
          <div class="product-media">
            <div style="transform: scale(2.2);">
              ${svgIcon}
            </div>
          </div>

          <div class="product-info">
            <div class="product-detail-category">${p.category}</div>
            <h1 class="product-detail-title">${p.name}</h1>
            <div class="product-detail-price">${p.priceFormatted} ${isSub ? `<span style="font-size: 1rem; font-weight: normal; color: var(--text-secondary);">/ ${p.recurrencePeriod.toLowerCase()}</span>` : ''}</div>

            <div class="price-estimate-note">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
              <span>${estimateText}</span>
            </div>

            <p class="product-detail-desc">${p.description}</p>

            <div class="product-action-section">
              ${!isSub ? `
                <div class="qty-selector">
                  <span class="qty-label">Quantity:</span>
                  <div class="qty-stepper">
                    <button type="button" class="qty-btn" id="qty-minus">-</button>
                    <input type="number" class="qty-input" id="qty-value" value="1" min="1" max="99" readonly>
                    <button type="button" class="qty-btn" id="qty-plus">+</button>
                  </div>
                </div>
              ` : `
                <div class="subscription-terms">
                  ⚡ <strong>Subscription Terms:</strong> Billed ${p.recurrencePeriod === 'YEAR' ? 'annually' : 'monthly'}. Instant setup, cancel anytime from account control panel.
                </div>
              `}

              <div class="btn-group">
                <button type="button" class="btn-primary" id="add-to-cart-btn">
                  Add to Cart
                </button>

                <!-- Inert Google Pay Express Guest Checkout Placeholder for Phase 2/3a -->
                <button type="button" class="gpay-placeholder-button" disabled title="Product Page Express Guest Checkout will be integrated in Phase 3b">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/>
                  </svg>
                  Buy with G Pay
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      // Stepper Logic
      const qtyVal = container.querySelector('#qty-value');
      const qtyMinus = container.querySelector('#qty-minus');
      const qtyPlus = container.querySelector('#qty-plus');

      if (qtyMinus && qtyPlus && qtyVal) {
        qtyMinus.addEventListener('click', () => {
          let v = parseInt(qtyVal.value, 10);
          if (v > 1) qtyVal.value = v - 1;
        });
        qtyPlus.addEventListener('click', () => {
          let v = parseInt(qtyVal.value, 10);
          if (v < 99) qtyVal.value = v + 1;
        });
      }

      // Add to Cart Button Logic
      const addBtn = container.querySelector('#add-to-cart-btn');
      if (addBtn) {
        addBtn.addEventListener('click', async () => {
          const qty = qtyVal ? parseInt(qtyVal.value, 10) : 1;
          try {
            const res = await apiFetch('/api/cart', {
              method: 'POST',
              body: JSON.stringify({ productId: p.id, quantity: qty })
            });
            await updateCartCount();

            if (res.replacedPlanName) {
              showToast(`Updated subscription plan to "${p.name}" (replaced ${res.replacedPlanName})`);
            } else {
              showToast(`Added "${p.name}" to cart`);
            }
          } catch (err) {
            showToast(`Failed to add item to cart: ${err.message}`);
          }
        });
      }

    } catch (err) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-title">Product Not Found</div>
          <div class="empty-desc">The requested product could not be loaded.</div>
          <a href="/" class="btn-primary">Return to Catalog</a>
        </div>
      `;
    }
  }

  // --- CART PAGE VIEW ---
  async function renderCartPage(container) {
    container.innerHTML = `
      <div style="padding: 2rem 0; text-align: center; color: var(--text-secondary);">
        Loading cart...
      </div>
    `;

    try {
      const [cart, estimateData] = await Promise.all([
        apiFetch('/api/cart'),
        apiFetch('/api/checkout/estimate', { method: 'POST' }).catch(() => null)
      ]);

      if (!cart.items || cart.items.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🛒</div>
            <h2 class="empty-title">Your cart is empty</h2>
            <p class="empty-desc">Looks like you haven't added any creator gear or subscription plans yet.</p>
            <a href="/" class="btn-primary">Browse Catalog</a>
          </div>
        `;
        return;
      }

      const hasSubscription = cart.items.some(i => i.type === 'subscription');
      const estimate = estimateData?.estimate;

      container.innerHTML = `
        <div class="page-header">
          <h1 class="page-title">Your Shopping Cart</h1>
          <p class="page-subtitle">${cart.itemCount} ${cart.itemCount === 1 ? 'item' : 'items'} in your cart</p>
        </div>

        ${hasSubscription ? `
          <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; padding: 0.85rem 1rem; border-radius: 8px; font-size: 0.875rem; font-weight: 500; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
            <span>ℹ️</span>
            <span><strong>Subscription Plan Notice:</strong> Adding a new plan replaces your previous plan. Only one active subscription plan can be in a cart at a time.</span>
          </div>
        ` : ''}

        <div class="cart-layout">
          <div class="cart-items-card">
            <table class="cart-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${cart.items.map(item => {
                  const svgIcon = (typeof getProductSVG === 'function') ? getProductSVG(item.productId) : '';
                  return `
                    <tr data-item-id="${item.itemId}">
                      <td>
                        <div class="cart-product-cell">
                          <div class="cart-thumb">
                            <div style="transform: scale(0.65);">
                              ${svgIcon}
                            </div>
                          </div>
                          <div>
                            <div class="cart-product-name">${item.name}</div>
                            <div class="cart-product-meta">${item.unitPriceFormatted} ${item.type === 'subscription' ? '/mo' : ''}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div class="qty-stepper">
                          <button type="button" class="qty-btn cart-qty-minus" data-id="${item.itemId}" data-qty="${item.quantity - 1}">-</button>
                          <input type="number" class="qty-input" value="${item.quantity}" readonly>
                          <button type="button" class="qty-btn cart-qty-plus" data-id="${item.itemId}" data-qty="${item.quantity + 1}">+</button>
                        </div>
                      </td>
                      <td style="font-weight: 600;">
                        ${item.lineTotalFormatted}
                      </td>
                      <td style="text-align: right;">
                        <button type="button" class="text-btn-danger remove-item-btn" data-id="${item.itemId}" data-name="${item.name}" data-prod-id="${item.productId}" data-qty="${item.quantity}">
                          Remove
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <div class="cart-summary-rail">
            <h3 class="summary-title">Order Summary</h3>

            <div class="summary-row">
              <span>Subtotal</span>
              <span style="font-weight: 600;">${cart.subtotalFormatted}</span>
            </div>

            ${estimate ? `
              <div class="summary-estimate-disclosure">
                💳 <strong>Estimated Card Surcharge:</strong><br/>
                ${estimate.disclosureText}
              </div>
            ` : ''}

            <div class="summary-row total">
              <span>Estimated Total</span>
              <span style="color: var(--accent);">${estimate ? estimate.minTotalFormatted + ' – ' + estimate.maxTotalFormatted : cart.subtotalFormatted}</span>
            </div>

            <button type="button" class="btn-primary" style="width: 100%; text-align: center;" id="proceed-to-checkout-btn">
              Proceed to Checkout →
            </button>
          </div>
        </div>
      `;

      const checkoutBtn = container.querySelector('#proceed-to-checkout-btn');
      if (checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
          navigate('/checkout');
        });
      }

      // Attach Stepper Listeners
      container.querySelectorAll('.cart-qty-minus, .cart-qty-plus').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const itemId = e.target.getAttribute('data-id');
          const newQty = parseInt(e.target.getAttribute('data-qty'), 10);
          try {
            await apiFetch(`/api/cart/items/${itemId}`, {
              method: 'PATCH',
              body: JSON.stringify({ quantity: newQty })
            });
            await renderCartPage(container);
          } catch (err) {
            showToast(`Failed to update quantity: ${err.message}`);
          }
        });
      });

      // Attach Remove Listeners with Undo
      container.querySelectorAll('.remove-item-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const itemId = e.target.getAttribute('data-id');
          const itemName = e.target.getAttribute('data-name');
          const prodId = e.target.getAttribute('data-prod-id');
          const qty = parseInt(e.target.getAttribute('data-qty'), 10);

          try {
            await apiFetch(`/api/cart/items/${itemId}`, { method: 'DELETE' });
            await updateCartCount();
            await renderCartPage(container);

            showToast(`Removed "${itemName}" from cart`, 'Undo', async () => {
              await apiFetch('/api/cart', {
                method: 'POST',
                body: JSON.stringify({ productId: prodId, quantity: qty })
              });
              await updateCartCount();
              const appEl = document.getElementById('app');
              if (window.location.pathname === '/cart') {
                await renderCartPage(appEl);
              }
            });
          } catch (err) {
            showToast(`Failed to remove item: ${err.message}`);
          }
        });
      });

    } catch (err) {
      container.innerHTML = `<div style="color: var(--error); padding: 2rem;">Failed to load cart. Please refresh.</div>`;
    }
  }

  // App Initialization
  document.addEventListener('DOMContentLoaded', () => {
    renderHeader();
    route();
  });

})();
