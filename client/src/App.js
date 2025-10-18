import { useEffect, useMemo, useState } from 'react';
import './App.css';

const AUTH_MODE = {
  LOGIN: 'login',
  REGISTER: 'register',
};

const ROLE_OPTIONS = [
  { value: 'client', label: 'Client' },
  { value: 'seller', label: 'Seller' },
];

const DEFAULT_VARIANTS = ['S', 'M', 'L'];
const DEFAULT_AMOUNTS = [1, 2, 3, 4, 5];
const DEFAULT_ADD_PRODUCT = { name: '', price: '', imageUrl: '', description: '', hasSize: true };
const CART_STORAGE_KEY = 'quickshop-cart-items';
const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/160x160?text=Quick+Shop';
const PAYMENT_OPTIONS = [
  { id: 'cod', label: '??????????? (COD)' },
  { id: 'card', label: '??????????' },
];

const normaliseProduct = (product = {}) => {
  const rawHasSize = product?.hasSize;
  const hasSize =
    rawHasSize === false ||
    rawHasSize === 0 ||
    (typeof rawHasSize === 'string' &&
      ['0', 'false', 'no', 'off'].includes(rawHasSize.trim().toLowerCase()))
      ? false
      : true;

  return {
    ...product,
    hasSize,
  };
};

function App() {
  const [authMode, setAuthMode] = useState(AUTH_MODE.LOGIN);
  const [formValues, setFormValues] = useState({ username: '', password: '', role: 'client' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [productError, setProductError] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [detailState, setDetailState] = useState({ size: 'S', amount: 1, isDescriptionOpen: true });
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [addProductValues, setAddProductValues] = useState({ ...DEFAULT_ADD_PRODUCT });
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [addProductFeedback, setAddProductFeedback] = useState(null);
  const [checkoutDetails, setCheckoutDetails] = useState({ paymentMethod: PAYMENT_OPTIONS[0].id, address: '' });
  const [checkoutMessage, setCheckoutMessage] = useState(null);
  const [cartItems, setCartItems] = useState(() => {
    if (typeof window === 'undefined') {
      return [];
    }
    try {
      const stored = window.localStorage.getItem(CART_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to read cart from storage:', error);
      return [];
    }
  });
  const [cartMessage, setCartMessage] = useState(null);
  const [activePage, setActivePage] = useState('home');
  const { size, amount } = detailState;
  const cartTotal = useMemo(() => cartItems.reduce((sum, item) => sum + (Number(item.price) || 0) * (item.amount || 0), 0), [cartItems]);
  const cartCount = useMemo(() => cartItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0), [cartItems]);

  const formatCurrency = (value) => Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const handleNavigate = (page) => {
    setActivePage(page);
    setSelectedProduct(null);
    setDetailError(null);
    setIsAddProductOpen(false);
    if (page !== 'home') {
      setCartMessage(null);
    }
  };

  const saveCartItems = (nextItems) => {
    setCartItems(nextItems);
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(nextItems));
    } catch (error) {
      console.error('Failed to persist cart:', error);
    }
  };

  const handleRemoveCartItem = (id) => {
    const nextItems = cartItems.filter((item) => item.id !== id);
    saveCartItems(nextItems);
  };

  const handleClearCart = () => {
    saveCartItems([]);
    setCartMessage(null);
    setCheckoutMessage(null);
  };

  const handleProceedToCheckout = () => {
    if (cartItems.length === 0) {
      return;
    }

    setActivePage('checkout');
    setCheckoutMessage(null);
    setSelectedProduct(null);
    setDetailError(null);
    setIsAddProductOpen(false);
  };

  const handleCheckoutInputChange = (event) => {
    const { name, value } = event.target;
    setCheckoutDetails((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckoutSubmit = (event) => {
    event.preventDefault();

    if (cartItems.length === 0) {
      setCheckoutMessage({ type: 'error', message: 'Cart is empty.' });
      return;
    }

    if (!checkoutDetails.address.trim()) {
      setCheckoutMessage({ type: 'error', message: '????????????????????????????' });
      return;
    }

    const paymentLabel = PAYMENT_OPTIONS.find((option) => option.id === checkoutDetails.paymentMethod)?.label || PAYMENT_OPTIONS[0].label;

    saveCartItems([]);
    setCheckoutMessage({
      type: 'success',
      message: ???????????????????????????????????? ,
    });
    setCheckoutDetails({ paymentMethod: PAYMENT_OPTIONS[0].id, address: '' });
    setCartMessage(null);
  };

  const handleBackToCart = () => {
    setActivePage('cart');
  };

  const handleAddToCart = () => {
    if (!selectedProduct) {
      return;
    }

    const entry = {
      id: `${selectedProduct.id}-${Date.now()}`,
      productId: selectedProduct.id,
      name: selectedProduct.name,
      price: selectedProduct.price,
      size: selectedProduct.hasSize === false ? null : size,
      amount,
      imageUrl: selectedProduct.imageUrl,
      addedAt: Date.now(),
    };

    saveCartItems([entry, ...cartItems]);
    setCartMessage({ type: 'success', message: 'Added to cart.' });
  };

  useEffect(() => {
    if (activePage !== 'home') {
      setCartMessage(null);
    }
    if (activePage !== 'checkout') {
      setCheckoutMessage(null);
      setCheckoutDetails((prev) => ({ ...prev, address: '' }));
    }
  }, [activePage]);

  useEffect(() => {
    setCartMessage(null);
  }, [selectedProduct, size, amount]);

  const isRegister = authMode === AUTH_MODE.REGISTER;
  const actionLabel = isRegister ? 'Register' : 'Login';
  const toggleLabel = isRegister
    ? 'Click here to login.'
    : "Don't have ID ? Click here to register";

  const handleToggleMode = () => {
    setAuthMode((current) =>
      current === AUTH_MODE.LOGIN ? AUTH_MODE.REGISTER : AUTH_MODE.LOGIN
    );
    setFormValues({ username: '', password: '', role: 'client' });
    setFeedback(null);
    setIsAddProductOpen(false);
    setAddProductFeedback(null);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formValues.username || !formValues.password) {
      setFeedback({ type: 'error', message: 'Please fill in both fields.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const payload = {
        username: formValues.username.trim(),
        password: formValues.password,
      };

      if (isRegister) {
        payload.role = formValues.role;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || 'Request failed');
      }

      if (isRegister) {
        setFeedback({ type: 'success', message: data?.message || 'Registration succeeded.' });
        setAuthMode(AUTH_MODE.LOGIN);
        setFormValues({ username: formValues.username.trim(), password: '', role: formValues.role });
      } else {
        const loginUser = data?.user || {
          username: formValues.username.trim(),
          role: 'client',
        };
        setUser(loginUser);
        setFeedback(null);
        setFormValues({ username: '', password: '', role: 'client' });
        setIsAddProductOpen(false);
        setAddProductFeedback(null);
        setActivePage('home');
      }
    } catch (error) {
      setFeedback({ type: 'error', message: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setProducts([]);
    setProductError(null);
    setSearchText('');
    setSelectedProduct(null);
    setDetailError(null);
    setDetailState({ size: 'S', amount: 1, isDescriptionOpen: true });
    setFormValues({ username: '', password: '', role: 'client' });
    setAuthMode(AUTH_MODE.LOGIN);
    setIsAddProductOpen(false);
    setAddProductFeedback(null);
    setAddProductValues({ ...DEFAULT_ADD_PRODUCT });
    setCartItems([]);
    setCartMessage(null);
    setActivePage('home');
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(CART_STORAGE_KEY);
    }
  };

  const openProductDetail = (productId) => {
    setActivePage('home');
    setSelectedProduct(null);
    setDetailError(null);
    setDetailState({ size: 'S', amount: 1, isDescriptionOpen: true });
    setIsLoadingDetail(true);

    fetch(`/api/products/${productId}`)
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.message || 'Failed to load product detail');
        }
        return response.json();
      })
      .then((product) => {
        setSelectedProduct(normaliseProduct(product));
      })
      .catch((error) => {
        setDetailError(error.message);
      })
      .finally(() => {
        setIsLoadingDetail(false);
      });
  };

  const closeProductDetail = () => {
    setSelectedProduct(null);
    setDetailError(null);
    setIsLoadingDetail(false);
  };

  const openAddProductForm = () => {
    setActivePage('home');
    setAddProductValues({ ...DEFAULT_ADD_PRODUCT });
    setAddProductFeedback(null);
    setIsAddProductOpen(true);
    closeProductDetail();
  };

  const closeAddProductForm = () => {
    if (!isSavingProduct) {
      setIsAddProductOpen(false);
      setAddProductFeedback(null);
    }
  };

  const handleAddProductChange = (event) => {
    const { name, value, type, checked } = event.target;
    setAddProductValues((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleAddProductSubmit = async (event) => {
    event.preventDefault();

    if (!user?.id) {
      setAddProductFeedback({ type: 'error', message: 'Missing seller information.' });
      return;
    }

    if (!addProductValues.name.trim()) {
      setAddProductFeedback({ type: 'error', message: 'Please provide a product name.' });
      return;
    }

    if (addProductValues.price === '') {
      setAddProductFeedback({ type: 'error', message: 'Please provide a product price.' });
      return;
    }

    setIsSavingProduct(true);
    setAddProductFeedback(null);

    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sellerId: user.id,
          name: addProductValues.name.trim(),
          price: Number(addProductValues.price),
          imageUrl: addProductValues.imageUrl.trim(),
          description: addProductValues.description.trim(),
          hasSize: Boolean(addProductValues.hasSize),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to create product');
      }

      if (data?.product) {
        const normalisedProduct = normaliseProduct(data.product);
        setProducts((prev) => [normalisedProduct, ...prev]);
        setSelectedProduct(normalisedProduct);
      }

      setAddProductFeedback({ type: 'success', message: data?.message || 'Product created.' });
      setAddProductValues({ ...DEFAULT_ADD_PRODUCT });
    } catch (error) {
      setAddProductFeedback({ type: 'error', message: error.message });
    } finally {
      setIsSavingProduct(false);
    }
  };

  useEffect(() => {
    if (!user) {
      return;
    }

    let isMounted = true;
    setIsLoadingProducts(true);
    setProductError(null);

    fetch('/api/products')
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.message || 'Failed to load products');
        }
        return response.json();
      })
      .then((items) => {
        if (isMounted) {
          setProducts(Array.isArray(items) ? items.map(normaliseProduct) : []);
        }
      })
      .catch((error) => {
        if (isMounted) {
          setProductError(error.message);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingProducts(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    setCartMessage(null);
  }, [selectedProduct, size, amount]);

  const filteredProducts = useMemo(() => {
    if (!searchText) {
      return products;
    }
    const keyword = searchText.trim().toLowerCase();
    return products.filter((product) =>
      product.name?.toLowerCase().includes(keyword) ||
      product.description?.toLowerCase().includes(keyword)
    );
  }, [products, searchText]);

  const handleDetailSelectChange = (event) => {
    const { name, value } = event.target;
    setDetailState((prev) => ({ ...prev, [name]: name === 'amount' ? Number(value) : value }));
  };

  const toggleDescription = () => {
    setDetailState((prev) => ({ ...prev, isDescriptionOpen: !prev.isDescriptionOpen }));
  };

  if (!user) {
    return (
      <main className="login-page">
        <span className="background-ring background-ring--left" aria-hidden="true"></span>
        <span className="background-ring background-ring--right" aria-hidden="true"></span>
        <section className="login-card">
          <h1 className="brand-title">Quick Shop</h1>
          <form className="login-form" onSubmit={handleSubmit}>
            <label className="field">
              <span className="field-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                  <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
                  <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M4 20.5c0-3.59 3.134-6.5 8-6.5s8 2.91 8 6.5" />
                </svg>
              </span>
              <input
                type="text"
                name="username"
                placeholder="Username"
                autoComplete="username"
                value={formValues.username}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </label>
            <label className="field">
              <span className="field-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                  <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 0 0-8 0v4" />
                  <rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M12 15v4" />
                </svg>
              </span>
              <input
                type="password"
                name="password"
                placeholder="Password"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                value={formValues.password}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </label>
            {isRegister ? (
              <label className="field field--select">
                <span className="field-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                    <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M7 7a5 5 0 0 1 10 0v2" />
                    <rect x="3" y="9" width="18" height="12" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    <path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M9 13h6" />
                  </svg>
                </span>
                <select
                  name="role"
                  value={formValues.role}
                  onChange={handleChange}
                  disabled={isSubmitting}
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <button type="submit" className="login-button" disabled={isSubmitting}>
              {isSubmitting ? `${actionLabel}...` : actionLabel}
            </button>
          </form>
          {feedback ? (
            <p className={`form-feedback ${feedback.type}`}>{feedback.message}</p>
          ) : null}
          <p className="form-switch">
            <button type="button" onClick={handleToggleMode} disabled={isSubmitting}>
              {toggleLabel}
            </button>
          </p>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-logo">Quick Shop</span>
          <button className="menu-button" type="button" aria-label="Toggle menu">
            <span></span>
            <span></span>
            <span></span>
          </button>
          <form className="search-bar" onSubmit={(event) => event.preventDefault()}>
            <input
              type="search"
              placeholder="Hinted search text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
            <button type="submit" aria-label="Search">
              <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="1.6" />
                <line x1="20" y1="20" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </form>
        </div>
        <nav className="main-nav">
          <button
            type="button"
            className={`nav-link${activePage === 'home' ? ' active' : ''}`}
            onClick={() => handleNavigate('home')}
          >
            Home
          </button>
          <button
            type="button"
            className={`nav-link${activePage === 'cart' ? ' active' : ''}`}
            onClick={() => handleNavigate('cart')}
          >
            Cart
            {cartCount > 0 ? <span className="cart-count">{cartCount}</span> : null}
          </button>
          <a className="nav-link" href="#about">About</a>
          {user?.role === 'seller' ? (
            <button
              type="button"
              className="nav-link"
              onClick={() => {
                handleNavigate('home');
                openAddProductForm();
              }}
            >
              Add Product
            </button>
          ) : null}
          <button type="button" className="nav-link" onClick={handleLogout}>
            Logout
          </button>
        </nav>
      </header>

      <main className="product-layout">
        {activePage === 'checkout' ? (
          <section className="checkout-section">
            <header className="checkout-header">
              <h2>Checkout</h2>
              <p className="checkout-total">รวมทั้งหมด ${formatCurrency(cartTotal)}</p>
            </header>
            {checkoutMessage ? (
              <p className={`form-feedback ${checkoutMessage.type}`}>
                {checkoutMessage.message}
              </p>
            ) : null}
            <form className="checkout-form" onSubmit={handleCheckoutSubmit}>
              <fieldset className="checkout-options">
                <legend>วิธีการชำระเงิน</legend>
                {PAYMENT_OPTIONS.map((option) => (
                  <label key={option.id} className="checkout-option">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={option.id}
                      checked={checkoutDetails.paymentMethod === option.id}
                      onChange={handleCheckoutInputChange}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </fieldset>
              <label className="checkout-address">
                <span>ที่อยู่สำหรับจัดส่ง</span>
                <textarea
                  name="address"
                  rows={4}
                  value={checkoutDetails.address}
                  onChange={handleCheckoutInputChange}
                  placeholder="กรอกที่อยู่สำหรับจัดส่ง"
                />
              </label>
              <div className="checkout-actions">
                <button type="button" className="cart-proceed secondary" onClick={handleBackToCart}>
                  Back to Cart
                </button>
                <button type="submit" className="cart-proceed" disabled={cartItems.length === 0}>
                  Confirm Order
                </button>
              </div>
            </form>
          </section>
        ) : activePage === 'cart' ? (
          <section className="cart-section">
            <header className="cart-header">
              <h2>My Cart</h2>
              {cartItems.length > 0 ? (
                <button type="button" className="cart-clear" onClick={handleClearCart}>
                  Clear Cart
                </button>
              ) : null}
            </header>
            {cartItems.length === 0 ? (
              <p className="cart-empty">Your cart is empty.</p>
            ) : (
              <>
                <ul className="cart-list">
                  {cartItems.map((item) => {
                    const lineTotal = (Number(item.price) || 0) * (item.amount || 0);
                    return (
                      <li key={item.id} className="cart-card">
                        <div className="cart-card__image">
                          <img
                            src={item.imageUrl || PLACEHOLDER_IMAGE}
                            alt={item.name}
                            loading="lazy"
                          />
                        </div>
                        <div className="cart-card__body">
                          <div className="cart-card__title">
                            <h3>{item.name}</h3>
                            <button
                              type="button"
                              className="cart-remove"
                              onClick={() => handleRemoveCartItem(item.id)}
                            >
                              Remove
                            </button>
                          </div>
                          <p className="cart-card__meta">
                            {item.amount} x ${formatCurrency(item.price)}
                            {item.size ? ` | Size ${item.size}` : ''}
                          </p>
                          <p className="cart-card__meta">
                            Added {new Date(item.addedAt).toLocaleString()}
                          </p>
                          <p className="cart-card__total">
                            Line Total ${formatCurrency(lineTotal)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <footer className="cart-summary">
                  <span>Total ({cartCount} {cartCount === 1 ? 'item' : 'items'})</span>
                  <span>${formatCurrency(cartTotal)}</span>
                </footer>
                <div className="cart-footer-actions">
                  <button
                    type="button"
                    className="cart-proceed"
                    onClick={handleProceedToCheckout}
                    disabled={cartItems.length === 0}
                  >
                    Buy
                  </button>
                </div>
              </>
            )}
          </section>
        ) : isLoadingProducts ? (
          <p className="product-status">Loading products...</p>
        ) : productError ? (
          <p className="product-status error">{productError}</p>
        ) : filteredProducts.length === 0 ? (
          <p className="product-status">No products match the current search.</p>
        ) : (
          <section className="product-grid">
            {filteredProducts.map((product) => (
              <article
                key={product.id}
                className="product-card"
                onClick={() => openProductDetail(product.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openProductDetail(product.id);
                  }
                }}
              >
                <figure>
                  <img src={product.imageUrl} alt={product.name} loading="lazy" />
                </figure>
                <div className="product-info">
                  <h3>{product.name}</h3>
                  <p className="product-price">${product.price}</p>
                  {product.description ? (
                    <p className="product-description">{product.description}</p>
                  ) : null}
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
      {activePage === 'home' && (selectedProduct || isLoadingDetail || detailError) ? (
        <div className="product-detail-overlay" role="dialog" aria-modal="true">
          <div className="product-detail">
            <button className="detail-close" type="button" onClick={closeProductDetail}>
              ×
            </button>
            {isLoadingDetail ? (
              <p className="detail-status">Loading product...</p>
            ) : detailError ? (
              <p className="detail-status error">{detailError}</p>
            ) : selectedProduct ? (
              <div className="detail-content">
                <div className="detail-image">
                  <img src={selectedProduct.imageUrl} alt={selectedProduct.name} />
                </div>
                <div className="detail-info">
                  <h2>{selectedProduct.name}</h2>
                  <p className="detail-price">${selectedProduct.price}</p>

                  <div className="detail-controls">
                    {selectedProduct.hasSize === false ? null : (
                      <label>
                        <span>Size</span>
                        <select
                          name="size"
                          value={detailState.size}
                          onChange={handleDetailSelectChange}
                        >
                          {DEFAULT_VARIANTS.map((variant) => (
                            <option key={variant} value={variant}>
                              {variant}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label>
                      <span>Amount</span>
                      <select
                        name="amount"
                        value={detailState.amount}
                        onChange={handleDetailSelectChange}
                      >
                        {DEFAULT_AMOUNTS.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="detail-actions">
                    <button type="button" className="detail-buy">
                      Buy
                    </button>
                    <button
                      type="button"
                      className="detail-add-cart"
                      onClick={handleAddToCart}
                    >
                      Add to Cart
                    </button>
                  </div>

                  {cartMessage ? (
                    <p className={`form-feedback ${cartMessage.type}`}>
                      {cartMessage.message}
                    </p>
                  ) : null}

                  <div className="detail-description">
                    <button type="button" onClick={toggleDescription}>
                      Detail
                      <span aria-hidden="true">{detailState.isDescriptionOpen ? '\u25BE' : '\u25B8'}</span>
                    </button>
                    {detailState.isDescriptionOpen && selectedProduct.description ? (
                      <p>{selectedProduct.description}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

                  <div className="detail-description">
                    <button type="button" onClick={toggleDescription}>
                      Detail
                      <span aria-hidden="true">{detailState.isDescriptionOpen ? '\u25BE' : '\u25B8'}</span>
                    </button>
                    {detailState.isDescriptionOpen && selectedProduct.description ? (
                      <p>{selectedProduct.description}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
{isAddProductOpen ? (
        <div className="product-detail-overlay" role="dialog" aria-modal="true">
          <div className="product-detail product-detail--form">
            <button
              className="detail-close"
              type="button"
              onClick={closeAddProductForm}
              disabled={isSavingProduct}
            >
              ×
            </button>
            <form className="add-product-form" onSubmit={handleAddProductSubmit}>
              <h2>Add New Product</h2>
              <label>
                <span>Product Name</span>
                <input
                  type="text"
                  name="name"
                  value={addProductValues.name}
                  onChange={handleAddProductChange}
                  placeholder="E.g. Stylish Tee"
                  required
                  disabled={isSavingProduct}
                />
              </label>
              <label>
                <span>Price (USD)</span>
                <input
                  type="number"
                  name="price"
                  min="0"
                  step="0.01"
                  value={addProductValues.price}
                  onChange={handleAddProductChange}
                  placeholder="10"
                  required
                  disabled={isSavingProduct}
                />
              </label>
              <label>
                <span>Image URL</span>
                <input
                  type="url"
                  name="imageUrl"
                  value={addProductValues.imageUrl}
                  onChange={handleAddProductChange}
                  placeholder="https://example.com/image.jpg"
                  disabled={isSavingProduct}
                />
              </label>
              <label>
                <span>Description</span>
                <textarea
                  name="description"
                  rows="4"
                  value={addProductValues.description}
                  onChange={handleAddProductChange}
                  placeholder="Describe your product"
                  disabled={isSavingProduct}
                ></textarea>
              </label>
              <label className="add-product-checkbox">
                <input
                  type="checkbox"
                  name="hasSize"
                  checked={addProductValues.hasSize}
                  onChange={handleAddProductChange}
                  disabled={isSavingProduct}
                />
                <span>This product has size options</span>
              </label>
              <label className="add-product-checkbox">
                <input
                  type="checkbox"
                  name="hasSize"
                  checked={addProductValues.hasSize}
                  onChange={handleAddProductChange}
                  disabled={isSavingProduct}
                />
                <span>This product has size options</span>
              </label>
              {addProductFeedback ? (
                <p className={`form-feedback ${addProductFeedback.type}`}>
                  {addProductFeedback.message}
                </p>
              ) : null}
              <div className="add-product-actions">
                <button
                  type="button"
                  onClick={closeAddProductForm}
                  className="add-product-cancel"
                  disabled={isSavingProduct}
                >
                  Cancel
                </button>
                <button type="submit" className="add-product-submit" disabled={isSavingProduct}>
                  {isSavingProduct ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;










