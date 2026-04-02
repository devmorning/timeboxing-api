function normalizeTemplate(input, index = 0) {
  if (!input || typeof input !== "object") return null;

  const content = typeof input.content === "string" ? input.content.trim() : "";
  if (!content) return null;

  return {
    id:
      typeof input.id === "string" && input.id
        ? input.id
        : `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    content,
    sortOrder: Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : index,
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createMemoryRepeatingTemplatesRepo() {
  const store = new Map();

  return {
    async listByUser(userId) {
      return [...(store.get(userId) || [])].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
    },

    async create(userId, input) {
      const current = store.get(userId) || [];
      const template = normalizeTemplate(input, current.length);
      current.push(template);
      store.set(userId, current);
      return template;
    },

    async update(userId, templateId, patch) {
      const current = store.get(userId) || [];
      const index = current.findIndex((item) => item.id === templateId);
      if (index < 0) return null;

      const next = normalizeTemplate(
        {
          ...current[index],
          ...patch,
          updatedAt: new Date().toISOString(),
        },
        current[index].sortOrder
      );
      current[index] = next;
      store.set(userId, current);
      return next;
    },

    async remove(userId, templateId) {
      const current = store.get(userId) || [];
      const next = current.filter((item) => item.id !== templateId);
      store.set(userId, next);
      return current.length !== next.length;
    },
  };
}

module.exports = { createMemoryRepeatingTemplatesRepo };
