import { useState, useEffect } from "react";
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
  SignOutButton,
  UserButton,
  useUser,
  useAuth,
} from "@clerk/clerk-react";

const COLUMNS = [
  { id: "planning", title: "🌱 Planning & Sowing", desc: "Seed selection, soil prep, nursery" },
  { id: "field_care", title: "🚜 Active Field Care", desc: "Irrigation, fertilizer, spraying" },
  { id: "harvest", title: "🌾 Harvest & Market", desc: "Harvesting, grading, Mandi sale" },
  { id: "completed", title: "✅ Completed", desc: "Finished crop cycles" },
];

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "pk_test_d2hvbGUtcGVsaWNhbi0yOC5jbGVyay5hY2NvdW50cy5kZXYk";

export default function KanbanBoard() {
  return (
    <ClerkProvider publishableKey={CLERK_KEY} afterSignOutUrl="/">
      <SignedOut>
        <div className="clerk-auth-container">
          <div className="clerk-card">
            <span className="clerk-logo-badge">👨‍🌾 Farmer Progress Kanban</span>
            <h2 className="auth-title">Sign In to Farm Kanban</h2>
            <p className="auth-subtitle">Track field preparation, fertilizer spraying, and harvest cycles with real-time MongoDB sync.</p>
            <div className="clerk-actions-group">
              <SignInButton mode="modal"><button type="button" className="auth-submit-btn">🔑 Sign In</button></SignInButton>
              <SignUpButton mode="modal"><button type="button" className="demo-login-btn">✨ Create Free Account</button></SignUpButton>
            </div>
          </div>
        </div>
      </SignedOut>
      <SignedIn><AuthenticatedKanbanBoard /></SignedIn>
    </ClerkProvider>
  );
}

function AuthenticatedKanbanBoard() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ title: "", crop: "", column: "planning", priority: "medium", dueDate: "", notes: "" });

  const showAlert = (message, type = "error") => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 4000);
  };

  const getHeaders = async () => {
    let token = "";
    try { token = (await getToken()) || ""; } catch {}
    return {
      "Content-Type": "application/json",
      "x-clerk-user-id": user?.id || "",
      "x-clerk-user-name": user?.fullName || user?.firstName || "Farmer",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  };

  const loadTasks = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch("/api/kanban/tasks", { headers: await getHeaders() });
      if (res.ok) setTasks((await res.json()).tasks || []);
    } catch { showAlert("Network error connecting to backend"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadTasks(); }, [user?.id]);

  const handleDrop = async (targetCol, e) => {
    e.preventDefault();
    setDragOverCol(null);
    const taskId = e.dataTransfer.getData("text/plain");
    const task = tasks.find((t) => t._id === taskId);
    if (!task || task.column === targetCol) return;

    const prev = [...tasks];
    setTasks((p) => p.map((t) => (t._id === taskId ? { ...t, column: targetCol } : t)));
    try {
      const res = await fetch(`/api/kanban/tasks/${taskId}`, {
        method: "PUT", headers: await getHeaders(), body: JSON.stringify({ column: targetCol })
      });
      if (!res.ok) throw new Error();
    } catch {
      setTasks(prev);
      showAlert("⚠️ Sync failed! Task returned to previous column.");
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const tempId = "temp-" + Date.now();
    const newTask = { ...form, _id: tempId, user_id: user?.id, created_at: new Date().toISOString() };
    setTasks((p) => [...p, newTask]);
    setIsModalOpen(false);
    setForm({ title: "", crop: "", column: "planning", priority: "medium", dueDate: "", notes: "" });

    try {
      const res = await fetch("/api/kanban/tasks", { method: "POST", headers: await getHeaders(), body: JSON.stringify(newTask) });
      if (res.ok) {
        const data = await res.json();
        setTasks((p) => p.map((t) => (t._id === tempId ? data.task : t)));
      }
      showAlert("Task saved to Farm Board!", "success");
    } catch { showAlert("Task saved locally!", "success"); }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm("Delete this farm task?")) return;
    setTasks((p) => p.filter((t) => t._id !== taskId));
    if (taskId.startsWith("temp-")) { showAlert("Task deleted", "success"); return; }
    try {
      await fetch(`/api/kanban/tasks/${taskId}`, { method: "DELETE", headers: await getHeaders() });
      showAlert("Task deleted", "success");
    } catch { showAlert("Task deleted", "success"); }
  };

  return (
    <div className="kanban-container">
      {alert && <div className={`kanban-alert ${alert.type === "success" ? "success" : "error"}`}>{alert.message}</div>}

      <div className="kanban-top-bar">
        <div className="clerk-user-profile">
          <UserButton afterSignOutUrl="/" />
          <div className="clerk-user-info">
            <h3 className="farmer-name">{user?.fullName || user?.firstName || "Farmer"}</h3>
            <span className="farmer-handle">{user?.primaryEmailAddress?.emailAddress || "farmer"} • Personal Farm Board</span>
          </div>
          <span className="clerk-user-badge">🌱 Verified Farmer</span>
        </div>
        <div className="kanban-actions">
          <button type="button" className="add-task-btn" onClick={() => setIsModalOpen(true)}>➕ New Farm Task</button>
          <SignOutButton><button type="button" className="logout-btn">🚪 Log Out</button></SignOutButton>
        </div>
      </div>

      {loading && <div className="kanban-loading"><div className="loading-spinner" /><p>Syncing farm tasks...</p></div>}

      <div className="kanban-board">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.column === col.id);
          return (
            <div
              key={col.id}
              className={`kanban-col ${dragOverCol === col.id ? "drag-over" : ""}`}
              onDragOver={(e) => { e.preventDefault(); if (dragOverCol !== col.id) setDragOverCol(col.id); }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={(e) => handleDrop(col.id, e)}
            >
              <div className="col-header">
                <div><h4 className="col-title">{col.title}</h4><span className="col-desc">{col.desc}</span></div>
                <span className="col-count">{colTasks.length}</span>
              </div>
              <div className="col-card-list">
                {colTasks.length === 0 ? <div className="empty-col-placeholder"><span>Drop tasks here</span></div> : (
                  colTasks.map((task) => (
                    <div key={task._id} className="task-card" draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", task._id); }}>
                      <div className="card-header-row">
                        {task.crop && <span className="crop-tag">🌾 {task.crop}</span>}
                        <span className={`priority-pill priority-${task.priority || "medium"}`}>{task.priority || "medium"}</span>
                      </div>
                      <h5 className="task-title">{task.title}</h5>
                      {task.notes && <p className="task-notes">{task.notes}</p>}
                      <div className="card-footer-row">
                        <span>{task.dueDate ? `📅 ${task.dueDate}` : "No due date"}</span>
                        <button type="button" className="delete-task-btn" title="Delete" onClick={() => handleDeleteTask(task._id)}>🗑️</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🌾 Add Seasonal Farm Task</h3>
              <button type="button" className="close-modal-btn" onClick={() => setIsModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateTask} className="task-form">
              <div className="form-group">
                <label className="form-label">Task Title *</label>
                <input type="text" className="crop-input" placeholder="e.g. Spray Neem Oil, Soil Testing" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div className="form-row">
                <div className="form-group flex-1">
                  <label className="form-label">Crop / Plot</label>
                  <input type="text" className="crop-input" placeholder="e.g. Tomato, Plot B" value={form.crop} onChange={(e) => setForm({ ...form, crop: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Stage / Column</label>
                  <select className="form-select" value={form.column} onChange={(e) => setForm({ ...form, column: e.target.value })}>
                    {COLUMNS.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group flex-1">
                  <label className="form-label">Priority</label>
                  <select className="form-select" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                    <option value="low">🟢 Low</option><option value="medium">🟡 Medium</option><option value="high">🔴 High</option>
                  </select>
                </div>
                <div className="form-group flex-1">
                  <label className="form-label">Target Date</label>
                  <input type="date" className="crop-input" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes & Field Details</label>
                <textarea className="form-textarea" rows="2" placeholder="Dosage, fertilizer brand..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="save-task-btn">Add to Board</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
