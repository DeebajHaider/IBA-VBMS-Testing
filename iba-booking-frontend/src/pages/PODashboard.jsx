import { useState, useEffect } from "react";
import { api } from "../api";

// eslint-disable-next-line no-unused-vars
export default function PODashboard({ user }) {
    const [bookings, setBookings] = useState([]);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [filterStatus, setFilterStatus] = useState("pending");

    const loadBookings = async () => {
        try {
            const bookingsData = await api.bookings.list(filterStatus ? { status: filterStatus } : {});
            setBookings(bookingsData);
        } catch (err) {
            setError(err.message);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadBookings();
    }, [filterStatus]);

    const handleAlert = (msg, isError = false) => {
        isError ? setError(msg) : setSuccess(msg);
        setTimeout(() => {
            setError("");
            setSuccess("");
        }, 3000);
    };

    const handleApprove = async (bookingId) => {
        try {
            await api.bookings.approve(bookingId);
            handleAlert("Booking approved successfully!");
            await loadBookings();
        } catch (err) {
            handleAlert(err.message, true);
        }
    };

    const handleReject = async (bookingId) => {
        try {
            await api.bookings.reject(bookingId);
            handleAlert("Booking rejected successfully!");
            await loadBookings();
        } catch (err) {
            handleAlert(err.message, true);
        }
    };

    const handleCancel = async (bookingId) => {
        if (!window.confirm("Cancel this booking?")) return;
        try {
            await api.bookings.cancel(bookingId);
            handleAlert("Booking cancelled successfully!");
            await loadBookings();
        } catch (err) {
            handleAlert(err.message, true);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h2 className="text-2xl font-bold text-slate-800">Booking Requests Management</h2>

                <div className="flex bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
                    {["pending", "approved", "rejected", ""].map((status) => (
                        <button
                            key={status}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                                filterStatus === status
                                    ? "bg-[#9b1c31] text-white shadow-sm"
                                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                            }`}
                            onClick={() => setFilterStatus(status)}
                        >
                            {status ? status.charAt(0).toUpperCase() + status.slice(1) : "All"}
                        </button>
                    ))}
                </div>
            </div>

            {error && <div className="alert-error">{error}</div>}
            {success && <div className="alert-success">{success}</div>}

            <div className="card p-0 overflow-hidden shadow-sm">
                {bookings.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 bg-slate-50/50">
                        <svg
                            className="w-12 h-12 mx-auto text-slate-300 mb-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                            />
                        </svg>
                        <p className="text-lg font-medium text-slate-700">No requests found</p>
                        <p className="text-sm">There are no bookings matching the selected filter.</p>
                    </div>
                ) : (
                    <div className="table-container border-0 rounded-none">
                        <table className="table-base">
                            <thead>
                                <tr>
                                    <th className="table-th">Student</th>
                                    <th className="table-th">Facility</th>
                                    <th className="table-th">Schedule</th>
                                    <th className="table-th">Purpose</th>
                                    <th className="table-th">Status</th>
                                    <th className="table-th text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bookings.map((booking) => (
                                    <tr key={booking.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="table-td">
                                            <div className="font-semibold text-slate-900">{booking.users?.name}</div>
                                            <div className="text-xs text-slate-500 uppercase tracking-wider">
                                                {booking.users?.erp}
                                            </div>
                                        </td>
                                        <td className="table-td">
                                            <div className="font-medium text-slate-800">{booking.rooms?.name}</div>
                                            <div className="text-xs text-slate-500">
                                                {booking.rooms?.buildings?.name}
                                            </div>
                                        </td>
                                        <td className="table-td">
                                            <div className="font-medium text-slate-800">{booking.date}</div>
                                            <div className="text-xs text-slate-500">{booking.time_slots?.label}</div>
                                        </td>
                                        <td
                                            className="table-td max-w-[200px] truncate text-slate-600"
                                            title={booking.purpose}
                                        >
                                            {booking.purpose}
                                        </td>
                                        <td className="table-td">
                                            <span
                                                className={`badge ${
                                                    booking.status === "approved"
                                                        ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                                        : booking.status === "rejected"
                                                          ? "bg-red-100 text-red-800 border-red-200"
                                                          : booking.status === "cancelled"
                                                            ? "bg-slate-100 text-slate-800 border-slate-200"
                                                            : "bg-amber-100 text-amber-800 border-amber-200"
                                                }`}
                                            >
                                                {booking.status}
                                            </span>
                                        </td>
                                        <td className="table-td text-right space-x-2">
                                            {booking.status === "pending" && (
                                                <>
                                                    <button
                                                        onClick={() => handleApprove(booking.id)}
                                                        className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md text-sm font-medium transition-colors border border-emerald-200"
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        onClick={() => handleReject(booking.id)}
                                                        className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-md text-sm font-medium transition-colors border border-red-200"
                                                    >
                                                        Reject
                                                    </button>
                                                </>
                                            )}
                                            {booking.status === "approved" && (
                                                <button
                                                    onClick={() => handleCancel(booking.id)}
                                                    className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-md text-sm font-medium transition-colors border border-slate-300"
                                                >
                                                    Cancel
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
