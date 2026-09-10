const { calcularTotal } = require('../../src/services/facturas.service');

describe('facturas.service - calcularTotal', () => {
  it('calcula total = subtotal + impuesto - descuento', () => {
    expect(calcularTotal(1000, 190, 50)).toBe(1140);
  });

  it('convierte valores recibidos como strings antes de calcular', () => {
    expect(calcularTotal('1000', '190', '50')).toBe(1140);
  });

  it('calcula correctamente cuando el descuento es 0', () => {
    expect(calcularTotal(500, 95, 0)).toBe(595);
  });
});
