import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Film, LogOut, User, Star, Home, Bookmark } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const [location, navigate] = useLocation();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="container flex h-14 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Film className="w-6 h-6" style={{ color: "oklch(0.82 0.12 85)" }} />
          <span
            className="font-bold text-lg hidden sm:inline"
            style={{ fontFamily: "var(--font-display)" }}
          >
            CineMatch
          </span>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1">
          {isAuthenticated && (
            <>
              <Link href="/">
                <Button
                  variant={location === "/" ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-1.5"
                >
                  <Home className="w-4 h-4" />
                  <span className="hidden sm:inline">Home</span>
                </Button>
              </Link>
              <Link href="/browse">
                <Button
                  variant={location === "/browse" ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-1.5"
                >
                  <Film className="w-4 h-4" />
                  <span className="hidden sm:inline">Browse</span>
                </Button>
              </Link>
              <Link href="/watchlist">
                <Button
                  variant={location === "/watchlist" ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-1.5"
                >
                  <Bookmark className="w-4 h-4" />
                  <span className="hidden sm:inline">Watchlist</span>
                </Button>
              </Link>
              <Link href="/my-ratings">
                <Button
                  variant={location === "/my-ratings" ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-1.5"
                >
                  <Star className="w-4 h-4" />
                  <span className="hidden sm:inline">My Ratings</span>
                </Button>
              </Link>
            </>
          )}

          {/* Auth */}
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="ml-2 gap-2">
                  <Avatar className="w-6 h-6">
                    <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                      {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-sm">
                    {user?.name || user?.email || "User"}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem className="gap-2">
                  <User className="w-4 h-4" />
                  {user?.email || "User"}
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2" onClick={() => logout()}>
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              size="sm"
              onClick={() => navigate("/login")}
              className="ml-2"
            >
              Sign In
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
