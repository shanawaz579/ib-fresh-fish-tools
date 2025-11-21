"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardIcon } from "./icons";
import { useAuth } from "@/app/context/AuthContext";

export default function Topbar() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/auth/login');
  };

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 bg-gradient-to-r from-white to-gray-100 px-8 py-4 shadow-md backdrop-blur dark:from-gray-800 dark:to-gray-900">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center text-white shadow">
          <DashboardIcon />
        </div>
        <div className="text-lg font-semibold tracking-tight text-primary">IB Fresh Fish</div>
      </div>

      <nav className="flex items-center gap-6">
        <Link href="/" className="text-base font-medium text-gray-700 hover:text-primary transition dark:text-gray-200">
          Dashboard
        </Link>
        <Link href="#" className="text-base text-gray-500 hover:text-primary transition dark:text-gray-400">
          Tools
        </Link>
        
        {user && (
          <div className="flex items-center gap-4 pl-6 border-l border-gray-300">
            <div className="flex flex-col items-end">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{user.email}</span>
              <button
                onClick={handleLogout}
                className="text-xs text-red-600 hover:text-red-700 font-medium"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
