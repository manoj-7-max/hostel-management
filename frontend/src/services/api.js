import axios from "axios";
import { clearStoredToken, clearStoredUser, getStoredHostelId, getStoredToken } from "../utils/storage.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "http://localhost:3000" : window.location.origin);

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json"
  }
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const hostelId = getStoredHostelId();
  if (hostelId) config.headers["x-hostel-id"] = hostelId;
  return config;
});

api.interceptors.response.use((response) => response, (error) => {
  const isLoginRequest = error.config?.url?.includes("/auth/login");
  if (error.response?.status === 401 && !isLoginRequest && getStoredToken()) {
    clearStoredToken();
    clearStoredUser();
    localStorage.removeItem("hms_hostel_id");
    if (window.location.pathname !== "/login") window.location.assign("/login");
  }
  return Promise.reject(error);
});

export async function loginRequest(credentials) {
  const { data } = await api.post("/auth/login", credentials);
  return data;
}
export const resetPassword = (payload) => api.put("/auth/reset-password", payload).then((res) => res.data);

export const getStudents = () => api.get("/students").then((res) => res.data);
export const getStudentsPage = (page=1, limit=50, search="") => api.get("/students", { params: { page, limit, search } }).then((res) => res.data);
export const getMyProfile = () => api.get("/students/me").then((res) => res.data);
export const getMyRoom = () => api.get("/students/me/room").then((res) => res.data);
export const createStudent = (payload) => api.post("/students", payload).then((res) => res.data);
export const updateStudent = (id, payload) => api.put(`/students/${id}`, payload).then((res) => res.data);
export const deleteStudent = (id) => api.delete(`/students/${id}`).then((res) => res.data);

export const getRooms = () => api.get("/rooms").then((res) => res.data);
export const createRoom = (payload) => api.post("/rooms", payload).then((res) => res.data);
export const allocateRoom = (payload) => api.post("/allocate-room", payload).then((res) => res.data);
export const transferStudent = (payload) => api.post("/allocate-room/transfer", payload).then((res) => res.data);
export const checkoutStudent = (id, payload={}) => api.post(`/allocate-room/${id}/checkout`, payload).then((res) => res.data);
export const getAllocationHistory = (id) => api.get(`/allocate-room/${id}/history`).then((res) => res.data);

export const getComplaints = () => api.get("/complaints").then((res) => res.data);
export const createComplaint = (payload) => api.post("/complaints", payload).then((res) => res.data);
export const updateComplaint = (id, payload) => api.put(`/complaints/${id}`, payload).then((res) => res.data);

export const getPayments = () => api.get("/payments").then((res) => res.data);
export const createPayment = (payload) => api.post("/payments", payload).then((res) => res.data);

export const getMenu = () => api.get("/menu").then((res) => res.data);
export const createMenuItem = (payload) => api.post("/menu", payload).then((res) => res.data);
export const deleteMenuItem = (id) => api.delete(`/menu/${id}`).then((res) => res.data);

export const getAttendance = (date) => api.get("/attendance", { params: { date } }).then((res) => res.data);
export const getMyAttendance = () => api.get("/attendance/me").then((res) => res.data);
export const saveAttendance = (payload) => api.put("/attendance", payload).then((res) => res.data);
export const getStaff = () => api.get("/staff").then((res) => res.data);
export const createStaff = (payload) => api.post("/staff", payload).then((res) => res.data);
export const setStaffActive = (id, is_active) => api.patch(`/staff/${id}`, { is_active }).then((res) => res.data);
export const getInventory = () => api.get("/inventory").then((res) => res.data);
export const createInventoryItem = (payload) => api.post("/inventory", payload).then((res) => res.data);
export const adjustInventory = (id, delta) => api.patch(`/inventory/${id}/quantity`, { delta }).then((res) => res.data);
export const getReportSummary = () => api.get("/reports/summary").then((res) => res.data);
export const getHostels = () => api.get("/hostels").then((res) => res.data);
export const createHostel = (payload) => api.post("/hostels", payload).then((res) => res.data);
export const getHostelLocations = () => api.get("/hostels/locations").then((res) => res.data);
export const createBuilding = (payload) => api.post("/hostels/buildings", payload).then((res) => res.data);
export const createFloor = (payload) => api.post("/hostels/floors", payload).then((res) => res.data);
export const getRoles = () => api.get("/users/roles").then((res) => res.data);
export const getUsers = () => api.get("/users").then((res) => res.data);
export const createUser = (payload) => api.post("/users", payload).then((res) => res.data);
export const setUserActive = (id, is_active) => api.patch(`/users/${id}/active`, { is_active }).then((res) => res.data);
export const getAdmissions = () => api.get("/admissions").then((res) => res.data);
export const createAdmission = (payload) => api.post("/admissions", payload).then((res) => res.data);
export const reviewAdmission = (id, payload) => api.patch(`/admissions/${id}/status`, payload).then((res) => res.data);
export const uploadAdmissionDocument = (id, payload) => api.post(`/admissions/${id}/documents`, payload).then((res) => res.data);
export const downloadAdmissionDocument = (id, fileName) => api.get(`/admissions/documents/${id}`, { responseType: "blob" }).then((res) => {
  const url = URL.createObjectURL(res.data); const link = document.createElement("a");
  link.href = url; link.download = fileName; link.click(); URL.revokeObjectURL(url);
});
export const setAdmissionDocumentStatus = (id,payload) => api.put(`/admissions/documents/${id}/status`,payload).then((res)=>res.data);
export const getVisitors = () => api.get("/visitors").then((res) => res.data);
export const checkInVisitor = (payload) => api.post("/visitors", payload).then((res) => res.data);
export const checkOutVisitor = (id) => api.patch(`/visitors/${id}/checkout`).then((res) => res.data);
export const getMaintenance = () => api.get("/maintenance").then((res) => res.data);
export const createMaintenance = (payload) => api.post("/maintenance", payload).then((res) => res.data);
export const updateMaintenance = (id, payload) => api.patch(`/maintenance/${id}`, payload).then((res) => res.data);
export const getNotifications = () => api.get("/notifications").then((res) => res.data);
export const markNotificationRead = (id) => api.put(`/notifications/${id}/read`).then((res) => res.data);
export const markAllNotificationsRead = () => api.put("/notifications/read-all").then((res) => res.data);
export const getInvoices = () => api.get("/invoices").then((res) => res.data);
export const getFeeTypes = () => api.get("/invoices/fee-types").then((res) => res.data);
export const setFeeRate = (id, amount) => api.put(`/invoices/fee-types/${id}/rate`, { amount: Number(amount) }).then((res) => res.data);
export const generateMonthlyInvoices = (payload) => api.post("/invoices/monthly", payload).then((res) => res.data);
export const createInvoice = (payload) => api.post("/invoices", payload).then((res) => res.data);
export const recordInvoicePayment = (id, payload) => api.post(`/invoices/${id}/payments`, payload).then((res) => res.data);
export const createPaymentRefund = (id, payload) => api.post(`/payments/${id}/refunds`, payload).then((res) => res.data);
export const getParentChildren = () => api.get("/parent/children").then((res) => res.data);
export const getChildAttendance = (id) => api.get(`/parent/children/${id}/attendance`).then((res) => res.data);
export const getChildInvoices = (id) => api.get(`/parent/children/${id}/invoices`).then((res) => res.data);
export const getChildAnnouncements = (id) => api.get(`/parent/children/${id}/announcements`).then((res) => res.data);
export const getChildLeave = (id) => api.get(`/parent/children/${id}/leave`).then((res) => res.data);
export const getMealSubscriptions = () => api.get("/mess/subscriptions").then((res) => res.data);
export const createMealSubscription = (payload) => api.post("/mess/subscriptions", payload).then((res) => res.data);
export const updateMealSubscription = (id, payload) => api.patch(`/mess/subscriptions/${id}`, payload).then((res) => res.data);
export const getMealAttendance = (date, meal_type) => api.get("/mess/attendance", { params: { date, meal_type } }).then((res) => res.data);
export const markMealAttendance = (payload) => api.post("/mess/attendance", payload).then((res) => res.data);
export const getStaffAttendance = (date) => api.get("/staff-attendance", { params: { date } }).then((res) => res.data);
export const saveStaffAttendance = (payload) => api.put("/staff-attendance", payload).then((res) => res.data);
export const getExpenses = () => api.get("/expenses").then((res) => res.data);
export const createExpense = (payload) => api.post("/expenses", payload).then((res) => res.data);

export const requestOutpass = (payload) => api.post("/outpass/request", payload).then((res) => res.data);
export const approveOutpass = (id, payload) => api.put(`/outpass/approve/${id}`, payload).then((res) => res.data);
export const checkoutOutpass = (id) => api.put(`/outpass/checkout/${id}`).then((res) => res.data);
export const checkinOutpass = (id) => api.put(`/outpass/checkin/${id}`).then((res) => res.data);
export const getCurrentlyOutside = () => api.get("/outpass/currently-outside").then((res) => res.data);
export const getOutpasses = () => api.get("/outpass").then((res) => res.data);

export const getAnnouncements = () => api.get("/announcements").then((res) => res.data);
export const createAnnouncement = (payload) => api.post("/announcements", payload).then((res) => res.data);
export const markAnnouncementRead = (id) => api.put(`/announcements/${id}/read`).then((res) => res.data);
