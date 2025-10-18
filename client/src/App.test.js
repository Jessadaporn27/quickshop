import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  test('แสดงหน้ารถเข็นพร้อมปุ่ม Buy', () => {
    render(<App />);

    expect(screen.getByText('รถเข็นสินค้า')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /buy/i })).toBeInTheDocument();
  });
});
