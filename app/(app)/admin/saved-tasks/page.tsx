import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Trash2, GripVertical, Plus } from "lucide-react";
import { createSavedTask, deleteSavedTask } from "./actions";

export default async function SavedTasksPage() {
  const session = await auth();
  if (!session?.user?.active) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  const savedTasks = await prisma.savedTask.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { createdBy: { select: { name: true } } },
  });

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#002D72]">Saved Task Templates</h1>
        <p className="text-sm text-gray-500 mt-1">
          These templates can be applied to any job. They appear as a checklist
          on the Notes &amp; Tasks tab.
        </p>
      </div>

      {/* Admin nav */}
      <div className="flex gap-4 mb-6 border-b border-gray-200 pb-4 flex-wrap">
        <a href="/admin/users" className="text-sm font-medium text-gray-500 hover:text-[#002D72] transition-colors">
          Users
        </a>
        <a href="/admin/saved-tasks" className="text-sm font-medium text-[#002D72] border-b-2 border-[#002D72] pb-1 -mb-5">
          Saved Tasks
        </a>
        <a href="/admin/receipts" className="text-sm font-medium text-gray-500 hover:text-[#002D72] transition-colors">
          Receipts
        </a>
        <a href="/admin/settings" className="text-sm font-medium text-gray-500 hover:text-[#002D72] transition-colors">
          Settings
        </a>
        <a href="/admin/overhead" className="text-sm font-medium text-gray-500 hover:text-[#002D72] transition-colors">
          Overhead
        </a>
        <a href="/admin/owner-draws" className="text-sm font-medium text-gray-500 hover:text-[#002D72] transition-colors">
          Owner Draws
        </a>
        <a href="/admin/contractor-payments" className="text-sm font-medium text-gray-500 hover:text-[#002D72] transition-colors">
          Contractor Pay
        </a>
      </div>

      {/* Add form */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-[#FF5910]" />
          Add New Template
        </h2>
        <form action={createSavedTask} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              name="title"
              required
              placeholder="e.g. Submit permit application"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Description
            </label>
            <textarea
              name="description"
              rows={2}
              placeholder="Optional details…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72] resize-none"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-24">
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Sort Order
              </label>
              <input
                name="sortOrder"
                type="number"
                defaultValue={0}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#002D72]"
              />
            </div>
            <div className="flex-1 flex items-end justify-end">
              <button
                type="submit"
                className="bg-[#002D72] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#003d99] transition-colors"
              >
                Add Template
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Existing templates */}
      <div className="space-y-2">
        {savedTasks.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            No templates yet. Add one above.
          </div>
        )}
        {savedTasks.map((task) => (
          <div
            key={task.id}
            className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-start gap-3"
          >
            <GripVertical className="w-4 h-4 text-gray-300 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                  #{task.sortOrder}
                </span>
                <span className="font-medium text-sm text-gray-900">
                  {task.title}
                </span>
              </div>
              {task.description && (
                <p className="text-xs text-gray-500 mt-1">{task.description}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                Created by {task.createdBy.name ?? "Unknown"}
              </p>
            </div>
            <form
              action={async () => {
                "use server";
                await deleteSavedTask(task.id);
              }}
            >
              <button
                type="submit"
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete template"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
