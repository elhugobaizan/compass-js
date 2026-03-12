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
  console.log('Listar cuentas');
  const count = await prisma.accounts.count();
  if (count > 0) {
    const result = await prisma.accounts.findMany();
    console.log({data: `Se encontraron ${count} cuentas`});
    return res.send(result);
  } else {
    return res.send({data: 'No hay cuentas registradas'});
  }
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`Leyendo cuenta ${id}`);
  const result = await prisma.accounts.findUnique({ where: { id }})
  if(result) {
    console.log(`Cuenta ${id} encontrada`);
    return res.send(result);
  } else {
    res.send({data: `No existe cuenta con id ${id}`});
    console.log(`No existe cuenta con id ${id}`);
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