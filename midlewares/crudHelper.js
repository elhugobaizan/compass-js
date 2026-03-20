// crudUltimate.ts
import express from "express";
import { z } from "zod";
import { prisma } from "../db/prisma.js";

// Función para crear esquema Zod dinámico basado en los campos del modelo
function makeZodSchema(model, exclude = []) {
  const shape = {};
  model.forEach(key => {
    if (exclude.includes(key)) return;
    // Simple guess: number vs string vs boolean
    if (typeof model[key] === "number") shape[key] = z.number().optional();
    else if (typeof model[key] === "boolean") shape[key] = z.boolean().optional();
    else if (model[key] instanceof Date) shape[key] = z.date().optional();
    else shape[key] = z.any().optional(); // fallback
  });
  return z.object(shape);
}

// Generador de CRUD ultimate
export function generateUltimateCRUDRouter(modelName, options) {
  const router = express.Router();
  const model = prisma[modelName];

  const modelFields = Object.keys(model.fields);

  const schema = options?.zodSchema || makeZodSchema(modelFields, options?.protectFields || []);

  // GET /model?skip=0&take=100&filter[field]=value
  router.get("/", async (req, res) => {
    const skip = Number(req.query.skip) || 0;
    const take = Number(req.query.take) || 100;

    let userFilter = {};
    if (req.query.filter) {
      try { Object.assign(userFilter, JSON.parse(req.query.filter)); } catch { }
    }

    const filter = {
      AND: [
        userFilter,
        { deleted_at: null }
      ]
    };

    const data = await model.findMany({ skip, take, where: filter, include: options?.include });
    res.json(data.map((item) => {
      if (!options?.protectFields) return item;
      const copy = { ...item };
      options.protectFields.forEach(f => delete copy[f]);
      return copy;
    }));
  });

  // GET /model/:id
  router.get("/:id", async (req, res) => {
    console.log(`Read ${modelName} with id ${req.params.id}`);
    const data = await model.findUnique({ where: { id: req.params.id }, include: options?.include });
    if (!data) return res.status(404).json({ error: "Not found" });
    console.log(`${modelName} with id ${created.id} found`);
    res.json(data);
  });

  // POST /model
  router.post("/", async (req, res) => {
    console.log(`Create new ${modelName}`);
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error.format());
    const created = await model.create({ data: parsed.data });
    console.log(`${modelName} created with id ${created.id}`);
    res.json(created);
  });

  // PATCH /model/:id
  router.patch("/:id", async (req, res) => {
    console.log(`Read ${modelName} with id ${req.params.id}`);
    const parsed = schema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error.format());
    const updated = await model.update({ where: { id: req.params.id }, data: parsed.data });
    console.log(`${modelName} with id ${updated.id} updated`);
    res.json(updated);
  });

  // DELETE /model/:id
  router.delete("/:id", async (req, res) => {
    console.log(`Delete ${modelName} with id ${req.params.id}`);
    if (modelName === 'accounts') {
      console.log('Checking if the account has assets...');
      const assets = await prisma.assets.count({
        where: {
          account_id: req.params.id
        }
      })
      if(assets > 0) {
        console.log(`${modelName} with id ${req.params.id} NOT deleted because has active assets`);
        return res.status(409).json("La cuenta tiene activos asociados.");
      }
    }
    const deleted = await model.update({ 
      where: { id: req.params.id },
      data: {
        deleted_at: new Date(),
      },
    });
    console.log(`${modelName} with id ${req.params.id} deleted with soft delete`);
    res.json(deleted);
  });

  return router;
}