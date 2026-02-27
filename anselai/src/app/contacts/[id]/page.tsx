"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  partnerName: string | null;
  eventDate: string | null;
  source: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function ContactDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Contact>>({});

  useEffect(() => {
    if (params.id) {
      fetch(`/api/contacts/${params.id}`)
        .then((r) => r.json())
        .then((data) => {
          setContact(data);
          setFormData(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [params.id]);

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/contacts/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const updated = await response.json();
        setContact(updated);
        setEditing(false);
      }
    } catch (error) {
      console.error("Failed to update contact:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading contact...</div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Contact not found</p>
          <button
            onClick={() => router.push("/contacts")}
            className="text-blue-600 hover:text-blue-700"
          >
            ← Back to Contacts
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/contacts")}
              className="text-gray-600 hover:text-gray-900"
            >
              ← Back
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {contact.firstName} {contact.lastName}
                {contact.partnerName && ` & ${contact.partnerName}`}
              </h1>
              <p className="text-gray-600 mt-1 capitalize">
                {contact.status.replace("_", " ")}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {editing ? (
              <>
                <button
                  onClick={() => {
                    setEditing(false);
                    setFormData(contact);
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Edit Contact
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Contact Information */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Contact Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {editing ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        First Name
                      </label>
                      <input
                        type="text"
                        value={formData.firstName || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, firstName: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Last Name
                      </label>
                      <input
                        type="text"
                        value={formData.lastName || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, lastName: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        value={formData.email || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Phone
                      </label>
                      <input
                        type="tel"
                        value={formData.phone || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Partner Name
                      </label>
                      <input
                        type="text"
                        value={formData.partnerName || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, partnerName: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Event Date
                      </label>
                      <input
                        type="date"
                        value={formData.eventDate || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, eventDate: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <div className="text-sm text-gray-500">Email</div>
                      <div className="text-base text-gray-900">{contact.email}</div>
                    </div>
                    {contact.phone && (
                      <div>
                        <div className="text-sm text-gray-500">Phone</div>
                        <div className="text-base text-gray-900">{contact.phone}</div>
                      </div>
                    )}
                    {contact.eventDate && (
                      <div>
                        <div className="text-sm text-gray-500">Event Date</div>
                        <div className="text-base text-gray-900">
                          {new Date(contact.eventDate).toLocaleDateString()}
                        </div>
                      </div>
                    )}
                    {contact.source && (
                      <div>
                        <div className="text-sm text-gray-500">Source</div>
                        <div className="text-base text-gray-900">{contact.source}</div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Notes</h2>
              {editing ? (
                <textarea
                  value={formData.notes || ""}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Add notes about this contact..."
                />
              ) : (
                <p className="text-gray-700 whitespace-pre-wrap">
                  {contact.notes || "No notes yet"}
                </p>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Timeline</h3>
              <div className="space-y-3">
                <div className="text-sm">
                  <div className="text-gray-500">Created</div>
                  <div className="text-gray-900">
                    {new Date(contact.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-sm">
                  <div className="text-gray-500">Last Updated</div>
                  <div className="text-gray-900">
                    {new Date(contact.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Quick Actions
              </h3>
              <div className="space-y-2">
                <button className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 rounded-lg border border-gray-200">
                  📧 Send Email
                </button>
                <button className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 rounded-lg border border-gray-200">
                  📅 Schedule Meeting
                </button>
                <button className="w-full px-4 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 rounded-lg border border-gray-200">
                  📝 Add Task
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
