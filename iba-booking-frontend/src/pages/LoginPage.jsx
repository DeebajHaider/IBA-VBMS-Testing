import { useState } from "react";
import { api, setToken, setStoredUser } from "../api";

export default function LoginPage({ onLogin }) {
    const [erp, setErp] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            const { access_token, user } = await api.auth.login(erp, password);
            setToken(access_token);
            setStoredUser(user);
            onLogin(user);
        } catch (err) {
            setError(err.message || "Login failed. Please check your credentials.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
                {/* Top Brand Accent */}
                <div className="h-2 w-full bg-[#9b1c31]"></div>

                <div className="p-8 sm:p-10">
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">IBA Campus Booking</h1>
                        <p className="text-slate-500 mt-2 text-sm">Streamlining Facility Reservations</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label htmlFor="erp" className="label">
                                ERP / Username
                            </label>
                            <input
                                id="erp"
                                type="text"
                                value={erp}
                                onChange={(e) => setErp(e.target.value)}
                                placeholder="Enter your ERP or username"
                                required
                                disabled={loading}
                                className="input-field"
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="label">
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                required
                                disabled={loading}
                                className="input-field"
                            />
                        </div>

                        {error && <div className="alert-error py-3 px-4 mb-0">{error}</div>}

                        <button type="submit" className="btn-primary w-full text-base py-3 mt-2" disabled={loading}>
                            {loading ? "Authenticating..." : "Sign In"}
                        </button>
                    </form>

                    <div className="mt-10 pt-6 border-t border-slate-100">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 text-center">
                            Demo Credentials
                        </h3>
                        <div className="table-container rounded-lg shadow-none border-slate-100 bg-slate-50">
                            <table className="table-base text-xs">
                                <thead>
                                    <tr>
                                        <th className="table-th py-2 px-4 text-slate-500 bg-slate-100/50 border-b-slate-200">
                                            Role
                                        </th>
                                        <th className="table-th py-2 px-4 text-slate-500 bg-slate-100/50 border-b-slate-200">
                                            User
                                        </th>
                                        <th className="table-th py-2 px-4 text-slate-500 bg-slate-100/50 border-b-slate-200">
                                            Pass
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="table-td py-2 px-4 font-medium">Admin</td>
                                        <td className="table-td py-2 px-4 text-slate-500">admin</td>
                                        <td className="table-td py-2 px-4 text-slate-500">admin123</td>
                                    </tr>
                                    <tr>
                                        <td className="table-td py-2 px-4 font-medium">Student</td>
                                        <td className="table-td py-2 px-4 text-slate-500">12345</td>
                                        <td className="table-td py-2 px-4 text-slate-500">password</td>
                                    </tr>
                                    <tr>
                                        <td className="table-td py-2 px-4 font-medium border-b-0">Program Office</td>
                                        <td className="table-td py-2 px-4 text-slate-500 border-b-0">po001</td>
                                        <td className="table-td py-2 px-4 text-slate-500 border-b-0">password</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
