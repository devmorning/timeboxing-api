const express = require("express");
const { z } = require("zod");
const { requireAuth } = require("../middleware/requireAuth");
const { createRepeatingTemplatesRepo } = require("../storage/repeatingTemplates");

const router = express.Router();
const repo = createRepeatingTemplatesRepo();

const CreateTemplateSchema = z.object({
  content: z.string().trim().min(1),
  sortOrder: z.number().int().nonnegative().optional(),
});

const UpdateTemplateSchema = z.object({
  content: z.string().trim().min(1).optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

router.use(requireAuth);

router.get("/", async (req, res, next) => {
  try {
    const templates = await repo.listByUser(req.user.id);
    res.json({ templates });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const input = CreateTemplateSchema.parse(req.body ?? {});
    const template = await repo.create(req.user.id, input);
    res.status(201).json({ template });
  } catch (error) {
    next(error);
  }
});

router.put("/:templateId", async (req, res, next) => {
  try {
    const input = UpdateTemplateSchema.parse(req.body ?? {});
    const template = await repo.update(req.user.id, req.params.templateId, input);
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }
    res.json({ template });
  } catch (error) {
    next(error);
  }
});

router.delete("/:templateId", async (req, res, next) => {
  try {
    const removed = await repo.remove(req.user.id, req.params.templateId);
    if (!removed) {
      return res.status(404).json({ error: "Template not found" });
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
