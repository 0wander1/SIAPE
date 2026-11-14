// Devuelve true si el cargo corresponde a un administrador.
// La comparación ignora mayúsculas y espacios alrededor ('Admin', ' admin ' → true).
// Cualquier valor que no sea string (null, undefined, número, objeto, arreglo) devuelve
// false, así que trim() y toLowerCase() nunca fallan.
export function esAdmin(cargo) {
  if (typeof cargo !== 'string') return false;
  return cargo.trim().toLowerCase() === 'admin';
}
