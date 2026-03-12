import express from "express";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import pkg from "@prisma/client";

const { PrismaClient } = pkg;

const router = express.Router();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

router.use((req, res, next) => {
  console.log(`Request method: ${req.method}, Request URL: ${req.originalUrl}`);
  next();
});

router.get('/', async (req, res) => {
  console.log('Listar impuestos');
  const count = await prisma.bills.count();
  if (count > 0) {
    const result = await prisma.bills.findMany();
    console.log({data: `Se encontraron ${count} impuestos`});
    return res.send(result);
  } else {
    return res.send({data: 'No hay impuestos registrados'});
  }
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`Leyendo impuesto ${id}`);
  const result = await prisma.bills.findUnique({ where: { id }})
  if(result) {
    console.log(`Impuesto ${id} encontrado`);
    return res.send(result);
  } else {
    res.send({data: `No existe impuesto con id ${id}`});
    console.log(`No existe impuesto con id ${id}`);
  }
  return res.status(501).send('Not implemented');
});

router.post('/', (req, res) => {
  return res.status(501).send('Not implemented');
});

router.put('/:id', (req, res) => {
  return res.status(501).send('Not implemented');
});

router.delete('/:id', (req, res) => {
  return res.status(501).send('Not implemented');
});

export default router;