import { useEffect, useMemo, useState } from 'react';
import './App.css';

const AUTH_MODE = {
  LOGIN: 'login',
  REGISTER: 'register',
};

const DEFAULT_VARIANTS = ['S', 'M', 'L'];
const DEFAULT_AMOUNTS = [1, 2, 3, 4, 5];

function App() {
  const [authMode, setAuthMode] = useState(AUTH_MODE.LOGIN);
  const [formValues, setFormValues] = useState({ username: '', password: '' });
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

  const isRegister = authMode === AUTH_MODE.REGISTER;
  const actionLabel = isRegister ? 'Register' : 'Login';
  const toggleLabel = isRegister
    ? 'Click here to login.'
    : "Don't have ID ? Click here to register";

  const handleToggleMode = () => {
    setAuthMode((current) =>
      current === AUTH_MODE.LOGIN ? AUTH_MODE.REGISTER : AUTH_MODE.LOGIN
    );
    setFormValues({ username: '', password: '' });
    setFeedback(null);
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
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formValues.username.trim(),
          password: formValues.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || 'Request failed');
      }

      if (isRegister) {
        setFeedback({ type: 'success', message: data?.message || 'Registration succeeded.' });
        setAuthMode(AUTH_MODE.LOGIN);
        setFormValues({ username: formValues.username.trim(), password: '' });
      } else {
        setUser(data?.user || { username: formValues.username.trim() });
        setFeedback(null);
        setFormValues({ username: '', password: '' });
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
    setAuthMode(AUTH_MODE.LOGIN);
  };

  const openProductDetail = (productId) => {
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
        setSelectedProduct(product);
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
          setProducts(Array.isArray(items) ? items : []);
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
          <a href="#home">Home</a>
          <a href="#cart">Cart</a>
          <a href="#about">About</a>
          <button type="button" onClick={handleLogout}>
            Logout
          </button>
        </nav>
      </header>

      <main className="product-layout">
        {isLoadingProducts ? (
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

      {selectedProduct || isLoadingDetail || detailError ? (
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
                    <label>
                      <span>Amount</span>
                      <select
                        name="amount"
                        value={detailState.amount}
                        onChange={handleDetailSelectChange}
                      >
                        {DEFAULT_AMOUNTS.map((amount) => (
                          <option key={amount} value={amount}>
                            {amount}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <button type="button" className="detail-buy">
                    Buy
                  </button>

                  <div className="detail-description">
                    <button type="button" onClick={toggleDescription}>
                      Detail
                      <span aria-hidden="true">{detailState.isDescriptionOpen ? '▾' : '▸'}</span>
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
    </div>
  );
}

export default App;