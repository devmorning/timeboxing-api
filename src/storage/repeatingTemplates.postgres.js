const { getPool } = require("./pool");

function mapRow(row) {
  return {
    id: row.id,
    content: row.content,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function createPostgresRepeatingTemplatesRepo() {
  return {
    async listByUser(userId) {
      const pool = getPool();
      const res = await pool.query(
        `
        SELECT id, content, sort_order, created_at, updated_at
        FROM repeating_templates
        WHERE user_id = $1
          AND is_archived = false
        ORDER BY sort_order ASC, created_at ASC
        `,
        [userId]
      );
      return res.rows.map(mapRow);
    },

    async create(userId, input) {
      const pool = getPool();
      const res = await pool.query(
        `
        INSERT INTO repeating_templates (user_id, content, sort_order, created_at, updated_at)
        VALUES (
          $1,
          $2,
          COALESCE($3, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM repeating_templates WHERE user_id = $1 AND is_archived = false)),
          now(),
          now()
        )
        RETURNING id, content, sort_order, created_at, updated_at
        `,
        [userId, input.content, input.sortOrder ?? null]
      );
      return mapRow(res.rows[0]);
    },

    async update(userId, templateId, patch) {
      const pool = getPool();
      const fields = [];
      const values = [];

      if (typeof patch.content === "string") {
        values.push(patch.content);
        fields.push(`content = $${values.length}`);
      }
      if (Number.isFinite(patch.sortOrder)) {
        values.push(Number(patch.sortOrder));
        fields.push(`sort_order = $${values.length}`);
      }
      if (fields.length === 0) {
        const existing = await pool.query(
          `
          SELECT id, content, sort_order, created_at, updated_at
          FROM repeating_templates
          WHERE user_id = $1 AND id = $2 AND is_archived = false
          `,
          [userId, templateId]
        );
        return existing.rows[0] ? mapRow(existing.rows[0]) : null;
      }

      values.push(userId);
      values.push(templateId);

      const res = await pool.query(
        `
        UPDATE repeating_templates
        SET ${fields.join(", ")}, updated_at = now()
        WHERE user_id = $${values.length - 1}
          AND id = $${values.length}
          AND is_archived = false
        RETURNING id, content, sort_order, created_at, updated_at
        `,
        values
      );
      return res.rows[0] ? mapRow(res.rows[0]) : null;
    },

    async remove(userId, templateId) {
      const pool = getPool();
      const res = await pool.query(
        `
        UPDATE repeating_templates
        SET is_archived = true, updated_at = now()
        WHERE user_id = $1 AND id = $2 AND is_archived = false
        `,
        [userId, templateId]
      );
      return res.rowCount > 0;
    },
  };
}

module.exports = { createPostgresRepeatingTemplatesRepo };
