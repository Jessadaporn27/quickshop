import React, { useMemo, useState } from 'react';
import './App.css';

const CART_ITEMS = [
  { id: 1, name: 'คีย์บอร์ดไร้สาย', price: 1590, quantity: 1 },
  { id: 2, name: 'เมาส์เกมมิ่ง', price: 1290, quantity: 2 },
];

const PAYMENT_OPTIONS = [
  {
    id: 'cod',
    label: 'ชำระปลายทาง',
    description: 'จ่ายเงินกับพนักงานจัดส่งเมื่อได้รับสินค้า',
  },
  {
    id: 'credit-card',
    label: 'บัตรเครดิต',
    description: 'รองรับ Visa, Mastercard และบัตรเครดิตหลัก',
  },
];

function formatCurrency(value) {
  return value.toLocaleString('th-TH', { style: 'currency', currency: 'THB' });
}

function CartPage({ items, onCheckout }) {
  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items]
  );

  return (
    <div className="page-container">
      <header className="page-header">
        <h1>รถเข็นสินค้า</h1>
        <p>ตรวจสอบรายการสินค้าของคุณก่อนชำระเงิน</p>
      </header>

      <div className="card">
        <div className="cart-items">
          {items.map((item) => (
            <article key={item.id} className="cart-item">
              <div className="cart-item__info">
                <h2 className="cart-item__name">{item.name}</h2>
                <p className="cart-item__meta">จำนวน {item.quantity} ชิ้น</p>
              </div>
              <p className="cart-item__price">{formatCurrency(item.price * item.quantity)}</p>
            </article>
          ))}
        </div>

        <footer className="cart-summary">
          <div className="cart-summary__row">
            <span>ยอดรวม</span>
            <strong>{formatCurrency(total)}</strong>
          </div>
          <button type="button" className="primary-button" onClick={onCheckout}>
            Buy
          </button>
        </footer>
      </div>
    </div>
  );
}

function PaymentOptionSelector({ options, selectedOption, onChange }) {
  return (
    <div className="payment-options">
      {options.map((option) => (
        <label key={option.id} className={`payment-option ${selectedOption === option.id ? 'payment-option--active' : ''}`}>
          <input
            type="radio"
            name="payment"
            value={option.id}
            checked={selectedOption === option.id}
            onChange={() => onChange(option.id)}
          />
          <div className="payment-option__content">
            <span className="payment-option__label">{option.label}</span>
            <span className="payment-option__description">{option.description}</span>
          </div>
        </label>
      ))}
    </div>
  );
}

function AddressForm({ address, onChange, onSubmit }) {
  return (
    <form className="address-form" onSubmit={onSubmit}>
      <div className="form-row">
        <label htmlFor="fullName">ชื่อ-นามสกุล</label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          placeholder="กรอกชื่อ-นามสกุลผู้รับ"
          value={address.fullName}
          onChange={onChange}
          required
        />
      </div>
      <div className="form-row">
        <label htmlFor="phone">เบอร์โทรศัพท์</label>
        <input
          id="phone"
          name="phone"
          type="tel"
          placeholder="081-234-5678"
          value={address.phone}
          onChange={onChange}
          required
        />
      </div>
      <div className="form-row">
        <label htmlFor="address">ที่อยู่จัดส่ง</label>
        <textarea
          id="address"
          name="address"
          placeholder="บ้านเลขที่ ถนน ตำบล/แขวง"
          rows={3}
          value={address.address}
          onChange={onChange}
          required
        />
      </div>
      <div className="form-row form-row--split">
        <div>
          <label htmlFor="province">จังหวัด</label>
          <input
            id="province"
            name="province"
            type="text"
            placeholder="กรุงเทพมหานคร"
            value={address.province}
            onChange={onChange}
            required
          />
        </div>
        <div>
          <label htmlFor="postalCode">รหัสไปรษณีย์</label>
          <input
            id="postalCode"
            name="postalCode"
            type="text"
            placeholder="10110"
            value={address.postalCode}
            onChange={onChange}
            required
          />
        </div>
      </div>
      <button type="submit" className="primary-button primary-button--full">
        ยืนยันที่อยู่จัดส่ง
      </button>
    </form>
  );
}

function CheckoutPage({ options, selectedPayment, onSelectPayment, onBack }) {
  const [address, setAddress] = useState({
    fullName: '',
    phone: '',
    address: '',
    province: '',
    postalCode: '',
  });

  const handleAddressChange = (event) => {
    const { name, value } = event.target;
    setAddress((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!selectedPayment) {
      window.alert('กรุณาเลือกวิธีการชำระเงินก่อนยืนยันที่อยู่จัดส่ง');
      return;
    }

    window.alert('บันทึกที่อยู่จัดส่งเรียบร้อย ขอบคุณสำหรับการสั่งซื้อ!');
  };

  return (
    <div className="page-container">
      <header className="page-header">
        <button type="button" className="link-button" onClick={onBack}>
          ← กลับไปหน้ารถเข็น
        </button>
        <h1>เลือกวิธีชำระเงิน</h1>
        <p>กรุณาเลือกวิธีการชำระเงินและกรอกรายละเอียดที่อยู่จัดส่ง</p>
      </header>

      <div className="card checkout-card">
        <PaymentOptionSelector options={options} selectedOption={selectedPayment} onChange={onSelectPayment} />

        {selectedPayment ? (
          <div className="address-section">
            <h2>ที่อยู่จัดส่ง</h2>
            <AddressForm address={address} onChange={handleAddressChange} onSubmit={handleSubmit} />
          </div>
        ) : (
          <p className="helper-text">เลือกวิธีการชำระเงินเพื่อกรอกที่อยู่จัดส่ง</p>
        )}
      </div>
    </div>
  );
}

function App() {
  const [page, setPage] = useState('cart');
  const [selectedPayment, setSelectedPayment] = useState(null);

  const handleCheckout = () => {
    setPage('checkout');
  };

  const handleBackToCart = () => {
    setSelectedPayment(null);
    setPage('cart');
  };

  if (page === 'checkout') {
    return (
      <CheckoutPage
        options={PAYMENT_OPTIONS}
        selectedPayment={selectedPayment}
        onSelectPayment={setSelectedPayment}
        onBack={handleBackToCart}
      />
    );
  }

  return <CartPage items={CART_ITEMS} onCheckout={handleCheckout} />;
}

export default App;
