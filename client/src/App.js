import { useEffect, useMemo, useState } from 'react';
import './App.css';

const AUTH_MODE = {
  LOGIN: 'login',
  REGISTER: 'register',
};

const MAX_AMOUNT_OPTIONS = 10;
const ROLE_OPTIONS = [
  { value: 'customer', label: 'Customer' },
  { value: 'seller', label: 'Seller' },
];
const PLACEHOLDER_IMAGE = 'https://via.placeholder.com/400x300?text=No+Image';

function App() {
  const [authMode, setAuthMode] = useState(AUTH_MODE.LOGIN);
  const [formValues, setFormValues] = useState({
    username: '',
    password: '',
    role: 'customer',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [productError, setProductError] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [detailState, setDetailState] = useState({
    size: '',
    amount: 1,
    isDescriptionOpen: true,
  });
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [newProductValues, setNewProductValues] = useState({
    name: '',
    price: '',
    stock: '',
    sizeOptions: '',
    imageUrl: '',
    description: '',
  });
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [productFormFeedback, setProductFormFeedback] = useState(null);
  const [isAddProductVisible, setIsAddProductVisible] = useState(false);

  const isRegister = authMode === AUTH_MODE.REGISTER;
  const actionLabel = isRegister ? 'Register' : 'Login';
  const toggleLabel = isRegister
    ? 'Click here to login.'
    : "Don't have ID ? Click here to register";
  const isSeller = user?.role === 'seller';

  useEffect(() => {
    if (!isSeller && isAddProductVisible) {
      setIsAddProductVisible(false);
    }
  }, [isSeller, isAddProductVisible]);

  const handleToggleMode = () => {
    setAuthMode((current) =>
      current === AUTH_MODE.LOGIN ? AUTH_MODE.REGISTER : AUTH_MODE.LOGIN
    );
    setFormValues({ username: '', password: '', role: 'customer' });
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
        setFormValues({
          username: formValues.username.trim(),
          password: '',
          role: 'customer',
        });
      } else {
        const apiUser = data?.user || null;
        setUser(
          apiUser
            ? {
              id: apiUser.id ?? null,
              username: apiUser.username ?? formValues.username.trim(),
              role: apiUser.role ?? 'customer',
            }
            : {
              id: null,
              username: formValues.username.trim(),
              role: 'customer',
            }
        );
        setFeedback(null);
        setFormValues({ username: '', password: '', role: 'customer' });
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
    setDetailState({ size: '', amount: 1, isDescriptionOpen: true });
    setNewProductValues({
      name: '',
      price: '',
      stock: '',
      sizeOptions: '',
      imageUrl: '',
      description: '',
    });
    setIsCreatingProduct(false);
    setProductFormFeedback(null);
    setIsAddProductVisible(false);
    setFormValues({ username: '', password: '', role: 'customer' });
    setAuthMode(AUTH_MODE.LOGIN);
  };

  const openProductDetail = (productId) => {
    setSelectedProduct(null);
    setDetailError(null);
    setDetailState({ size: '', amount: 1, isDescriptionOpen: true });
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
    setDetailState({ size: '', amount: 1, isDescriptionOpen: true });
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

  const detailMetadata = useMemo(() => {
    if (!selectedProduct) {
      return {
        sizeOptions: [],
        stockCount: 0,
        canPurchase: false,
        amountOptions: [1],
      };
    }

    const sizeOptions = Array.isArray(selectedProduct.sizeOptions)
      ? selectedProduct.sizeOptions.filter(
        (item) => (typeof item === 'string' || typeof item === 'number') && String(item).trim()
      ).map((item) => String(item).trim())
      : [];

    const rawStock =
      Number.isInteger(selectedProduct.stock) && selectedProduct.stock >= 0
        ? selectedProduct.stock
        : Number.parseInt(selectedProduct.stock ?? 0, 10) || 0;

    const stockCount = Math.max(0, rawStock);
    const maxAmount = stockCount > 0 ? Math.min(stockCount, MAX_AMOUNT_OPTIONS) : 1;
    const amountOptions = Array.from({ length: maxAmount }, (_, index) => index + 1);

    return {
      sizeOptions,
      stockCount,
      canPurchase: stockCount > 0,
      amountOptions,
    };
  }, [selectedProduct]);

  useEffect(() => {
    if (!selectedProduct) {
      return;
    }

    const defaultAmount = detailMetadata.amountOptions[0] ?? 1;

    setDetailState((prev) => ({
      ...prev,
      size: detailMetadata.sizeOptions.length > 0 ? detailMetadata.sizeOptions[0] : '',
      amount: defaultAmount,
    }));
  }, [selectedProduct, detailMetadata]);

  const handleDetailSelectChange = (event) => {
    const { name, value } = event.target;
    if (name === 'amount') {
      const numericValue = Number(value);
      const maxAmount = detailMetadata.canPurchase
        ? detailMetadata.amountOptions[detailMetadata.amountOptions.length - 1]
        : 1;
      const nextAmount = Number.isNaN(numericValue)
        ? 1
        : Math.min(Math.max(1, numericValue), maxAmount);

      setDetailState((prev) => ({ ...prev, amount: nextAmount }));
      return;
    }

    setDetailState((prev) => ({ ...prev, [name]: value }));
  };

  const toggleDescription = () => {
    setDetailState((prev) => ({ ...prev, isDescriptionOpen: !prev.isDescriptionOpen }));
  };

  const handleToggleAddProduct = () => {
    closeProductDetail();
    setProductFormFeedback(null);
    setIsAddProductVisible((prev) => !prev);
  };

  const handleNewProductChange = (event) => {
    const { name, value } = event.target;
    setNewProductValues((prev) => ({ ...prev, [name]: value }));
  };

  const resetNewProductForm = () => {
    setNewProductValues({
      name: '',
      price: '',
      stock: '',
      sizeOptions: '',
      imageUrl: '',
      description: '',
    });
  };

  const handleCreateProduct = async (event) => {
    event.preventDefault();

    if (!user?.id) {
      setProductFormFeedback({
        type: 'error',
        message: 'Cannot verify seller information. Please login again.',
      });
      return;
    }

    const nameValue = newProductValues.name.trim();
    const priceValue = Number.parseFloat(newProductValues.price);
    const stockValue = Number.parseInt(newProductValues.stock, 10);

    if (!nameValue) {
      setProductFormFeedback({ type: 'error', message: 'Product name is required.' });
      return;
    }

    if (!Number.isFinite(priceValue) || priceValue <= 0) {
      setProductFormFeedback({ type: 'error', message: 'Enter a valid price greater than zero.' });
      return;
    }

    if (!Number.isInteger(stockValue) || stockValue < 0) {
      setProductFormFeedback({
        type: 'error',
        message: 'Enter a stock quantity that is zero or a positive number.',
      });
      return;
    }

    const sizeList = newProductValues.sizeOptions
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const uniqueSizes = [...new Set(sizeList)];
    const imageValue = newProductValues.imageUrl.trim();
    const descriptionValue = newProductValues.description.trim();

    setIsCreatingProduct(true);
    setProductFormFeedback(null);

    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sellerId: user.id,
          name: nameValue,
          price: priceValue,
          stock: stockValue,
          sizeOptions: uniqueSizes,
          imageUrl: imageValue || null,
          description: descriptionValue || null,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to create product.');
      }

      if (payload?.product) {
        setProducts((prev) => [payload.product, ...(Array.isArray(prev) ? prev : [])]);
      }

      setProductFormFeedback({
        type: 'success',
        message: payload?.message || 'Product created successfully.',
      });
      resetNewProductForm();
    } catch (error) {
      setProductFormFeedback({ type: 'error', message: error.message });
    } finally {
      setIsCreatingProduct(false);
    }
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
              <fieldset className="field role-field">
                <legend>Register as</legend>
                <div className="role-options">
                  {ROLE_OPTIONS.map((option) => (
                    <label key={option.value}>
                      <input
                        type="radio"
                        name="role"
                        value={option.value}
                        checked={formValues.role === option.value}
                        onChange={handleChange}
                        disabled={isSubmitting}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
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
          <a href="#home">Home</a>
          <a href="#cart">Cart</a>
          <a href="#about">About</a>
          {isSeller ? (
            <button type="button" onClick={handleToggleAddProduct}>
              {isAddProductVisible ? 'View products' : 'Add product'}
            </button>
          ) : null}
          <button type="button" onClick={handleLogout}>
            Logout
          </button>
        </nav>
      </header>

      <main className="product-layout">
        {isSeller && isAddProductVisible ? (
          <section className="seller-panel">
            <h2>Add a product</h2>
            <form className="seller-form" onSubmit={handleCreateProduct}>
              <div className="seller-form-row">
                <label>
                  <span>Name</span>
                  <input
                    type="text"
                    name="name"
                    placeholder="Product name"
                    value={newProductValues.name}
                    onChange={handleNewProductChange}
                    disabled={isCreatingProduct}
                    required
                  />
                </label>
                <label>
                  <span>Price</span>
                  <input
                    type="number"
                    name="price"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={newProductValues.price}
                    onChange={handleNewProductChange}
                    disabled={isCreatingProduct}
                    required
                  />
                </label>
                <label>
                  <span>Quantity</span>
                  <input
                    type="number"
                    name="stock"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={newProductValues.stock}
                    onChange={handleNewProductChange}
                    disabled={isCreatingProduct}
                    required
                  />
                </label>
              </div>
              <div className="seller-form-row">
                <label>
                  <span>Sizes (optional)</span>
                  <input
                    type="text"
                    name="sizeOptions"
                    placeholder="Ex. S,M,L or leave blank"
                    value={newProductValues.sizeOptions}
                    onChange={handleNewProductChange}
                    disabled={isCreatingProduct}
                  />
                </label>
                <label>
                  <span>Image URL (optional)</span>
                  <input
                    type="url"
                    name="imageUrl"
                    placeholder="https://example.com/image.jpg"
                    value={newProductValues.imageUrl}
                    onChange={handleNewProductChange}
                    disabled={isCreatingProduct}
                  />
                </label>
              </div>
              <label className="seller-form-row">
                <span>Description (optional)</span>
                <textarea
                  name="description"
                  rows={3}
                  placeholder="Tell customers about this product"
                  value={newProductValues.description}
                  onChange={handleNewProductChange}
                  disabled={isCreatingProduct}
                />
              </label>
              <div className="seller-form-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={handleToggleAddProduct}
                  disabled={isCreatingProduct}
                >
                  Back to products
                </button>
                <button type="submit" disabled={isCreatingProduct}>
                  {isCreatingProduct ? 'Adding...' : 'Add product'}
                </button>
              </div>
            </form>
            {productFormFeedback ? (
              <p className={`seller-feedback ${productFormFeedback.type}`}>
                {productFormFeedback.message}
              </p>
            ) : null}
          </section>
        ) : null}

        {isAddProductVisible ? null : (
          isLoadingProducts ? (
            <p className="product-status">Loading products...</p>
          ) : productError ? (
            <p className="product-status error">{productError}</p>
          ) : filteredProducts.length === 0 ? (
            <p className="product-status">No products match the current search.</p>
          ) : (
            <section className="product-grid">
              {filteredProducts.map((product) => {
                const stockCount =
                  Number.isInteger(product.stock) && product.stock >= 0
                    ? product.stock
                    : Number.parseInt(product.stock ?? 0, 10) || 0;
                const imageSrc = product.imageUrl || PLACEHOLDER_IMAGE;

                return (
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
                      <img src={imageSrc} alt={product.name} loading="lazy" />
                    </figure>
                    <div className="product-info">
                      <h3>{product.name}</h3>
                      <p className="product-price">${product.price}</p>
                      <p className={`product-stock ${stockCount > 0 ? '' : 'out'}`}>
                        {stockCount > 0 ? `In stock: ${stockCount}` : 'Out of stock'}
                      </p>
                      {product.description ? (
                        <p className="product-description">{product.description}</p>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </section>
          )
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
                  <img src={selectedProduct.imageUrl || PLACEHOLDER_IMAGE} alt={selectedProduct.name} />
                </div>
                <div className="detail-info">
                  <h2>{selectedProduct.name}</h2>
                  <p className="detail-price">${selectedProduct.price}</p>

                  <p className={`detail-stock ${detailMetadata.canPurchase ? '' : 'out'}`}>
                    {detailMetadata.canPurchase
                      ? `In stock: ${detailMetadata.stockCount}`
                      : 'Out of stock'}
                  </p>

                  <div className="detail-controls">
                    {detailMetadata.sizeOptions.length > 0 ? (
                      <label>
                        <span>Size</span>
                        <select
                          name="size"
                          value={detailState.size}
                          onChange={handleDetailSelectChange}
                        >
                          {detailMetadata.sizeOptions.map((variant) => (
                            <option key={variant} value={variant}>
                              {variant}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <label
                      className={
                        detailMetadata.sizeOptions.length === 0 ? 'detail-amount-full' : ''
                      }
                    >
                      <span>Amount</span>
                      <select
                        name="amount"
                        value={detailState.amount}
                        onChange={handleDetailSelectChange}
                        disabled={!detailMetadata.canPurchase}
                      >
                        {detailMetadata.amountOptions.map((amount) => (
                          <option key={amount} value={amount}>
                            {amount}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <button
                    type="button"
                    className="detail-buy"
                    disabled={!detailMetadata.canPurchase}
                  >
                    {detailMetadata.canPurchase ? 'Buy' : 'Out of stock'}
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
