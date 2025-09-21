import { useMemo, useState } from 'react';
import './App.css';

const VIEWS = {
  LOGIN: 'login',
  REGISTER: 'register',
  CATALOG: 'catalog',
  PRODUCT: 'product',
  ARCHITECTURE: 'architecture',
};

const PRODUCTS = [
  {
    id: 'shirt',
    name: 'Shirt',
    price: 10,
    image: '/assets/shirt.svg',
    description:
      'เสื้อยืดคอกลมสีแดง เนื้อผ้าระบายอากาศได้ดี นุ่มสบาย และเหมาะกับการแต่งตัวทุกโอกาส',
    sizes: ['S', 'M', 'L', 'XL'],
  },
  {
    id: 'box',
    name: 'Box',
    price: 1,
    image: '/assets/box.svg',
    description:
      'กล่องไปรษณีย์เนื้อหนา ปลอดภัยสำหรับการจัดส่งสินค้าออนไลน์และใช้ซ้ำได้หลายครั้ง',
    sizes: ['S', 'M', 'L'],
  },
  {
    id: 'toys',
    name: 'Toys',
    price: 7,
    image: '/assets/toys.svg',
    description:
      'ชุดของเล่นรวมสัตว์และบล็อกสร้างสรรค์ เสริมจินตนาการสำหรับเด็กและผู้ใหญ่',
    sizes: ['Mini', 'Classic'],
  },
  {
    id: 'mama',
    name: 'Mama',
    price: 3,
    image: '/assets/snack.svg',
    description:
      'บะหมี่กึ่งสำเร็จรูปยอดนิยม รสชาติกลมกล่อมพร้อมซุปเข้มข้นรสเผ็ดกำลังดี',
    sizes: ['แพ็คเดี่ยว', 'แพ็ค 6'],
  },
  {
    id: 'book',
    name: 'Book',
    price: 12,
    image: '/assets/book.svg',
    description:
      'หนังสือคู่มือเทคโนโลยีฉบับล่าสุด รวมเคล็ดลับและตัวอย่างที่อ่านง่ายเหมาะกับทุกระดับ',
    sizes: ['ปกอ่อน', 'ปกแข็ง'],
  },
  {
    id: 'chocolate',
    name: 'Chocolate',
    price: 5,
    image: '/assets/chocolate.svg',
    description:
      'ช็อกโกแลตนมสูตรพรีเมียมรสละมุน ผลิตจากเมล็ดโกโก้คุณภาพดี พร้อมแพ็กเกจสีสันสดใส',
    sizes: ['1 แท่ง', 'กล่องใหญ่'],
  },
];

function App() {
  const [view, setView] = useState(VIEWS.LOGIN);
  const [selectedProduct, setSelectedProduct] = useState(PRODUCTS[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCartHint, setShowCartHint] = useState(false);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return PRODUCTS;
    }
    return PRODUCTS.filter((product) =>
      product.name.toLowerCase().includes(term)
    );
  }, [searchTerm]);

  const showHeader = view !== VIEWS.LOGIN && view !== VIEWS.REGISTER;

  const goToView = (nextView) => {
    if (nextView === VIEWS.LOGIN) {
      setSearchTerm('');
    }
    setView(nextView);
  };

  const handleLoginSuccess = () => {
    setView(VIEWS.CATALOG);
  };

  const handleRegister = () => {
    setView(VIEWS.CATALOG);
  };

  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
    setView(VIEWS.PRODUCT);
  };

  const handleCartClick = () => {
    setShowCartHint(true);
    setView(VIEWS.CATALOG);
  };

  return (
    <div className="app-wrapper">
      {showHeader && (
        <MainHeader
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onNavigateHome={() => goToView(VIEWS.CATALOG)}
          onNavigateArchitecture={() => goToView(VIEWS.ARCHITECTURE)}
          onCartClick={handleCartClick}
          onLogout={() => goToView(VIEWS.LOGIN)}
        />
      )}

      <main>
        {view === VIEWS.LOGIN && (
          <AuthPage
            variant="login"
            onSubmit={handleLoginSuccess}
            onSwitch={() => goToView(VIEWS.REGISTER)}
          />
        )}

        {view === VIEWS.REGISTER && (
          <AuthPage
            variant="register"
            onSubmit={handleRegister}
            onSwitch={() => goToView(VIEWS.LOGIN)}
          />
        )}

        {view === VIEWS.CATALOG && (
          <Catalog
            products={filteredProducts}
            onSelect={handleSelectProduct}
            showCartHint={showCartHint}
            onDismissCartHint={() => setShowCartHint(false)}
          />
        )}

        {view === VIEWS.PRODUCT && (
          <ProductDetail
            product={selectedProduct}
            onBack={() => goToView(VIEWS.CATALOG)}
          />
        )}

        {view === VIEWS.ARCHITECTURE && (
          <ArchitecturePlan
            onBackToShop={() => goToView(VIEWS.CATALOG)}
          />
        )}
      </main>
    </div>
  );
}

function MainHeader({
  searchTerm,
  onSearchChange,
  onNavigateHome,
  onNavigateArchitecture,
  onCartClick,
  onLogout,
}) {
  return (
    <header className="main-header">
      <span className="brand">Quick Shop</span>
      <div className="search">
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Hinted search text"
          aria-label="Search products"
        />
      </div>
      <nav>
        <button type="button" onClick={onNavigateHome}>
          Home
        </button>
        <button type="button" onClick={onCartClick}>
          Cart
        </button>
        <button type="button" onClick={onNavigateArchitecture}>
          About
        </button>
        <button type="button" onClick={onLogout}>
          Logout
        </button>
      </nav>
    </header>
  );
}

function AuthPage({ variant, onSubmit, onSwitch }) {
  const isLogin = variant === 'login';
  const buttonLabel = isLogin ? 'Login' : 'Register';
  const message = isLogin
    ? "Don't have ID?"
    : 'Already have an account?';
  const switchLabel = isLogin
    ? 'Click here to register'
    : 'Click here to login';

  return (
    <section className="auth-page">
      <div className="auth-card">
        <h1>Quick Shop</h1>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <input type="text" placeholder="Username" required />
          <input type="password" placeholder="Password" required />
          <button className="primary-button" type="submit">
            {buttonLabel}
          </button>
        </form>
        <p className="auth-switch">
          {message}
          <button type="button" onClick={onSwitch}>
            {switchLabel}
          </button>
        </p>
      </div>
    </section>
  );
}

function Catalog({ products, onSelect, showCartHint, onDismissCartHint }) {
  return (
    <section className="catalog-page">
      <div>
        <h2>Fresh arrivals</h2>
        <p>
          เลือกสินค้าใหม่ล่าสุดที่ทีม QUICK SHOP เลือกสรรมาให้คุณ และคลิกเพื่อดูรายละเอียดสินค้าแบบเต็ม
        </p>
      </div>

      {showCartHint && (
        <div className="cart-hint" role="status">
          <span>ตะกร้าของคุณยังว่างอยู่ — เลือกสินค้าเพื่อเริ่มช้อปได้เลย!</span>
          <button type="button" onClick={onDismissCartHint}>
            ปิด
          </button>
        </div>
      )}

      {products.length === 0 ? (
        <div className="catalog-empty">
          ไม่พบสินค้าที่ตรงกับคำค้นหา ลองใช้คำค้นหาอื่นหรือดูหมวดหมู่ทั้งหมด
        </div>
      ) : (
        <div className="catalog-grid">
          {products.map((product) => (
            <button
              type="button"
              key={product.id}
              className="product-card"
              onClick={() => onSelect(product)}
            >
              <img src={product.image} alt={product.name} />
              <div className="product-body">
                <span className="product-name">{product.name}</span>
                <span className="product-price">${product.price}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function ProductDetail({ product, onBack }) {
  return (
    <section className="product-detail">
      <div className="detail-media">
        <img src={product.image} alt={product.name} />
      </div>
      <div className="detail-info">
        <h2>{product.name}</h2>
        <p className="detail-price">${product.price}</p>
        <div className="detail-grid">
          <div className="form-row">
            <label htmlFor="size-select">Size</label>
            <select id="size-select" defaultValue={product.sizes[0]}>
              {product.sizes.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label htmlFor="amount-select">Amount</label>
            <select id="amount-select" defaultValue="1">
              {[1, 2, 3, 4, 5].map((amount) => (
                <option key={amount} value={amount}>
                  {amount}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button type="button" className="buy-button">
          Buy
        </button>
        <details className="detail-description">
          <summary>Detail</summary>
          <p>{product.description}</p>
        </details>
        <button type="button" className="back-link" onClick={onBack}>
          ← Back to catalog
        </button>
      </div>
    </section>
  );
}

function ArchitecturePlan({ onBackToShop }) {
  return (
    <section className="architecture-page">
      <h1>Cloud architecture plan</h1>
      <div className="architecture-diagram">
        <div className="arch-group">
          <h3>Client experience</h3>
          <ul className="arch-list">
            <li>Browser / Search / Product listing</li>
            <li>Mobile app and push notification</li>
            <li>Onboarding, profile และระบบแนะนำสินค้า</li>
          </ul>
        </div>
        <div className="arch-group">
          <h3>Edge &amp; networking</h3>
          <ul className="arch-list">
            <li>CloudFront CDN สำหรับ static asset</li>
            <li>Route53 จัดการ DNS และ SSL</li>
            <li>ELB กระจายโหลดไปยังบริการหลัก</li>
          </ul>
        </div>
        <div className="arch-group">
          <h3>Application tier</h3>
          <ul className="arch-list">
            <li>Node.js / Express API</li>
            <li>Microservices แยกตามโดเมนสินค้า</li>
            <li>Worker สำหรับจัดการออเดอร์และสต็อก</li>
          </ul>
        </div>
        <div className="arch-group">
          <h3>Security</h3>
          <ul className="arch-list">
            <li>IAM ควบคุมสิทธิ์การเข้าถึง</li>
            <li>Security Group และ Firewall</li>
            <li>WAF ป้องกันการโจมตีที่ขอบระบบ</li>
          </ul>
        </div>
        <div className="arch-group">
          <h3>Data &amp; persistence</h3>
          <ul className="arch-list">
            <li>Amazon RDS (PostgreSQL)</li>
            <li>Amazon S3 สำหรับ media และ asset</li>
            <li>Redis cache สำหรับ session</li>
          </ul>
        </div>
        <div className="arch-group">
          <h3>Observability</h3>
          <ul className="arch-list">
            <li>CloudWatch metrics &amp; dashboard</li>
            <li>CloudTrail บันทึก audit log</li>
            <li>Alarm สำหรับ SLA สำคัญ</li>
          </ul>
        </div>
      </div>
      <div className="arch-annotation">
        <h4>Flow highlights</h4>
        <ol>
          <li>ผู้ใช้เชื่อมต่อผ่าน CloudFront เพื่อรับ UI แบบ static จาก React</li>
          <li>คำสั่งซื้อวิ่งผ่าน ELB ไปยังเซิร์ฟเวอร์ Node.js บน EC2 ที่เชื่อมต่อ RDS</li>
          <li>IAM และ Security Group ตรวจสอบสิทธิ์ก่อนเข้าถึงฐานข้อมูล</li>
          <li>ระบบส่งต่อเหตุการณ์ไปยังบริการเสริม เช่น งานเบื้องหลังและการแจ้งเตือน</li>
          <li>CloudWatch / CloudTrail ติดตาม metric และบันทึกทุกกิจกรรมเพื่อการวิเคราะห์</li>
        </ol>
      </div>
      <button type="button" className="back-link" onClick={onBackToShop}>
        ← กลับไปหน้าร้านค้า
      </button>
    </section>
  );
}

export default App;
