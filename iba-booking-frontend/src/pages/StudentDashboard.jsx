import { useState, useEffect } from "react";
import { api } from "../api";

// eslint-disable-next-line no-unused-vars
export default function StudentDashboard({ user }) {
    const [buildings, setBuildings] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [slots, setSlots] = useState([]);
    const [bookings, setBookings] = useState([]);

    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [selectedBuilding, setSelectedBuilding] = useState("");
    const [selectedRoom, setSelectedRoom] = useState("");
    const [selectedDate, setSelectedDate] = useState("");
    const [selectedSlot, setSelectedSlot] = useState("");
    const [purpose, setPurpose] = useState("");

    const loadBookings = async () => {
        try {
            const bookingsData = await api.bookings.list({ mine: true });
            setBookings(bookingsData);
        } catch (err) {
            setError(err.message);
        }
    };

    const loadInitialData = async () => {
        try {
            const buildingsData = await api.buildings.list();
            setBuildings(buildingsData);
            const slotsData = await api.timeSlots.list();
            setSlots(slotsData);
            await loadBookings();
        } catch (err) {
            setError(err.message);
        }
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadInitialData();
    }, []);

    const loadRooms = async (buildingId) => {
        try {
            setSelectedRoom("");
            if (buildingId) {
                const roomsData = await api.rooms.list(buildingId);
                setRooms(roomsData);
            } else {
                setRooms([]);
            }
        } catch (err) {
            setError(err.message);
        }
    };

    const handleAlert = (msg, isError = false) => {
        isError ? setError(msg) : setSuccess(msg);
        setTimeout(() => {
            setError("");
            setSuccess("");
        }, 3000);
    };

    const handleBooking = async (e) => {
        e.preventDefault();
        if (!selectedRoom || !selectedDate || !selectedSlot || !purpose) {
            handleAlert("Please fill in all fields", true);
            return;
        }

        try {
            await api.bookings.create({
                room_id: selectedRoom,
                date: selectedDate,
                slot_id: parseInt(selectedSlot),
                purpose,
            });
            handleAlert("Booking request submitted successfully!");
            setSelectedBuilding("");
            setSelectedRoom("");
            setSelectedDate("");
            setSelectedSlot("");
            setPurpose("");
            await loadBookings();
        } catch (err) {
            handleAlert(err.message, true);
        }
    };

    const handleCancel = async (bookingId) => {
        if (!window.confirm("Are you sure you want to cancel this booking?")) return;
        try {
            await api.bookings.cancel(bookingId);
            handleAlert("Booking cancelled successfully");
            await loadBookings();
        } catch (err) {
            handleAlert(err.message, true);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-300">
            {/* Booking Form Sidebar/Top */}
            <div className="lg:col-span-5 space-y-6">
                <div className="card">
                    <div className="border-b border-slate-100 pb-4 mb-6">
                        <h2 className="text-xl font-bold text-slate-800">Request a Room</h2>
                        <p className="text-sm text-slate-500 mt-1">
                            Fill out the form below to book a campus facility.
                        </p>
                    </div>

                    <form onSubmit={handleBooking} className="space-y-5">
                        <div>
                            <label className="label">Building</label>
                            <select
                                value={selectedBuilding}
                                onChange={(e) => {
                                    setSelectedBuilding(e.target.value);
                                    loadRooms(e.target.value);
                                }}
                                required
                                className="input-field bg-white"
                            >
                                <option value="">Select a building</option>
                                {buildings.map((b) => (
                                    <option key={b.id} value={b.id}>
                                        {b.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="label">Room</label>
                            <select
                                value={selectedRoom}
                                onChange={(e) => setSelectedRoom(e.target.value)}
                                disabled={!selectedBuilding}
                                required
                                className="input-field bg-white"
                            >
                                <option value="">Select a room</option>
                                {rooms.map((r) => (
                                    <option key={r.id} value={r.id}>
                                        {r.name} (Cap: {r.capacity})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="label">Date</label>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    min={new Date().toISOString().split("T")[0]}
                                    required
                                    className="input-field bg-white"
                                />
                            </div>

                            <div>
                                <label className="label">Time Slot</label>
                                <select
                                    value={selectedSlot}
                                    onChange={(e) => setSelectedSlot(e.target.value)}
                                    required
                                    className="input-field bg-white"
                                >
                                    <option value="">Select slot</option>
                                    {slots.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="label">Purpose of Booking</label>
                            <textarea
                                value={purpose}
                                onChange={(e) => setPurpose(e.target.value)}
                                placeholder="Describe the activity..."
                                rows="3"
                                required
                                className="input-field bg-white resize-none"
                            />
                        </div>

                        {error && <div className="alert-error py-3">{error}</div>}
                        {success && <div className="alert-success py-3">{success}</div>}

                        <button type="submit" className="btn-primary w-full py-3 mt-2">
                            Submit Booking Request
                        </button>
                    </form>
                </div>
            </div>

            {/* Bookings List Area */}
            <div className="lg:col-span-7 space-y-6">
                <h2 className="text-xl font-bold text-slate-800">My Bookings</h2>

                {bookings.length === 0 ? (
                    <div className="card text-center p-12 bg-slate-50/50 border-dashed">
                        <p className="text-slate-500 font-medium">You haven't requested any room bookings yet.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {bookings.map((booking) => (
                            <div
                                key={booking.id}
                                className="card p-5 flex flex-col sm:flex-row gap-5 items-start relative hover:border-[#9b1c31]/30 hover:shadow-md transition-all"
                            >
                                {/* Visual date block */}
                                <div className="bg-slate-50 rounded-lg p-3 text-center min-w-[80px] border border-slate-100 flex-shrink-0">
                                    <div className="text-xs font-bold text-[#9b1c31] uppercase mb-1">
                                        {new Date(booking.date).toLocaleString("default", { month: "short" })}
                                    </div>
                                    <div className="text-2xl font-bold text-slate-800 leading-none">
                                        {new Date(booking.date).getDate()}
                                    </div>
                                </div>

                                {/* Details */}
                                <div className="flex-1 w-full space-y-1">
                                    <div className="flex justify-between items-start">
                                        <h3 className="text-lg font-bold text-slate-900">{booking.rooms?.name}</h3>
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
                                    </div>
                                    <p className="text-sm text-slate-600 font-medium">
                                        {booking.rooms?.buildings?.name}
                                    </p>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100">
                                        <div className="text-sm">
                                            <span className="text-slate-400">Time:</span>{" "}
                                            <span className="font-medium text-slate-700">
                                                {booking.time_slots?.label}
                                            </span>
                                        </div>
                                        <div className="text-sm truncate" title={booking.purpose}>
                                            <span className="text-slate-400">Purpose:</span>{" "}
                                            <span className="font-medium text-slate-700">{booking.purpose}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions */}
                                {booking.status === "pending" && (
                                    <div className="w-full sm:w-auto mt-2 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-0 border-slate-100 flex justify-end">
                                        <button
                                            onClick={() => handleCancel(booking.id)}
                                            className="text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-md text-sm font-semibold transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
