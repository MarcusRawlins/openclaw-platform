"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  eventDate: string | null;
  status: string;
  source: string | null;
  createdAt: string;
}

export default function PipelinePage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/contacts")
      .then((r) => r.json())
      .then((data) => {
        setContacts(data.contacts || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const stages = [
    { id: "lead", title: "New Leads", color: "#f59e0b" },
    { id: "qualified", title: "Qualified", color: "#3b82f6" },
    { id: "proposal", title: "Proposal Sent", color: "#8b5cf6" },
    { id: "client", title: "Won", color: "#34d399" }
  ];

  const getStageContacts = (stageId: string) => {
    if (stageId === "lead") {
      return contacts.filter((c) => c.status === "lead");
    } else if (stageId === "client") {
      return contacts.filter((c) => c.status === "client");
    }
    return [];
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Sales Pipeline</h1>
          <p className="text-gray-600 mt-1">Track leads through the booking process</p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading pipeline...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {stages.map((stage) => {
              const stageContacts = getStageContacts(stage.id);
              return (
                <div
                  key={stage.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-gray-900">{stage.title}</h2>
                    <span
                      className="px-2 py-1 text-xs font-medium rounded-full"
                      style={{
                        background: `${stage.color}20`,
                        color: stage.color
                      }}
                    >
                      {stageContacts.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {stageContacts.length === 0 ? (
                      <div className="text-center py-8 text-gray-400 text-sm">
                        No contacts in this stage
                      </div>
                    ) : (
                      stageContacts.map((contact) => (
                        <div
                          key={contact.id}
                          onClick={() => router.push(`/contacts/${contact.id}`)}
                          className="p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 cursor-pointer transition-colors"
                        >
                          <div className="font-medium text-gray-900 text-sm">
                            {contact.firstName} {contact.lastName}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {contact.email}
                          </div>
                          {contact.eventDate && (
                            <div className="text-xs text-gray-600 mt-1">
                              📅 {new Date(contact.eventDate).toLocaleDateString()}
                            </div>
                          )}
                          {contact.source && (
                            <div className="text-xs text-gray-500 mt-1">
                              via {contact.source}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pipeline Stats */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Total Leads",
              value: contacts.filter((c) => c.status === "lead").length,
              color: "#f59e0b"
            },
            {
              label: "Conversion Rate",
              value:
                contacts.length > 0
                  ? `${((contacts.filter((c) => c.status === "client").length / contacts.filter((c) => c.status === "lead" || c.status === "client").length) * 100).toFixed(1)}%`
                  : "0%",
              color: "#34d399"
            },
            {
              label: "Active Clients",
              value: contacts.filter((c) => c.status === "client").length,
              color: "#3b82f6"
            },
            {
              label: "This Month",
              value: contacts.filter(
                (c) =>
                  new Date(c.createdAt).getMonth() === new Date().getMonth() &&
                  new Date(c.createdAt).getFullYear() === new Date().getFullYear()
              ).length,
              color: "#8b5cf6"
            }
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
            >
              <div className="text-sm font-medium text-gray-500 mb-1">{stat.label}</div>
              <div className="text-2xl font-bold" style={{ color: stat.color }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
