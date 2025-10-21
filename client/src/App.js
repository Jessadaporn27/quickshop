import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
const DEFAULT_CHECKOUT_FORM = {
  fullName: '',
  address: '',
  phone: '',
  paymentMethod: 'card',
};
const VIEW = {
  HOME: 'home',
  CART: 'cart',
  CHECKOUT: 'checkout',
  MY_PRODUCTS: 'myProducts',
  ORDERS: 'orders',
};

const buildCartKey = (productId, size) => `${productId}::${size || 'ALL'}`;

function formatCurrency(value) {
  const amount = Number.isFinite(value) ? value : 0;
  return `$${amount.toFixed(2)}`;
}

function formatDateTime(value) {
  if (!value) {
    return '';
  };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function buildProductDraft(product = {}) {
  return {
    name: product.name ?? '',
    price:
      product.price !== undefined && product.price !== null ? String(product.price) : '',
    stock:
      product.stock !== undefined && product.stock !== null ? String(product.stock) : '',
    sizeOptions: Array.isArray(product.sizeOptions) ? product.sizeOptions.join(', ') : '',
    imageFile: null,
    imagePreview: product.imageUrl ?? '',
    description: product.description ?? '',
  };
}

const EMPTY_PRODUCT_FORM = {
  name: '',
  price: '',
  stock: '',
  sizeOptions: '',
  description: '',
  imageFile: null,
  imagePreview: '',
};

const ORDER_STATUS = {
  PENDING: 'pending',
  PACKING: 'packing',
  SHIPPED: 'shipped',
  COMPLETED: 'completed',
};

const ORDER_STATUS_LABELS = {
  [ORDER_STATUS.PENDING]: 'Pending',
  [ORDER_STATUS.PACKING]: 'Packing',
  [ORDER_STATUS.SHIPPED]: 'Shipped',
  [ORDER_STATUS.COMPLETED]: 'Completed',
};

const ORDER_STATUS_ACTIONS = {
  [ORDER_STATUS.PENDING]: {
    next: ORDER_STATUS.PACKING,
    label: 'Mark as packing',
  },
  [ORDER_STATUS.PACKING]: {
    next: ORDER_STATUS.SHIPPED,
    label: 'Mark as shipped',
  },
};

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
  const [newProductValues, setNewProductValues] = useState({ ...EMPTY_PRODUCT_FORM });
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [productFormFeedback, setProductFormFeedback] = useState(null);
  const [isAddProductVisible, setIsAddProductVisible] = useState(false);
  const [currentView, setCurrentView] = useState(VIEW.HOME);
  const [cartItems, setCartItems] = useState([]);
  const [checkoutPayload, setCheckoutPayload] = useState(null);
  const [checkoutStatus, setCheckoutStatus] = useState(null);
  const [detailNotice, setDetailNotice] = useState(null);
  const [checkoutForm, setCheckoutForm] = useState(() => ({ ...DEFAULT_CHECKOUT_FORM }));
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orders, setOrders] = useState([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [ordersFeedback, setOrdersFeedback] = useState(null);
  const [orderUpdateStates, setOrderUpdateStates] = useState({});
  const [hasLoadedOrders, setHasLoadedOrders] = useState(false);
  const ordersFetchInFlight = useRef(false);
  const [sellerProducts, setSellerProducts] = useState([]);
  const [isLoadingSellerProducts, setIsLoadingSellerProducts] = useState(false);
  const [sellerProductsFeedback, setSellerProductsFeedback] = useState(null);
  const [sellerProductEdits, setSellerProductEdits] = useState({});
  const [sellerProductSaving, setSellerProductSaving] = useState({});
  const [hasLoadedSellerProducts, setHasLoadedSellerProducts] = useState(false);
  const sellerProductsFetchInFlight = useRef(false);
  const [topSellerProducts, setTopSellerProducts] = useState([]);
  const [isLoadingTopSellers, setIsLoadingTopSellers] = useState(false);
  const [topSellerFeedback, setTopSellerFeedback] = useState(null);
  const [hasLoadedTopSellers, setHasLoadedTopSellers] = useState(false);
  const topSellerFetchInFlight = useRef(false);

  const revokeObjectUrl = useCallback((url) => {
    if (url && url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }, []);

  const cleanupDraftPreview = useCallback((draft) => {
    if (draft?.imagePreview && draft.imagePreview.startsWith('blob:')) {
      revokeObjectUrl(draft.imagePreview);
    }
  }, [revokeObjectUrl]);

  const isRegister = authMode === AUTH_MODE.REGISTER;
  const actionLabel = isRegister ? 'Register' : 'Login';
  const toggleLabel = isRegister
    ? 'Click here to login.'
    : "Don't have ID ? Click here to register";
  const isSeller = user?.role === 'seller';
  const isCustomer = user?.role === 'customer';
  const isHomeView = currentView === VIEW.HOME;
  const isCartView = currentView === VIEW.CART;
  const isCheckoutView = currentView === VIEW.CHECKOUT;
  const isOrdersView = currentView === VIEW.ORDERS;
  const isMyProductsView = currentView === VIEW.MY_PRODUCTS;
  const hasCartItems = cartItems.length > 0;
  const resetCheckoutFlow = () => {
    setCheckoutPayload(null);
    setCheckoutStatus(null);
    setCheckoutForm({ ...DEFAULT_CHECKOUT_FORM });
    setIsPlacingOrder(false);
  };

  const fetchOrders = useCallback(
    (force = false) => {
      if (!user?.id || (!isSeller && !isCustomer)) {
        return;
      }

      if (!force && hasLoadedOrders) {
        return;
      }

      if (ordersFetchInFlight.current) {
        return;
      }

      ordersFetchInFlight.current = true;
      setIsLoadingOrders(true);
      setOrdersFeedback(null);

      const endpoint = isSeller
        ? `/api/sellers/${user.id}/orders`
        : `/api/users/${user.id}/orders`;

      fetch(endpoint)
        .then(async (response) => {
          if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload?.message || 'Failed to load orders.');
          }
          return response.json();
        })
        .then((items) => {
          setOrders(Array.isArray(items) ? items : []);
          setHasLoadedOrders(true);
        })
        .catch((error) => {
          setOrdersFeedback({ type: 'error', message: error.message });
          setHasLoadedOrders(false);
        })
        .finally(() => {
          setIsLoadingOrders(false);
          ordersFetchInFlight.current = false;
        });
    },
    [hasLoadedOrders, isCustomer, isSeller, user?.id]
  );

  const fetchTopSellerProducts = useCallback(
    (force = false) => {
      if (!user) {
        return;
      }

      if (!force && hasLoadedTopSellers) {
        return;
      }

      if (topSellerFetchInFlight.current) {
        return;
      }

      topSellerFetchInFlight.current = true;
      setIsLoadingTopSellers(true);
      setTopSellerFeedback(null);

      fetch('/api/products/top')
        .then(async (response) => {
          if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload?.message || 'Failed to load top products.');
          }
          return response.json();
        })
        .then((items) => {
          setTopSellerProducts(Array.isArray(items) ? items : []);
          setHasLoadedTopSellers(true);
        })
        .catch((error) => {
          setTopSellerFeedback({ type: 'error', message: error.message });
          setTopSellerProducts([]);
          setHasLoadedTopSellers(false);
        })
        .finally(() => {
          setIsLoadingTopSellers(false);
          topSellerFetchInFlight.current = false;
        });
    },
    [hasLoadedTopSellers, user]
  );

  const fetchSellerProducts = useCallback(
    (force = false) => {
      if (!isSeller || !user?.id) {
        return;
      }

      if (!force && hasLoadedSellerProducts) {
        return;
      }

      if (sellerProductsFetchInFlight.current) {
        return;
      }

      sellerProductsFetchInFlight.current = true;
      setIsLoadingSellerProducts(true);
      setSellerProductsFeedback(null);

      fetch(`/api/sellers/${user.id}/products`)
        .then(async (response) => {
          if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload?.message || 'Failed to load products.');
          }
          return response.json();
        })
        .then((items) => {
          const list = Array.isArray(items) ? items : [];
          setSellerProducts(list);
          setSellerProductEdits((prev) => {
            if (!force && prev && Object.keys(prev).length > 0) {
              const next = { ...prev };
              list.forEach((product) => {
                if (!next[product.id]) {
                  next[product.id] = buildProductDraft(product);
                }
              });
              Object.keys(next).forEach((key) => {
                if (!list.some((product) => String(product.id) === key)) {
                  cleanupDraftPreview(next[key]);
                  delete next[key];
                }
              });
              return next;
            }

            Object.values(prev || {}).forEach((draft) => cleanupDraftPreview(draft));
            const mapping = {};
            list.forEach((product) => {
              mapping[product.id] = buildProductDraft(product);
            });
            return mapping;
          });
          setHasLoadedSellerProducts(true);
        })
        .catch((error) => {
          setSellerProductsFeedback({ type: 'error', message: error.message });
          setHasLoadedSellerProducts(false);
        })
        .finally(() => {
          setIsLoadingSellerProducts(false);
          sellerProductsFetchInFlight.current = false;
        });
    },
    [cleanupDraftPreview, hasLoadedSellerProducts, isSeller, user?.id]
  );

  useEffect(() => {
    if (!isSeller && isAddProductVisible) {
      setIsAddProductVisible(false);
      return;
    }

    if (isAddProductVisible) {
      setCurrentView(VIEW.HOME);
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
    cleanupDraftPreview(newProductValues);
    Object.values(sellerProductEdits || {}).forEach((draft) => cleanupDraftPreview(draft));
    setUser(null);
    setProducts([]);
    setProductError(null);
    setSearchText('');
    setSelectedProduct(null);
    setDetailError(null);
    setDetailState({ size: '', amount: 1, isDescriptionOpen: true });
    setNewProductValues({ ...EMPTY_PRODUCT_FORM });
    setIsCreatingProduct(false);
    setProductFormFeedback(null);
    setIsAddProductVisible(false);
    setCurrentView(VIEW.HOME);
    setCartItems([]);
    setOrders([]);
    setIsLoadingOrders(false);
    setOrdersFeedback(null);
    setSellerProducts([]);
    setIsLoadingSellerProducts(false);
    setSellerProductsFeedback(null);
    setSellerProductEdits({});
    setSellerProductSaving({});
    setHasLoadedSellerProducts(false);
    sellerProductsFetchInFlight.current = false;
    setOrderUpdateStates({});
    setHasLoadedOrders(false);
    ordersFetchInFlight.current = false;
    setDetailNotice(null);
    setTopSellerProducts([]);
    setIsLoadingTopSellers(false);
    setTopSellerFeedback(null);
    setHasLoadedTopSellers(false);
    topSellerFetchInFlight.current = false;
    resetCheckoutFlow();
    setFormValues({ username: '', password: '', role: 'customer' });
    setAuthMode(AUTH_MODE.LOGIN);
  };

  const openProductDetail = (productId) => {
    setSelectedProduct(null);
    setDetailError(null);
    setDetailNotice(null);
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
    setDetailNotice(null);
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

  useEffect(() => {
    if (!user?.id || (!isSeller && !isCustomer)) {
      return;
    }

    if (currentView !== VIEW.ORDERS) {
      return;
    }

    fetchOrders();
  }, [currentView, fetchOrders, isCustomer, isSeller, user?.id]);

  useEffect(() => {
    if (!user) {
      return;
    }

    if (currentView !== VIEW.HOME || isAddProductVisible) {
      return;
    }

    fetchTopSellerProducts();
  }, [currentView, fetchTopSellerProducts, isAddProductVisible, user]);

  useEffect(() => {
    if (!isSeller || !user?.id) {
      return;
    }

    if (currentView !== VIEW.MY_PRODUCTS) {
      return;
    }

    fetchSellerProducts();
  }, [currentView, fetchSellerProducts, isSeller, user?.id]);

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

  const cartCount = useMemo(
    () => cartItems.reduce((total, item) => total + (item.quantity || 0), 0),
    [cartItems]
  );

  const cartTotal = useMemo(
    () =>
      cartItems.reduce((total, item) => total + (item.price || 0) * (item.quantity || 0), 0),
    [cartItems]
  );

  const checkoutItems = useMemo(() => {
    if (checkoutPayload?.items && checkoutPayload.items.length > 0) {
      return checkoutPayload.items;
    }
    return [];
  }, [checkoutPayload]);

  const checkoutTotal = useMemo(
    () =>
      checkoutItems.reduce(
        (total, item) => total + (item.price || 0) * (item.quantity || 0),
        0
      ),
    [checkoutItems]
  );

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

  const handleNavHome = () => {
    resetCheckoutFlow();
    setIsAddProductVisible(false);
    setCurrentView(VIEW.HOME);
    closeProductDetail();
  };

  const handleNavCart = () => {
    resetCheckoutFlow();
    setIsAddProductVisible(false);
    setCurrentView(VIEW.CART);
    closeProductDetail();
  };

  const handleNavMyProducts = () => {
    resetCheckoutFlow();
    setIsAddProductVisible(false);
    setCurrentView(VIEW.MY_PRODUCTS);
    closeProductDetail();
    setSellerProductsFeedback(null);
  };
  const handleNavOrders = () => {
    resetCheckoutFlow();
    setIsAddProductVisible(false);
    setCurrentView(VIEW.ORDERS);
    closeProductDetail();
  };

  const handleToggleAddProduct = () => {
    closeProductDetail();
    setProductFormFeedback(null);
    resetCheckoutFlow();
    setIsAddProductVisible((prev) => {
      const next = !prev;
      if (next) {
        setCurrentView(VIEW.HOME);
      } else {
        setCurrentView(VIEW.MY_PRODUCTS);
        setSellerProductsFeedback(null);
        resetNewProductForm();
      }
      return next;
    });
  };

  const handleNewProductChange = (event) => {
    const { name, value } = event.target;
    setNewProductValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleNewProductImageChange = (event) => {
    const file = event.target.files && event.target.files[0] ? event.target.files[0] : null;
    setNewProductValues((prev) => {
      cleanupDraftPreview(prev);
      if (!file) {
        return { ...prev, imageFile: null, imagePreview: '' };
      }
      const previewUrl = URL.createObjectURL(file);
      return {
        ...prev,
        imageFile: file,
        imagePreview: previewUrl,
      };
    });
    if (event.target) {
      event.target.value = '';
    }
  };

  const resetNewProductForm = () => {
    setNewProductValues((prev) => {
      cleanupDraftPreview(prev);
      return { ...EMPTY_PRODUCT_FORM };
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
    const descriptionValue = newProductValues.description.trim();

    if (!newProductValues.imageFile) {
      setProductFormFeedback({ type: 'error', message: 'Please select a product image.' });
      return;
    }

    setIsCreatingProduct(true);
    setProductFormFeedback(null);

    try {
      const formData = new FormData();
      formData.append('sellerId', user.id);
      formData.append('name', nameValue);
      formData.append('price', priceValue);
      formData.append('stock', stockValue);
      if (uniqueSizes.length > 0) {
        formData.append('sizeOptions', uniqueSizes.join(','));
      }
      formData.append('image', newProductValues.imageFile);
      if (descriptionValue) {
        formData.append('description', descriptionValue);
      }

      const response = await fetch('/api/products', {
        method: 'POST',
        body: formData,
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to create product.');
      }

      if (payload?.product) {
        setProducts((prev) => [payload.product, ...(Array.isArray(prev) ? prev : [])]);

        if (isSeller && user?.id === payload.product.sellerId) {
          setSellerProducts((prev) => {
            const list = Array.isArray(prev) ? prev : [];
            const filtered = list.filter((item) => item.id !== payload.product.id);
            return [payload.product, ...filtered];
          });
          setSellerProductEdits((prev) => {
            const next = { ...prev };
            if (next[payload.product.id]) {
              cleanupDraftPreview(next[payload.product.id]);
            }
            next[payload.product.id] = buildProductDraft(payload.product);
            return next;
          });
        }
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

  const handleAddToCart = () => {
    if (!selectedProduct) {
      return;
    }

    setDetailNotice(null);

    if (!detailMetadata.canPurchase) {
      setDetailError('This product is out of stock.');
      return;
    }

    const sizeValue =
      detailMetadata.sizeOptions.length > 0
        ? detailState.size || detailMetadata.sizeOptions[0] || ''
        : '';

    if (detailMetadata.sizeOptions.length > 0 && !sizeValue) {
      setDetailError('Please select a size.');
      return;
    }

    const key = buildCartKey(selectedProduct.id, sizeValue);
    const existingItem = cartItems.find((item) => item.key === key);
    const requestedQuantity = (existingItem?.quantity || 0) + detailState.amount;

    if (requestedQuantity > detailMetadata.stockCount) {
      setDetailError('Not enough stock available for that quantity.');
      return;
    }

    const baseItem = {
      key,
      productId: selectedProduct.id,
      name: selectedProduct.name,
      price: selectedProduct.price,
      quantity: detailState.amount,
      size: sizeValue || null,
      imageUrl: selectedProduct.imageUrl || PLACEHOLDER_IMAGE,
      stock: detailMetadata.stockCount,
    };

    setCartItems((prev) => {
      const index = prev.findIndex((item) => item.key === key);
      if (index === -1) {
        return [...prev, baseItem];
      }

      return prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, quantity: item.quantity + detailState.amount } : item
      );
    });

    setDetailError(null);
    setDetailNotice({
      type: 'success',
      message: 'Product added to cart.',
    });
    setDetailState((prev) => ({ ...prev, amount: 1 }));
  };

  const handleBuyNow = () => {
    if (!selectedProduct) {
      return;
    }

    setDetailNotice(null);

    if (!detailMetadata.canPurchase) {
      setDetailError('This product is out of stock.');
      return;
    }

    const sizeValue =
      detailMetadata.sizeOptions.length > 0
        ? detailState.size || detailMetadata.sizeOptions[0] || ''
        : '';

    if (detailMetadata.sizeOptions.length > 0 && !sizeValue) {
      setDetailError('Please select a size.');
      return;
    }

    const item = {
      key: buildCartKey(selectedProduct.id, sizeValue),
      productId: selectedProduct.id,
      name: selectedProduct.name,
      price: selectedProduct.price,
      quantity: detailState.amount,
      size: sizeValue || null,
      imageUrl: selectedProduct.imageUrl || PLACEHOLDER_IMAGE,
      stock: detailMetadata.stockCount,
    };

    setDetailError(null);
    setCheckoutPayload({ items: [item] });
    setCheckoutStatus(null);
    setCheckoutForm({ ...DEFAULT_CHECKOUT_FORM });
    setIsAddProductVisible(false);
    setCurrentView(VIEW.CHECKOUT);
    closeProductDetail();
  };

  const handleProceedToCheckout = () => {
    if (cartItems.length === 0) {
      return;
    }

    const payload = cartItems.map((item) => ({ ...item }));
    setCheckoutPayload({ items: payload });
    setCheckoutStatus(null);
    setIsPlacingOrder(false);
    setCheckoutForm({ ...DEFAULT_CHECKOUT_FORM });
    setIsAddProductVisible(false);
    setCurrentView(VIEW.CHECKOUT);
    closeProductDetail();
  };

  const handleAdjustCartQuantity = (key, delta) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.key !== key) {
            return item;
          }

          const maxStock = item.stock > 0 ? item.stock : item.quantity;
          const nextQuantity = Math.min(
            Math.max(item.quantity + delta, 0),
            maxStock > 0 ? maxStock : item.quantity + Math.max(delta, 0)
          );

          return { ...item, quantity: nextQuantity };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const handleRemoveCartItem = (key) => {
    setCartItems((prev) => prev.filter((item) => item.key !== key));
  };

  const handleCheckoutFormChange = (event) => {
    const { name, value } = event.target;
    setCheckoutForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckoutSubmit = async (event) => {
    event.preventDefault();

    if (isPlacingOrder) {
      return;
    }

    if (!checkoutItems.length) {
      setCheckoutStatus({ type: 'error', message: 'Your cart is empty.' });
      return;
    }

    const fullNameValue = checkoutForm.fullName.trim();
    const addressValue = checkoutForm.address.trim();
    const phoneValue = checkoutForm.phone.trim();

    if (!fullNameValue || !addressValue || !phoneValue) {
      setCheckoutStatus({
        type: 'error',
        message: 'Please fill in your name, phone number, and address.',
      });
      return;
    }

    setIsPlacingOrder(true);
    setCheckoutStatus({ type: 'info', message: 'Processing payment...' });

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: checkoutItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
          customer: {
            fullName: fullNameValue,
            address: addressValue,
            phone: phoneValue,
            paymentMethod: checkoutForm.paymentMethod,
            userId: isCustomer ? user?.id ?? null : null,
          },
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to complete checkout.');
      }

      const updatedProducts = Array.isArray(payload?.products) ? payload.products : [];
      const createdOrders = Array.isArray(payload?.orders) ? payload.orders : [];

      setCheckoutStatus({
        type: 'success',
        message: payload?.message || 'Payment completed successfully!',
      });

      setCartItems([]);
      setCheckoutPayload({ items: [] });
      setCheckoutForm({ ...DEFAULT_CHECKOUT_FORM });

      setProducts((prev) => {
        if (!Array.isArray(prev) || updatedProducts.length === 0) {
          return prev;
        }
        const updates = new Map(updatedProducts.map((product) => [product.id, product]));
        return prev.map((product) =>
          updates.has(product.id) ? { ...product, ...updates.get(product.id) } : product
        );
      });

      if (createdOrders.length > 0) {
        setOrders((prev) => {
          const existing = Array.isArray(prev) ? prev : [];
          const existingIds = new Set(existing.map((order) => order.id));
          const merged = [
            ...createdOrders.filter((order) => !existingIds.has(order.id)),
            ...existing,
          ];
          return merged;
        });
      }

      setHasLoadedOrders(false);
      if (isCustomer) {
        fetchOrders(true);
      }

      setSelectedProduct((current) => {
        if (!current) {
          return current;
        }
        const updated = updatedProducts.find((product) => product.id === current.id);
        return updated ? { ...current, ...updated } : current;
      });

      setTimeout(() => {
        resetCheckoutFlow();
        setCurrentView(VIEW.HOME);
      }, 1500);
    } catch (error) {
      setCheckoutStatus({ type: 'error', message: error.message });
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId, currentStatus) => {
    if (!isSeller) {
      return;
    }

    const config = ORDER_STATUS_ACTIONS[currentStatus];
    if (!config || !orderId) {
      return;
    }

    setOrderUpdateStates((prev) => ({ ...prev, [orderId]: true }));
    setOrdersFeedback(null);

    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: config.next }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to update order status.');
      }

      if (payload?.order) {
        setOrders((prev) =>
          Array.isArray(prev)
            ? prev.map((order) => (order.id === payload.order.id ? payload.order : order))
            : []
        );
        setOrdersFeedback({ type: 'success', message: 'Order status updated.' });
      }
    } catch (error) {
      setOrdersFeedback({ type: 'error', message: error.message });
    } finally {
      setOrderUpdateStates((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
    }
  };

  const handleConfirmOrderReceived = async (orderId) => {
    if (!isCustomer || !user?.id) {
      return;
    }

    setOrderUpdateStates((prev) => ({ ...prev, [orderId]: true }));
    setOrdersFeedback(null);

    try {
      const response = await fetch(`/api/orders/${orderId}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: user.id }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to confirm delivery.');
      }

      if (payload?.order) {
        setOrders((prev) =>
          Array.isArray(prev)
            ? prev.map((order) => (order.id === payload.order.id ? payload.order : order))
            : []
        );
        setOrdersFeedback({
          type: 'success',
          message: 'Thank you! The seller has been notified that you received the order.',
        });
      }
    } catch (error) {
      setOrdersFeedback({ type: 'error', message: error.message });
    } finally {
      setOrderUpdateStates((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
    }
  };
  const handleSellerProductChange = (productId, field, value) => {
    setSellerProductsFeedback(null);
    setSellerProductEdits((prev) => {
      const next = { ...prev };
      const existingDraft =
        next[productId] ?? buildProductDraft(sellerProducts.find((item) => item.id === productId));
      next[productId] = {
        ...existingDraft,
        [field]: value,
      };
      return next;
    });
  };

  const handleSellerProductImageChange = (productId, file) => {
    setSellerProductsFeedback(null);
    setSellerProductEdits((prev) => {
      const next = { ...prev };
      const product = sellerProducts.find((item) => item.id === productId);
      const currentDraft = next[productId] ?? buildProductDraft(product);
      cleanupDraftPreview(currentDraft);
      if (!file) {
        next[productId] = {
          ...currentDraft,
          imageFile: null,
          imagePreview: product?.imageUrl ?? '',
        };
        return next;
      }
      const previewUrl = URL.createObjectURL(file);
      next[productId] = {
        ...currentDraft,
        imageFile: file,
        imagePreview: previewUrl,
      };
      return next;
    });
  };

  const handleResetSellerProduct = (productId) => {
    const product = sellerProducts.find((item) => item.id === productId);
    if (!product) {
      return;
    }
    setSellerProductsFeedback(null);
    setSellerProductEdits((prev) => {
      const next = { ...prev };
      if (next[productId]) {
        cleanupDraftPreview(next[productId]);
      }
      next[productId] = buildProductDraft(product);
      return next;
    });
  };

  const handleSaveSellerProduct = async (productId) => {
    if (!isSeller || !user?.id) {
      return;
    }

    const product = sellerProducts.find((item) => item.id === productId);
    const draft = sellerProductEdits[productId] ?? buildProductDraft(product);

    if (!product) {
      setSellerProductsFeedback({ type: 'error', message: 'Product not found.' });
      return;
    }

    const trimmedName = draft.name?.trim() || '';
    if (!trimmedName) {
      setSellerProductsFeedback({ type: 'error', message: 'Product name is required.' });
      return;
    }

    const parsedPrice = Number.parseFloat(draft.price);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setSellerProductsFeedback({ type: 'error', message: 'Enter a price greater than zero.' });
      return;
    }

    const parsedStock = Number.parseInt(draft.stock, 10);
    if (!Number.isInteger(parsedStock) || parsedStock < 0) {
      setSellerProductsFeedback({ type: 'error', message: 'Stock must be zero or a positive number.' });
      return;
    }

    const sizeList = (draft.sizeOptions || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const uniqueSizes = [...new Set(sizeList)];
    const descriptionValue = draft.description?.trim() || '';

    setSellerProductsFeedback(null);
    setSellerProductSaving((prev) => ({ ...prev, [productId]: true }));

    try {
      const formData = new FormData();
      formData.append('sellerId', user.id);
      formData.append('name', trimmedName);
      formData.append('price', parsedPrice);
      formData.append('stock', parsedStock);
      formData.append('sizeOptions', uniqueSizes.join(','));
      formData.append('description', descriptionValue);
      if (draft.imageFile) {
        formData.append('image', draft.imageFile);
      }

      const response = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        body: formData,
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to update product.');
      }

      if (payload?.product) {
        setSellerProducts((prev) => {
          const list = Array.isArray(prev) ? prev : [];
          return list.map((item) => (item.id === payload.product.id ? payload.product : item));
        });

        setProducts((prev) => {
          if (!Array.isArray(prev)) {
            return prev;
          }
          let updated = false;
          const next = prev.map((item) => {
            if (item.id === payload.product.id) {
              updated = true;
              return payload.product;
            }
            return item;
          });
          return updated ? next : next.concat(payload.product);
        });

        setSellerProductEdits((prev) => {
          const next = { ...prev };
          if (next[productId]) {
            cleanupDraftPreview(next[productId]);
          }
          next[productId] = buildProductDraft(payload.product);
          return next;
        });

        setSellerProductsFeedback({ type: 'success', message: 'Product updated successfully.' });
      }
    } catch (error) {
      setSellerProductsFeedback({ type: 'error', message: error.message });
    } finally {
      setSellerProductSaving((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
    }
  };

  const handleContinueShopping = () => {
    resetCheckoutFlow();
    setCurrentView(VIEW.HOME);
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
          <button
            type="button"
            onClick={handleNavHome}
            className={isHomeView && !isAddProductVisible ? 'active' : ''}
          >
            Home
          </button>
          <button
            type="button"
            onClick={handleNavCart}
            className={isCartView ? 'active' : ''}
          >
            {cartCount > 0 ? `Cart (${cartCount})` : 'Cart'}
          </button>
          {isSeller ? (
            <>
              <button
                type="button"
                onClick={handleNavOrders}
                className={isOrdersView ? 'active' : ''}
              >
                Orders
              </button>
              <button
                type="button"
                onClick={handleNavMyProducts}
                className={isMyProductsView ? 'active' : ''}
              >
                My products
              </button>
              <button
                type="button"
                onClick={handleToggleAddProduct}
                className={isAddProductVisible ? 'active' : ''}
              >
                {isAddProductVisible ? 'View products' : 'Add product'}
              </button>
            </>
          ) : isCustomer ? (
            <button
              type="button"
              onClick={handleNavOrders}
              className={isOrdersView ? 'active' : ''}
            >
              Orders
            </button>
          ) : null}
          <a href="#about">About</a>
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
              <label className="seller-image-field">
                <span>Product image</span>
                <div className="seller-image-upload">
                  <div className="seller-image-preview">
                    <img
                      src={newProductValues.imagePreview || PLACEHOLDER_IMAGE}
                      alt="Selected product preview"
                    />
                  </div>
                  <div className="seller-image-actions">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleNewProductImageChange}
                      disabled={isCreatingProduct}
                      required
                    />
                    {newProductValues.imageFile ? (
                      <p className="seller-image-name">{newProductValues.imageFile.name}</p>
                    ) : (
                      <p className="seller-image-name hint">Choose an image to upload</p>
                    )}
                  </div>
                </div>
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

        {isSeller && isMyProductsView ? (
          <section className="my-products-panel">
            <header className="my-products-header">
              <h2>My products</h2>
              <div className="my-products-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => fetchSellerProducts(true)}
                  disabled={isLoadingSellerProducts}
                >
                  {isLoadingSellerProducts ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
            </header>
            {sellerProductsFeedback ? (
              <p className={`orders-feedback ${sellerProductsFeedback.type}`}>
                {sellerProductsFeedback.message}
              </p>
            ) : null}
            {isLoadingSellerProducts ? (
              <p className="orders-status">Loading products...</p>
            ) : sellerProducts.length === 0 ? (
              <p className="orders-status">You have not added any products yet.</p>
            ) : (
              <ul className="my-products-list">
                {sellerProducts.map((product) => {
                  const draft = sellerProductEdits[product.id] || buildProductDraft(product);
                  const isSaving = Boolean(sellerProductSaving[product.id]);

                  return (
                    <li key={product.id} className="my-product-card">
                      <div className="my-product-header">
                        <h3>{product.name}</h3>
                        <p className="my-product-id">ID: {product.id}</p>
                      </div>
                      <div className="my-product-grid">
                        <label>
                          <span>Name</span>
                          <input
                            type="text"
                            value={draft.name}
                            onChange={(event) =>
                              handleSellerProductChange(product.id, 'name', event.target.value)
                            }
                            disabled={isSaving}
                          />
                        </label>
                        <label>
                          <span>Price</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={draft.price}
                            onChange={(event) =>
                              handleSellerProductChange(product.id, 'price', event.target.value)
                            }
                            disabled={isSaving}
                          />
                        </label>
                        <label>
                          <span>Stock</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={draft.stock}
                            onChange={(event) =>
                              handleSellerProductChange(product.id, 'stock', event.target.value)
                            }
                            disabled={isSaving}
                          />
                        </label>
                        <label className="my-product-full">
                          <span>Sizes (comma separated)</span>
                          <input
                            type="text"
                            value={draft.sizeOptions}
                            onChange={(event) =>
                              handleSellerProductChange(
                                product.id,
                                'sizeOptions',
                                event.target.value
                              )
                            }
                            disabled={isSaving}
                          />
                        </label>
                        <div className="my-product-full seller-image-field">
                          <span>Product image</span>
                          <div className="seller-image-upload">
                            <div className="seller-image-preview">
                              <img
                                src={draft.imagePreview || product.imageUrl || PLACEHOLDER_IMAGE}
                                alt={`${product.name} preview`}
                              />
                            </div>
                            <div className="seller-image-actions">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(event) => {
                                  const file =
                                    event.target.files && event.target.files[0]
                                      ? event.target.files[0]
                                      : null;
                                  handleSellerProductImageChange(product.id, file);
                                  event.target.value = '';
                                }}
                                disabled={isSaving}
                              />
                              {draft.imageFile ? (
                                <>
                                  <p className="seller-image-name">{draft.imageFile.name}</p>
                                  <button
                                    type="button"
                                    className="seller-image-clear"
                                    onClick={() => handleSellerProductImageChange(product.id, null)}
                                    disabled={isSaving}
                                  >
                                    Remove selected image
                                  </button>
                                </>
                              ) : (
                                <p className="seller-image-name hint">Current image will be kept</p>
                              )}
                            </div>
                          </div>
                        </div>
                        <label className="my-product-full">
                          <span>Description</span>
                          <textarea
                            rows={3}
                            value={draft.description}
                            onChange={(event) =>
                              handleSellerProductChange(
                                product.id,
                                'description',
                                event.target.value
                              )
                            }
                            disabled={isSaving}
                          />
                        </label>
                      </div>
                      <div className="my-product-actions">
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => handleResetSellerProduct(product.id)}
                          disabled={isSaving}
                        >
                          Reset
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveSellerProduct(product.id)}
                          disabled={isSaving}
                        >
                          {isSaving ? 'Saving...' : 'Save changes'}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ) : null}

        {isOrdersView ? (
          <section className="orders-panel">
            {(() => {
              const canManageOrders = isSeller;
              const ordersTitle = canManageOrders ? 'Orders' : 'My orders';
              const ordersEmptyLabel = canManageOrders
                ? 'No orders yet.'
                : 'You have not placed any orders yet.';
              const ordersLoadingLabel = canManageOrders
                ? 'Loading orders...'
                : 'Loading your orders...';

              return (
                <>
                  <header className="orders-header">
                    <h2>{ordersTitle}</h2>
                    <div className="orders-actions">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => fetchOrders(true)}
                        disabled={isLoadingOrders}
                      >
                        {isLoadingOrders ? 'Refreshing...' : 'Refresh'}
                      </button>
                    </div>
                  </header>
                  {ordersFeedback ? (
                    <p className={`orders-feedback ${ordersFeedback.type}`}>
                      {ordersFeedback.message}
                    </p>
                  ) : null}
                  {isLoadingOrders ? (
                    <p className="orders-status">{ordersLoadingLabel}</p>
                  ) : orders.length === 0 ? (
                    <p className="orders-status">{ordersEmptyLabel}</p>
                  ) : (
                    <ul className="orders-list">
                      {orders.map((order) => {
                        const action = canManageOrders ? ORDER_STATUS_ACTIONS[order.status] : null;
                        const canAcknowledge =
                          !canManageOrders && order.status === ORDER_STATUS.SHIPPED;
                        const isUpdating = Boolean(orderUpdateStates[order.id]);
                        const productImage = order.product?.imageUrl || PLACEHOLDER_IMAGE;
                        const productName = order.product?.name || 'Product unavailable';
                        const statusLabel = ORDER_STATUS_LABELS[order.status] || order.status;
                        const createdAtLabel = formatDateTime(order.createdAt);
                        const updatedAtLabel = formatDateTime(order.updatedAt);
                        const productPrice = Number.isFinite(order.product?.price)
                          ? order.product.price
                          : Number.parseFloat(order.product?.price ?? 0) || 0;
                        const orderTotal = productPrice * (order.quantity || 0);

                        return (
                          <li key={order.id} className="order-card">
                            <div className="order-product">
                              <img src={productImage} alt={productName} />
                              <div>
                                <h3>{productName}</h3>
                                <p className="order-price">{formatCurrency(productPrice)}</p>
                                <p>
                                  <strong>Order #:</strong> {order.id}
                                </p>
                              </div>
                            </div>
                            <div className="order-details">
                              {!canManageOrders ? (
                                <p>
                                  <strong>Seller ID:</strong> {order.sellerId ?? 'N/A'}
                                </p>
                              ) : null}
                              <p>
                                <strong>Quantity:</strong> {order.quantity}
                              </p>
                              <p>
                                <strong>Total:</strong> {formatCurrency(orderTotal)}
                              </p>
                              <p>
                                <strong>Status:</strong>{' '}
                                <span className={`order-status order-status--${order.status}`}>
                                  {statusLabel}
                                </span>
                              </p>
                              {canManageOrders && order.buyerName ? (
                                <p>
                                  <strong>Buyer:</strong> {order.buyerName}
                                </p>
                              ) : null}
                              {order.buyerPhone ? (
                                <p>
                                  <strong>{canManageOrders ? 'Phone:' : 'Contact phone:'}</strong>{' '}
                                  {order.buyerPhone}
                                </p>
                              ) : null}
                              {canManageOrders && order.shippingAddress ? (
                                <p>
                                  <strong>Address:</strong> {order.shippingAddress}
                                </p>
                              ) : !canManageOrders && order.shippingAddress ? (
                                <p>
                                  <strong>Shipping to:</strong> {order.shippingAddress}
                                </p>
                              ) : null}
                              <p>
                                <strong>Ordered:</strong> {createdAtLabel || 'Unknown'}
                              </p>
                              {updatedAtLabel ? (
                                <p>
                                  <strong>Updated:</strong> {updatedAtLabel}
                                </p>
                              ) : null}
                            </div>
                            <div className="order-actions">
                              {action ? (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateOrderStatus(order.id, order.status)}
                                  disabled={isUpdating}
                                >
                                  {isUpdating ? 'Updating...' : action.label}
                                </button>
                              ) : canAcknowledge ? (
                                <button
                                  type="button"
                                  className="order-receive"
                                  onClick={() => handleConfirmOrderReceived(order.id)}
                                  disabled={isUpdating}
                                >
                                  {isUpdating ? 'Sending...' : 'Mark as received'}
                                </button>
                              ) : (
                                <span className="order-status-final">{statusLabel}</span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              );
            })()}
          </section>
        ) : null}

        {isCartView ? (
          <section className="cart-panel">
            <header className="cart-header">
              <h2>Your cart</h2>
              {hasCartItems ? (
                <span>{cartCount} item{cartCount === 1 ? '' : 's'}</span>
              ) : null}
            </header>
            {hasCartItems ? (
              <>
                <ul className="cart-items">
                  {cartItems.map((item) => {
                    const itemTotal = (item.price || 0) * (item.quantity || 0);
                    const canIncrease =
                      item.stock > 0 ? item.quantity < item.stock : true;

                    return (
                      <li key={item.key} className="cart-item">
                        <div className="cart-item-media">
                          <img src={item.imageUrl || PLACEHOLDER_IMAGE} alt={item.name} />
                        </div>
                        <div className="cart-item-info">
                          <h3>{item.name}</h3>
                          <p className="cart-item-price">{formatCurrency(item.price)}</p>
                          {item.size ? (
                            <p className="cart-item-meta">Size: {item.size}</p>
                          ) : null}
                          {item.stock > 0 ? (
                            <p className="cart-item-meta">In stock: {item.stock}</p>
                          ) : null}
                          <div className="cart-item-quantity">
                            <span>Quantity</span>
                            <div className="cart-quantity-controls">
                              <button
                                type="button"
                                onClick={() => handleAdjustCartQuantity(item.key, -1)}
                                aria-label="Decrease quantity"
                              >
                                −
                              </button>
                              <span>{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => handleAdjustCartQuantity(item.key, 1)}
                                aria-label="Increase quantity"
                                disabled={!canIncrease}
                              >
                                +
                              </button>
                            </div>
                          </div>
                          <p className="cart-item-subtotal">
                            Subtotal: <strong>{formatCurrency(itemTotal)}</strong>
                          </p>
                          <div className="cart-item-actions">
                            <button type="button" onClick={() => handleRemoveCartItem(item.key)}>
                              Remove
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <footer className="cart-summary">
                  <div className="cart-total">
                    <span>Total</span>
                    <strong>{formatCurrency(cartTotal)}</strong>
                  </div>
                  <div className="cart-summary-actions">
                    <button type="button" className="secondary" onClick={handleNavHome}>
                      Continue shopping
                    </button>
                    <button type="button" onClick={handleProceedToCheckout}>
                      Proceed to checkout
                    </button>
                  </div>
                </footer>
              </>
            ) : (
              <div className="cart-empty">
                <p>Your cart is empty. Start by exploring products on the home page.</p>
                <button type="button" onClick={handleNavHome}>
                  Browse products
                </button>
              </div>
            )}
          </section>
        ) : null}

        {isCheckoutView ? (
          <section className="checkout-panel">
            <h2>Checkout</h2>
            {checkoutItems.length === 0 ? (
              <div className="checkout-empty">
                <p>No items selected yet. Add products to your cart before checking out.</p>
                <button type="button" onClick={handleNavHome}>
                  Browse products
                </button>
              </div>
            ) : (
              <div className="checkout-content">
                <div className="checkout-summary">
                  <h3>Order summary</h3>
                  <ul>
                    {checkoutItems.map((item) => (
                      <li key={item.key}>
                        <div className="checkout-item-meta">
                          <span>{item.name}</span>
                          {item.size ? <span className="checkout-item-size">Size: {item.size}</span> : null}
                        </div>
                        <div className="checkout-item-totals">
                          <span>x{item.quantity}</span>
                          <strong>{formatCurrency((item.price || 0) * (item.quantity || 0))}</strong>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="checkout-total">
                    <span>Total due</span>
                    <strong>{formatCurrency(checkoutTotal)}</strong>
                  </div>
                </div>
                <form className="checkout-form" onSubmit={handleCheckoutSubmit}>
                  <h3>Payment details</h3>
                  <label>
                    <span>Full name</span>
                    <input
                      type="text"
                      name="fullName"
                      value={checkoutForm.fullName}
                      onChange={handleCheckoutFormChange}
                      required
                    />
                  </label>
                  <label>
                    <span>Shipping address</span>
                    <textarea
                      name="address"
                      rows={3}
                      value={checkoutForm.address}
                      onChange={handleCheckoutFormChange}
                      required
                    />
                  </label>
                  <label>
                    <span>Contact phone</span>
                    <input
                      type="tel"
                      name="phone"
                      inputMode="tel"
                      placeholder="e.g. 089-123-4567"
                      value={checkoutForm.phone}
                      onChange={handleCheckoutFormChange}
                      required
                    />
                  </label>
                  <label>
                    <span>Payment method</span>
                    <select
                      name="paymentMethod"
                      value={checkoutForm.paymentMethod}
                      onChange={handleCheckoutFormChange}
                    >
                      <option value="card">Credit / Debit card</option>
                      <option value="cod">Cash on delivery</option>
                      <option value="bank">Bank transfer</option>
                    </select>
                  </label>
                  {checkoutStatus ? (
                    <p className={`checkout-feedback ${checkoutStatus.type}`}>
                      {checkoutStatus.message}
                    </p>
                  ) : null}
                  <div className="checkout-actions">
                    <button type="button" className="secondary" onClick={handleContinueShopping}>
                      Continue shopping
                    </button>
                    <button type="submit" disabled={isPlacingOrder}>
                      {isPlacingOrder ? 'Processing...' : 'Pay now'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </section>
        ) : null}

        {isHomeView && !isAddProductVisible ? (
          <>
            <section className="top-seller-section" aria-labelledby="top-seller-heading">
              <header className="top-seller-header">
                <div>
                  <h2 id="top-seller-heading">Top Seller Product</h2>
                  <p className="top-seller-subtitle">Top 5 products ranked by total items sold.</p>
                </div>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => fetchTopSellerProducts(true)}
                  disabled={isLoadingTopSellers}
                >
                  {isLoadingTopSellers ? 'Refreshing...' : 'Refresh'}
                </button>
              </header>
              {topSellerFeedback ? (
                <p className={`top-seller-feedback ${topSellerFeedback.type}`}>
                  {topSellerFeedback.message}
                </p>
              ) : null}
              {isLoadingTopSellers ? (
                <p className="top-seller-status">Loading top sellers...</p>
              ) : topSellerProducts.length === 0 ? (
                <p className="top-seller-status">
                  No sales yet. Completed orders will appear here.
                </p>
              ) : (
                <ol className="top-seller-list">
                  {topSellerProducts.map((product, index) => {
                    const totalSold = Number.isFinite(product.totalSold)
                      ? product.totalSold
                      : Number.parseInt(product.totalSold ?? 0, 10) || 0;
                    const imageSrc = product.imageUrl || PLACEHOLDER_IMAGE;

                    return (
                      <li key={product.id}>
                        <button
                          type="button"
                          className="top-seller-card"
                          onClick={() => openProductDetail(product.id)}
                        >
                          <span className="top-seller-rank">{index + 1}</span>
                          <img src={imageSrc} alt="" aria-hidden="true" loading="lazy" />
                          <div className="top-seller-info">
                            <h3>{product.name}</h3>
                            <p className="top-seller-price">{formatCurrency(product.price)}</p>
                            <p className="top-seller-meta">
                              Sold {totalSold} {totalSold === 1 ? 'item' : 'items'}
                            </p>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
            {isLoadingProducts ? (
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
                        <p className="product-price">{formatCurrency(product.price)}</p>
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
            )}
          </>
        ) : null}
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
                  <p className="detail-price">{formatCurrency(selectedProduct.price)}</p>

                  <p className={`detail-stock ${detailMetadata.canPurchase ? '' : 'out'}`}>
                    {detailMetadata.canPurchase
                      ? `In stock: ${detailMetadata.stockCount}`
                      : 'Out of stock'}
                  </p>

                  {detailNotice ? (
                    <p className={`detail-feedback ${detailNotice.type}`}>{detailNotice.message}</p>
                  ) : null}

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

                  <div className="detail-actions">
                    <button
                      type="button"
                      className="detail-add"
                      onClick={handleAddToCart}
                      disabled={!detailMetadata.canPurchase}
                    >
                      Add to cart
                    </button>
                    <button
                      type="button"
                      className="detail-buy"
                      onClick={handleBuyNow}
                      disabled={!detailMetadata.canPurchase}
                    >
                      {detailMetadata.canPurchase ? 'Buy now' : 'Out of stock'}
                    </button>
                  </div>

                  <div className="detail-description">
                    <button type="button" onClick={toggleDescription}>
                      Detail
                      <span aria-hidden="true">{detailState.isDescriptionOpen ? 'v' : '>'}</span>
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
