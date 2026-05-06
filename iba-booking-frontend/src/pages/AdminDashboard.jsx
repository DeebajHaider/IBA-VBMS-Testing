import { useState, useEffect } from "react";
import { api } from "../api";

// eslint-disable-next-line no-unused-vars
export default function AdminDashboard({ user }) {
    const [tab, setTab] = useState("bookings");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [students, setStudents] = useState([]);
    const [studentForm, setStudentForm] = useState({ erp: "", name: "", email: "", password: "" });

    const [poMembers, setPOMembers] = useState([]);
    const [poForm, setPoForm] = useState({ erp: "", name: "", email: "", password: "" });

    const [buildings, setBuildings] = useState([]);
    const [buildingForm, setBuildingForm] = useState({ name: "", location: "" });

    const [rooms, setRooms] = useState([]);
    const [roomForm, setRoomForm] = useState({ name: "", building_id: "", capacity: "", type: "" });

    const [bookings, setBookings] = useState([]);
    const [filterStatus, setFilterStatus] = useState("pending");

    const loadAllData = async () => {
        try {
            const buildingsData = await api.buildings.list();
            setBuildings(buildingsData);
            const usersData = await api.users.list();
            setStudents(usersData.filter((u) => u.role === "student"));
            setPOMembers(usersData.filter((u) => u.role === "programoffice"));
            const roomsData = await api.rooms.list();
            setRooms(roomsData);
            await loadBookings();
        } catch (err) {
            setError(err.message);
        }
    };

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
        loadAllData();
    }, []);
    
    useEffect(() => {
        loadBookings();
    }, [filterStatus]);

    const handleAlert = (msg, isError = false) => {
        isError ? setError(msg) : setSuccess(msg);
        setTimeout(() => {
            setError("");
            setSuccess("");
        }, 3000);
    };

    // Submit Handlers
    const handleAddStudent = async (e) => {
        e.preventDefault();
        try {
            await api.users.create({ ...studentForm, role: "student" });
            handleAlert("Student added successfully");
            setStudentForm({ erp: "", name: "", email: "", password: "" });
            await loadAllData();
        } catch (err) {
            handleAlert(err.message, true);
        }
    };

    const handleAddPO = async (e) => {
        e.preventDefault();
        try {
            await api.users.create({ ...poForm, role: "programoffice" });
            handleAlert("PO member added successfully");
            setPoForm({ erp: "", name: "", email: "", password: "" });
            await loadAllData();
        } catch (err) {
            handleAlert(err.message, true);
        }
    };

    const handleAddBuilding = async (e) => {
        e.preventDefault();
        try {
            await api.buildings.create(buildingForm);
            handleAlert("Building added successfully");
            setBuildingForm({ name: "", location: "" });
            await loadAllData();
        } catch (err) {
            handleAlert(err.message, true);
        }
    };

    const handleDeleteBuilding = async (buildingId) => {
        if (!window.confirm("Delete this building?")) return;
        try {
            await api.buildings.remove(buildingId);
            handleAlert("Building deleted successfully");
            await loadAllData();
        } catch (err) {
            handleAlert(err.message, true);
        }
    };

    const handleAddRoom = async (e) => {
        e.preventDefault();
        try {
            await api.rooms.create({ ...roomForm, capacity: parseInt(roomForm.capacity) });
            handleAlert("Room added successfully");
            setRoomForm({ name: "", building_id: "", capacity: "", type: "" });
            await loadAllData();
        } catch (err) {
            handleAlert(err.message, true);
        }
    };

    const handleDeleteRoom = async (roomId) => {
        if (!window.confirm("Delete this room?")) return;
        try {
            await api.rooms.remove(roomId);
            handleAlert("Room deleted successfully");
            await loadAllData();
        } catch (err) {
            handleAlert(err.message, true);
        }
    };

    const handleApproveBooking = async (bookingId) => {
        try {
            await api.bookings.approve(bookingId);
            handleAlert("Booking approved!");
            await loadBookings();
        } catch (err) {
            handleAlert(err.message, true);
        }
    };

    const handleRejectBooking = async (bookingId) => {
        try {
            await api.bookings.reject(bookingId);
            handleAlert("Booking rejected!");
            await loadBookings();
        } catch (err) {
            handleAlert(err.message, true);
        }
    };

    const handleCancelBooking = async (bookingId) => {
        if (!window.confirm("Cancel this booking?")) return;
        try {
            await api.bookings.cancel(bookingId);
            handleAlert("Booking cancelled!");
            await loadBookings();
        } catch (err) {
            handleAlert(err.message, true);
        }
    };

    const tabs = [
        { id: "bookings", label: "Bookings" },
        { id: "rooms", label: "Rooms" },
        { id: "buildings", label: "Buildings" },
        { id: "students", label: "Students" },
        { id: "po", label: "PO Members" },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex overflow-x-auto gap-2 pb-2 border-b border-slate-200">
                {tabs.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`px-5 py-2.5 rounded-t-lg font-medium text-sm transition-all whitespace-nowrap border-b-2 
              ${
                  tab === t.id
                      ? "border-[#9b1c31] text-[#9b1c31] bg-white"
                      : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {error && <div className="alert-error">{error}</div>}
            {success && <div className="alert-success">{success}</div>}

            {/* STUDENTS */}
            {tab === "students" && (
                <div className="space-y-6">
                    <div className="card">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">Add New Student</h3>
                        <form onSubmit={handleAddStudent} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="label">ERP</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={studentForm.erp}
                                    onChange={(e) => setStudentForm({ ...studentForm, erp: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="label">Full Name</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={studentForm.name}
                                    onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="label">Email</label>
                                <input
                                    type="email"
                                    className="input-field"
                                    value={studentForm.email}
                                    onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="label">Password</label>
                                <input
                                    type="password"
                                    className="input-field"
                                    value={studentForm.password}
                                    onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="sm:col-span-2 pt-2">
                                <button type="submit" className="btn-primary w-full sm:w-auto">
                                    Add Student
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="card p-0 overflow-hidden">
                        <div className="p-5 border-b border-slate-100">
                            <h3 className="text-lg font-bold text-slate-800">Students List</h3>
                        </div>
                        {students.length === 0 ? (
                            <p className="p-8 text-center text-slate-500">No students found.</p>
                        ) : (
                            <div className="table-container border-0 rounded-none">
                                <table className="table-base border-0">
                                    <thead className="border-t-0">
                                        <tr>
                                            <th className="table-th">ERP</th>
                                            <th className="table-th">Name</th>
                                            <th className="table-th">Email</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {students.map((s) => (
                                            <tr key={s.id} className="hover:bg-slate-50">
                                                <td className="table-td font-medium">{s.erp}</td>
                                                <td className="table-td">{s.name}</td>
                                                <td className="table-td text-slate-500">{s.email}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* PO MEMBERS */}
            {tab === "po" && (
                <div className="space-y-6">
                    <div className="card">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">Add New PO Member</h3>
                        <form onSubmit={handleAddPO} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="label">ERP</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={poForm.erp}
                                    onChange={(e) => setPoForm({ ...poForm, erp: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="label">Full Name</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={poForm.name}
                                    onChange={(e) => setPoForm({ ...poForm, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="label">Email</label>
                                <input
                                    type="email"
                                    className="input-field"
                                    value={poForm.email}
                                    onChange={(e) => setPoForm({ ...poForm, email: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="label">Password</label>
                                <input
                                    type="password"
                                    className="input-field"
                                    value={poForm.password}
                                    onChange={(e) => setPoForm({ ...poForm, password: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="sm:col-span-2 pt-2">
                                <button type="submit" className="btn-primary w-full sm:w-auto">
                                    Add PO Member
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="card p-0 overflow-hidden">
                        <div className="p-5 border-b border-slate-100">
                            <h3 className="text-lg font-bold text-slate-800">PO Members List</h3>
                        </div>
                        {poMembers.length === 0 ? (
                            <p className="p-8 text-center text-slate-500">No PO members found.</p>
                        ) : (
                            <div className="table-container border-0 rounded-none">
                                <table className="table-base">
                                    <thead className="border-t-0">
                                        <tr>
                                            <th className="table-th">ERP</th>
                                            <th className="table-th">Name</th>
                                            <th className="table-th">Email</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {poMembers.map((p) => (
                                            <tr key={p.id} className="hover:bg-slate-50">
                                                <td className="table-td font-medium">{p.erp}</td>
                                                <td className="table-td">{p.name}</td>
                                                <td className="table-td text-slate-500">{p.email}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* BUILDINGS */}
            {tab === "buildings" && (
                <div className="space-y-6">
                    <div className="card">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">Add New Building</h3>
                        <form onSubmit={handleAddBuilding} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="label">Building Name</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={buildingForm.name}
                                    onChange={(e) => setBuildingForm({ ...buildingForm, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="label">Location</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={buildingForm.location}
                                    onChange={(e) => setBuildingForm({ ...buildingForm, location: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="sm:col-span-2 pt-2">
                                <button type="submit" className="btn-primary w-full sm:w-auto">
                                    Add Building
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="card p-0 overflow-hidden">
                        <div className="p-5 border-b border-slate-100">
                            <h3 className="text-lg font-bold text-slate-800">Buildings List</h3>
                        </div>
                        {buildings.length === 0 ? (
                            <p className="p-8 text-center text-slate-500">No buildings found.</p>
                        ) : (
                            <div className="table-container border-0 rounded-none">
                                <table className="table-base">
                                    <thead>
                                        <tr>
                                            <th className="table-th">Name</th>
                                            <th className="table-th">Location</th>
                                            <th className="table-th w-24 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {buildings.map((b) => (
                                            <tr key={b.id} className="hover:bg-slate-50">
                                                <td className="table-td font-medium">{b.name}</td>
                                                <td className="table-td text-slate-500">{b.location}</td>
                                                <td className="table-td text-right">
                                                    <button
                                                        onClick={() => handleDeleteBuilding(b.id)}
                                                        className="text-red-600 hover:text-red-800 font-medium text-sm px-3 py-1 bg-red-50 hover:bg-red-100 rounded transition-colors"
                                                    >
                                                        Delete
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ROOMS */}
            {tab === "rooms" && (
                <div className="space-y-6">
                    <div className="card">
                        <h3 className="text-lg font-bold text-slate-800 mb-4">Add New Room</h3>
                        <form onSubmit={handleAddRoom} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="label">Room Name</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={roomForm.name}
                                    onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="label">Building</label>
                                <select
                                    className="input-field"
                                    value={roomForm.building_id}
                                    onChange={(e) => setRoomForm({ ...roomForm, building_id: e.target.value })}
                                    required
                                >
                                    <option value="">Select Building</option>
                                    {buildings.map((b) => (
                                        <option key={b.id} value={b.id}>
                                            {b.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="label">Capacity</label>
                                <input
                                    type="number"
                                    className="input-field"
                                    value={roomForm.capacity}
                                    onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="label">Room Type</label>
                                <select
                                    className="input-field"
                                    value={roomForm.type}
                                    onChange={(e) => setRoomForm({ ...roomForm, type: e.target.value })}
                                    required
                                >
                                    <option value="">Select Type</option>
                                    <option value="Classroom">Classroom</option>
                                    <option value="Seminar Hall">Seminar Hall</option>
                                    <option value="Computer Lab">Computer Lab</option>
                                    <option value="Meeting Room">Meeting Room</option>
                                </select>
                            </div>
                            <div className="sm:col-span-2 pt-2">
                                <button type="submit" className="btn-primary w-full sm:w-auto">
                                    Add Room
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="card p-0 overflow-hidden">
                        <div className="p-5 border-b border-slate-100">
                            <h3 className="text-lg font-bold text-slate-800">Rooms List</h3>
                        </div>
                        {rooms.length === 0 ? (
                            <p className="p-8 text-center text-slate-500">No rooms found.</p>
                        ) : (
                            <div className="table-container border-0 rounded-none">
                                <table className="table-base">
                                    <thead>
                                        <tr>
                                            <th className="table-th">Name</th>
                                            <th className="table-th">Building</th>
                                            <th className="table-th">Type</th>
                                            <th className="table-th">Capacity</th>
                                            <th className="table-th w-24 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rooms.map((r) => (
                                            <tr key={r.id} className="hover:bg-slate-50">
                                                <td className="table-td font-medium">{r.name}</td>
                                                <td className="table-td text-slate-600">{r.buildings?.name}</td>
                                                <td className="table-td text-slate-500">{r.type || "N/A"}</td>
                                                <td className="table-td text-slate-500">{r.capacity}</td>
                                                <td className="table-td text-right">
                                                    <button
                                                        onClick={() => handleDeleteRoom(r.id)}
                                                        className="text-red-600 hover:text-red-800 font-medium text-sm px-3 py-1 bg-red-50 hover:bg-red-100 rounded transition-colors"
                                                    >
                                                        Delete
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* BOOKINGS */}
            {tab === "bookings" && (
                <div className="space-y-6">
                    <div className="card flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between p-4 bg-white">
                        <h3 className="text-lg font-bold text-slate-800 m-0">Booking Requests</h3>
                        <div className="flex flex-wrap gap-2">
                            {["pending", "approved", "rejected", ""].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                                        filterStatus === status
                                            ? "bg-[#9b1c31] text-white border-[#9b1c31]"
                                            : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                                    }`}
                                >
                                    {status ? status.charAt(0).toUpperCase() + status.slice(1) : "All"}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="card p-0 overflow-hidden shadow-sm">
                        {bookings.length === 0 ? (
                            <p className="p-12 text-center text-slate-500">No bookings match the selected filter.</p>
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
                                                    <div className="font-semibold text-slate-900">
                                                        {booking.users?.name}
                                                    </div>
                                                    <div className="text-xs text-slate-500 uppercase tracking-wider">
                                                        {booking.users?.erp}
                                                    </div>
                                                </td>
                                                <td className="table-td">
                                                    <div className="font-medium text-slate-800">
                                                        {booking.rooms?.name}
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        {booking.rooms?.buildings?.name}
                                                    </div>
                                                </td>
                                                <td className="table-td">
                                                    <div className="font-medium text-slate-800">{booking.date}</div>
                                                    <div className="text-xs text-slate-500">
                                                        {booking.time_slots?.label}
                                                    </div>
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
                                                                onClick={() => handleApproveBooking(booking.id)}
                                                                className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md text-sm font-medium transition-colors border border-emerald-200"
                                                            >
                                                                Approve
                                                            </button>
                                                            <button
                                                                onClick={() => handleRejectBooking(booking.id)}
                                                                className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-md text-sm font-medium transition-colors border border-red-200"
                                                            >
                                                                Reject
                                                            </button>
                                                        </>
                                                    )}
                                                    {booking.status === "approved" && (
                                                        <button
                                                            onClick={() => handleCancelBooking(booking.id)}
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
            )}
        </div>
    );
}
