import { esAdmin } from '../utils/roles.js';

// Hook personalizado que expone utilidades de rol para el usuario en sesión.
// Lee el objeto siape_user guardado en localStorage por el flujo de login
// y extrae el campo `cargo` para determinar qué permisos tiene el usuario.
// Al no usar useState ni useEffect, el valor se evalúa en cada render del
// componente que llame al hook, reflejando siempre el estado actual del storage.
function useRole() {
  const raw = localStorage.getItem('siape_user');

  // Si no hay usuario en localStorage (sesión no iniciada), user queda en null
  // y cargo en cadena vacía, por lo que isAdmin() devolverá false.
  const user = raw ? JSON.parse(raw) : null;
  const cargo = user?.cargo ?? '';

  return {
    // Función que devuelve true cuando el cargo del usuario es 'admin', sin distinguir
    // mayúsculas ni espacios alrededor (ver esAdmin en utils/roles.js).
    // Se expone como función (en lugar de booleano) para que el consumidor
    // pueda invocarla en cualquier momento sin necesidad de re-ejecutar el hook.
    isAdmin: () => esAdmin(cargo),
  };
}

export default useRole;
