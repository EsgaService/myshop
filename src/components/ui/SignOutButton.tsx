export function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        className="rounded-full px-3 py-1.5 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-muted hover:text-fg"
      >
        Cerrar sesión
      </button>
    </form>
  );
}
