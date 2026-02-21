"use client";
import { useEffect, useState, useCallback } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Drawer from "@/components/ui/Drawer";

type Contact = {
  id: string;
  type: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  partnerName: string | null;
  partnerEmail: string | null;
  source: string | null;
  instagram: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

const typeOptions = [
  { value: "ALL", label: "All Types" },
  { value: "LEAD", label: "Lead" },
  { value: "CLIENT", label: "Client" },
  { value: "VENDOR", label: "Vendor" },
  { value: "OTHER", label: "Other" },
];

const typeOnlyOptions = typeOptions.filter((o) => o.value !== "ALL");

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  partnerName: "",
  partnerEmail: "",
  type: "LEAD",
  source: "",
  instagram: "",
  notes: "",
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);

  // New contact modal
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ ...emptyForm });
  const [newError, setNewError] = useState("");

  // Detail drawer
  const [selected, setSelected] = useState<Contact | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ ...emptyForm });
  const [editError, setEditError] = useState("");

  // Delete confirmation
  const [showDelete, setShowDelete] = useState(false);

  const fetchContacts = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (typeFilter !== "ALL") params.set("type", typeFilter);
    const res = await fetch(`/api/contacts?${params}`);
    const data = await res.json();
    setContacts(data);
    setLoading(false);
  }, [search, typeFilter]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Debounced search
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Create
  const handleCreate = async () => {
    setNewError("");
    if (!newForm.firstName || !newForm.lastName || !newForm.email) {
      setNewError("First name, last name, and email are required");
      return;
    }
    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newForm),
    });
    if (!res.ok) {
      const data = await res.json();
      setNewError(data.error || "Failed to create");
      return;
    }
    setShowNew(false);
    setNewForm({ ...emptyForm });
    fetchContacts();
  };

  // Update
  const handleUpdate = async () => {
    if (!selected) return;
    setEditError("");
    const res = await fetch(`/api/contacts/${selected.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    if (!res.ok) {
      const data = await res.json();
      setEditError(data.error || "Failed to update");
      return;
    }
    const updated = await res.json();
    setSelected(updated);
    setEditing(false);
    fetchContacts();
  };

  // Delete
  const handleDelete = async () => {
    if (!selected) return;
    await fetch(`/api/contacts/${selected.id}`, { method: "DELETE" });
    setShowDelete(false);
    setSelected(null);
    fetchContacts();
  };

  const openDetail = (c: Contact) => {
    setSelected(c);
    setEditing(false);
    setEditForm({
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone || "",
      partnerName: c.partnerName || "",
      partnerEmail: c.partnerEmail || "",
      type: c.type,
      source: c.source || "",
      instagram: c.instagram || "",
      notes: c.notes || "",
    });
  };

  const fieldStyle: React.CSSProperties = { marginBottom: 12 };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>Contacts</h1>
        <Button onClick={() => setShowNew(true)}>+ New Contact</Button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <Input
          placeholder="Search by name or email..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          style={{ flex: 1, maxWidth: 360 }}
        />
        <Select
          options={typeOptions}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        />
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading...</p>
      ) : contacts.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>No contacts found.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left" }}>
                {["Name", "Email", "Phone", "Type", "Created"].map((h) => (
                  <th key={h} style={{ padding: "10px 12px", color: "var(--text-secondary)", fontSize: 13, fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => openDetail(c)}
                  style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "12px" }}>{c.firstName} {c.lastName}</td>
                  <td style={{ padding: "12px", color: "var(--text-secondary)" }}>{c.email}</td>
                  <td style={{ padding: "12px", color: "var(--text-secondary)" }}>{c.phone || "—"}</td>
                  <td style={{ padding: "12px" }}><Badge type={c.type} /></td>
                  <td style={{ padding: "12px", color: "var(--text-muted)", fontSize: 13 }}>
                    {new Date(c.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New Contact Modal */}
      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Contact">
        <div style={fieldStyle}><Input label="First Name *" value={newForm.firstName} onChange={(e) => setNewForm({ ...newForm, firstName: e.target.value })} /></div>
        <div style={fieldStyle}><Input label="Last Name *" value={newForm.lastName} onChange={(e) => setNewForm({ ...newForm, lastName: e.target.value })} /></div>
        <div style={fieldStyle}><Input label="Email *" type="email" value={newForm.email} onChange={(e) => setNewForm({ ...newForm, email: e.target.value })} /></div>
        <div style={fieldStyle}><Input label="Phone" value={newForm.phone} onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })} /></div>
        <div style={fieldStyle}><Input label="Partner Name" value={newForm.partnerName} onChange={(e) => setNewForm({ ...newForm, partnerName: e.target.value })} /></div>
        <div style={fieldStyle}><Input label="Partner Email" value={newForm.partnerEmail} onChange={(e) => setNewForm({ ...newForm, partnerEmail: e.target.value })} /></div>
        <div style={fieldStyle}>
          <Select label="Type" options={typeOnlyOptions} value={newForm.type} onChange={(e) => setNewForm({ ...newForm, type: e.target.value })} />
        </div>
        <div style={fieldStyle}><Input label="Source" value={newForm.source} onChange={(e) => setNewForm({ ...newForm, source: e.target.value })} /></div>
        <div style={fieldStyle}><Input label="Instagram" value={newForm.instagram} onChange={(e) => setNewForm({ ...newForm, instagram: e.target.value })} /></div>
        <div style={fieldStyle}>
          <label style={{ fontSize: 13, color: "var(--text-secondary)" }}>Notes</label>
          <textarea
            value={newForm.notes}
            onChange={(e) => setNewForm({ ...newForm, notes: e.target.value })}
            rows={3}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--bg-secondary)",
              color: "var(--text-primary)",
              fontSize: 14,
              outline: "none",
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />
        </div>
        {newError && <p style={{ color: "var(--accent-red)", fontSize: 13, margin: "8px 0" }}>{newError}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <Button variant="secondary" onClick={() => setShowNew(false)}>Cancel</Button>
          <Button onClick={handleCreate}>Create Contact</Button>
        </div>
      </Modal>

      {/* Detail Drawer */}
      <Drawer open={!!selected} onClose={() => setSelected(null)}>
        {selected && !editing && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20 }}>{selected.firstName} {selected.lastName}</h2>
                <Badge type={selected.type} />
              </div>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 20 }}>✕</button>
            </div>
            {([
              ["Email", selected.email],
              ["Phone", selected.phone],
              ["Partner", selected.partnerName],
              ["Partner Email", selected.partnerEmail],
              ["Source", selected.source],
              ["Instagram", selected.instagram],
              ["Notes", selected.notes],
              ["Created", new Date(selected.createdAt).toLocaleString()],
            ] as [string, string | null][]).map(([label, val]) => (
              <div key={label} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 2 }}>{label}</div>
                <div style={{ color: val ? "var(--text-primary)" : "var(--text-muted)" }}>{val || "—"}</div>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
              <Button onClick={() => setEditing(true)}>Edit</Button>
              <Button variant="danger" onClick={() => setShowDelete(true)}>Delete</Button>
            </div>
          </div>
        )}
        {selected && editing && (
          <div>
            <h2 style={{ margin: "0 0 16px", fontSize: 20 }}>Edit Contact</h2>
            <div style={fieldStyle}><Input label="First Name" value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} /></div>
            <div style={fieldStyle}><Input label="Last Name" value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} /></div>
            <div style={fieldStyle}><Input label="Email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></div>
            <div style={fieldStyle}><Input label="Phone" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></div>
            <div style={fieldStyle}><Input label="Partner Name" value={editForm.partnerName} onChange={(e) => setEditForm({ ...editForm, partnerName: e.target.value })} /></div>
            <div style={fieldStyle}><Input label="Partner Email" value={editForm.partnerEmail} onChange={(e) => setEditForm({ ...editForm, partnerEmail: e.target.value })} /></div>
            <div style={fieldStyle}>
              <Select label="Type" options={typeOnlyOptions} value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })} />
            </div>
            <div style={fieldStyle}><Input label="Source" value={editForm.source} onChange={(e) => setEditForm({ ...editForm, source: e.target.value })} /></div>
            <div style={fieldStyle}><Input label="Instagram" value={editForm.instagram} onChange={(e) => setEditForm({ ...editForm, instagram: e.target.value })} /></div>
            <div style={fieldStyle}>
              <label style={{ fontSize: 13, color: "var(--text-secondary)" }}>Notes</label>
              <textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                rows={3}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--bg-secondary)",
                  color: "var(--text-primary)",
                  fontSize: 14,
                  outline: "none",
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />
            </div>
            {editError && <p style={{ color: "var(--accent-red)", fontSize: 13 }}>{editError}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <Button onClick={handleUpdate}>Save</Button>
              <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </Drawer>

      {/* Delete Confirmation Modal */}
      <Modal open={showDelete} onClose={() => setShowDelete(false)} title="Delete Contact">
        <p style={{ color: "var(--text-secondary)" }}>
          Are you sure you want to delete <strong>{selected?.firstName} {selected?.lastName}</strong>? This cannot be undone.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <Button variant="secondary" onClick={() => setShowDelete(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
