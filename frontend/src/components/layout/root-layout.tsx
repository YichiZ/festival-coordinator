import { Link, Outlet } from "react-router-dom";

export function RootLayout() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-14 items-center gap-6 px-4">
          <Link to="/" className="text-lg font-semibold">
            Festival Planner
          </Link>
          <Link
            to="/catalog"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Browse catalog
          </Link>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
