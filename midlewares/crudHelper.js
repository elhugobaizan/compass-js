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

  // Los ids son enteros, pero llegan como string (params de URL y <select> del front).
  // Se normalizan acá, en el borde, para que nada aguas adentro compare "5" contra 5.
  const idFields = modelFields.filter((f) => f === "id" || f.endsWith("_id"));

  const parseId = (raw) => {
    const n = Number(raw);
    return Number.isInteger(n) ? n : null;
  };

  const coerceIds = (data) => {
    const out = { ...data };
    for (const field of idFields) {
      if (out[field] === undefined || out[field] === null || out[field] === "") continue;
      const n = parseId(out[field]);
      if (n !== null) out[field] = n;
    }
    return out;
  };

  // settings se direcciona por `key` (string), el resto por id numérico
  const requireId = (req, res) => {
    if (modelName === "settings") return req.params.id;
    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: `id inválido: ${req.params.id}` });
      return null;
    }
    return id;
  };

  const handleError = (res, action, err) => {
    console.error(`Error al ${action} ${modelName}:`, err);
    res.status(500).json({
      error: `No se pudo ${action} ${modelName}`,
      detail: err?.message ?? String(err),
    });
  };

  // GET /model?skip=0&take=100&filter[field]=value
  router.get("/", async (req, res) => {
    const skip = Number(req.query.skip) || 0;
    const take = Number(req.query.take) || 100;

    let userFilter = {};
    if (req.query.filter) {
      try {
        Object.assign(userFilter, JSON.parse(req.query.filter));
      } catch { }
    }

    if (modelName === "bill_payments") {
      const year =
        req.query.year !== undefined ? Number(req.query.year) : undefined;
      const month =
        req.query.month !== undefined ? Number(req.query.month) : undefined;

      if (year !== undefined) {
        if (!Number.isInteger(year)) {
          return res.status(400).json({ error: "year debe ser un número entero" });
        }
        userFilter.year = year;
      }

      if (month !== undefined) {
        if (!Number.isInteger(month) || month < 1 || month > 12) {
          return res.status(400).json({ error: "month debe estar entre 1 y 12" });
        }
        userFilter.month = month;
      }
    }

    const filter = {
      AND: [
        userFilter,
        { deleted_at: null }
      ]
    };

    let orderBy = options?.defaultOrderBy;
    if (req.query.orderBy) {
      try {
        orderBy = JSON.parse(req.query.orderBy);
      } catch { }
    }

    try {
      const data = await model.findMany({
        skip,
        take,
        where: filter,
        orderBy,
        include: options?.include
      });

      res.json(data.map((item) => {
        if (!options?.protectFields) return item;
        const copy = { ...item };
        options.protectFields.forEach(f => delete copy[f]);
        return copy;
      }));
    } catch (err) {
      handleError(res, "listar", err);
    }
  });

  // GET /model/:id
  router.get("/:id", async (req, res) => {
    console.log(`Read ${modelName} with id ${req.params.id}`);
    const id = requireId(req, res);
    if (id === null) return;
    try {
      const data = await model.findUnique({ where: { id }, include: options?.include });
      if (!data) return res.status(404).json({ error: "Not found" });
      console.log(`${modelName} with id ${data.id} found`);
      res.json(data);
    } catch (err) {
      handleError(res, "obtener", err);
    }
  });

  // POST /model
  router.post("/", async (req, res) => {
    console.log(`Create new ${modelName}`);
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(parsed.error.format());
    try {
      const created = await model.create({ data: coerceIds(parsed.data) });
      console.log(`${modelName} created with id ${created.id}`);
      res.json(created);
    } catch (err) {
      handleError(res, "crear", err);
    }
  });

  // PATCH /model/:id
  router.patch("/:id", async (req, res) => {
    console.log(`Read ${modelName} with id ${req.params.id}`);
    const parsedRaw = schema.partial().safeParse(req.body);
    if (!parsedRaw.success) return res.status(400).json(parsedRaw.error.format());
    const parsed = { data: coerceIds(parsedRaw.data) };
    const id = requireId(req, res);
    if (id === null) return;
    try {
      const now = new Date();
      // settings se identifica por `key` (no es campo unique), así que usamos updateMany + findFirst
      if (modelName === "settings") {
        // upsert por `key` (no es campo unique): si existe se actualiza, si no se crea
        const existing = await model.findFirst({ where: { key: req.params.id } });
        if (existing) {
          await model.update({
            where: { id: existing.id },
            data: { ...parsed.data, updated_at: now },
          });
        } else {
          await model.create({
            data: { key: req.params.id, ...parsed.data, updated_at: now },
          });
        }
        const updated = await model.findFirst({ where: { key: req.params.id } });
        console.log(`setting with key ${req.params.id} upserted`);
        return res.json(updated);
      }
      // En accounts, updated_at representa la fecha de referencia del saldo:
      // solo debe avanzar cuando cambia el opening_balance (no al editar TNA, nombre, etc.)
      let touchUpdatedAt = true;
      if (modelName === "accounts") {
        const current = await model.findUnique({ where: { id } });
        const incoming = parsed.data.opening_balance;
        const balanceChanged =
          incoming !== undefined && Number(incoming) !== Number(current?.opening_balance);
        touchUpdatedAt = balanceChanged;
      }

      const data = touchUpdatedAt
        ? { ...parsed.data, updated_at: now }
        : { ...parsed.data };

      const updated = await model.update({ where: { id }, data });
      console.log(`updated_at returned by Prisma: ${updated.updated_at?.toISOString?.() ?? updated.updated_at}`);
      console.log(`${modelName} with id ${updated.id} updated`);
      res.json(updated);
    } catch (err) {
      handleError(res, "actualizar", err);
    }
  });

  // DELETE /model/:id
  router.delete("/:id", async (req, res) => {
    console.log(`Delete ${modelName} with id ${req.params.id}`);
    const id = requireId(req, res);
    if (id === null) return;
    try {
      if (modelName === 'accounts') {
        console.log('Checking if the account has assets...');
        const assets = await prisma.assets.count({
          where: {
            account_id: id
          }
        })
        if (assets > 0) {
          console.log(`${modelName} with id ${req.params.id} NOT deleted because has active assets`);
          return res.status(409).json("La cuenta tiene activos asociados.");
        }
      }
      const deleted = await model.update({
        where: { id },
        data: {
          deleted_at: new Date(),
        },
      });
      console.log(`${modelName} with id ${req.params.id} deleted with soft delete`);
      res.json(deleted);
    } catch (err) {
      handleError(res, "eliminar", err);
    }
  });

  return router;
}