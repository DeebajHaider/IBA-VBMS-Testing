import { useState } from "react";
import { getStoredUser, clearToken, clearStoredUser } from "./api";
import "./index.css"; // Consolidated single CSS file
import LoginPage from "./pages/LoginPage";
import StudentDashboard from "./pages/StudentDashboard";
import PODashboard from "./pages/PODashboard";
import AdminDashboard from "./pages/AdminDashboard";

function App() {
    const [user, setUser] = useState(getStoredUser());

    const handleLogout = () => {
        clearToken();
        clearStoredUser();
        setUser(null);
    };

    if (!user) {
        return <LoginPage onLogin={(userData) => setUser(userData)} />;
    }

    return (
        <div className="min-h-screen flex flex-col bg-slate-50">
            <header className="sticky top-0 z-40 w-full bg-[#9b1c31] text-white shadow-md">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">IBA Facility Booking</h1>
                        <div className="flex items-center gap-4">
                            <div className="hidden sm:flex items-center bg-white/10 px-4 py-1.5 rounded-full border border-white/20 text-sm">
                                <span className="font-medium mr-1">{user.name}</span>
                                <span className="text-white/80 text-xs uppercase tracking-wider">({user.role})</span>
                            </div>
                            <button
                                className="text-sm font-medium bg-white text-[#9b1c31] hover:bg-slate-100 px-4 py-2 rounded-lg transition-colors shadow-sm"
                                onClick={handleLogout}
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
                {user.role === "admin" && <AdminDashboard user={user} />}
                {user.role === "student" && <StudentDashboard user={user} />}
                {(user.role === "po" || user.role === "programoffice") && <PODashboard user={user} />}
            </main>
        </div>
    );
}

export default App;
