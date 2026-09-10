const { generateCode } = require('../../src/services/auth.service');

describe('auth.service - generateCode', () => {
  it('retorna un string de exactamente 6 caracteres', () => {
    const codigo = generateCode();
    expect(typeof codigo).toBe('string');
    expect(codigo).toHaveLength(6);
  });

  it('retorna solo dígitos numéricos', () => {
    const codigo = generateCode();
    expect(/^\d{6}$/.test(codigo)).toBe(true);
  });
});
