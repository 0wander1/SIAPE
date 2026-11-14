// Devuelve true si el valor es un número finito >= 0. Acepta números y strings
// numéricos (p. ej. '12.5'); rechaza '', null, undefined, booleanos, arreglos,
// objetos, NaN e Infinity.
function esNumeroNoNegativo(valor) {
  if (typeof valor === 'number') {
    return Number.isFinite(valor) && valor >= 0;
  }
  if (typeof valor === 'string') {
    if (valor.trim() === '') return false;
    const numero = Number(valor);
    return Number.isFinite(numero) && numero >= 0;
  }
  return false;
}

// Devuelve true si el valor es un string con formato de correo (texto@dominio.ext),
// ignorando espacios al inicio y al final. Cualquier otro tipo o string vacío es false.
function esCorreoValido(valor) {
  if (typeof valor !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim());
}

module.exports = { esNumeroNoNegativo, esCorreoValido };
