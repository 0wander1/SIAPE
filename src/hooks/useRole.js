function useRole() {
  const raw = localStorage.getItem('siape_user');
  const user = raw ? JSON.parse(raw) : null;
  const cargo = user?.cargo ?? '';

  return {
    isAdmin: () => cargo === 'admin',
  };
}

export default useRole;
