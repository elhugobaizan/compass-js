import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { generateUltimateCRUDRouter } from './midlewares/crudHelper.js';
import { prisma } from "./db/prisma.js";

const app = express();
const port = process.env.PORT || 3001;

const allowedOrigins = [
  'http://localhost:5173',
  'https://compass-io-js.vercel.app',
  'https://compass-io.vercel.app'
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS no permitido para origin: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

const getIncludedModels = (model) => {
  if (model === 'accounts') {
    return { 'account_group': true };
  }
  if (model === 'transactions') {
    return { 'category': true, 'type': true, 'account': true };
  }
  return undefined;
};

// CORS primero
app.use(cors(corsOptions));

// Manejo explícito de preflight sin usar app.options('*')
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.send('Compass API 2.0.1');
});

const models = [
  'account_groups',
  'accounts',
  'assets',
  'bills',
  'categories',
  'settings',
  'snapshots',
  'transaction_types',
  'transactions'
];

models.forEach(model => {
  app.use(`/${model}`, generateUltimateCRUDRouter(model, {
    include: getIncludedModels(model),
    protectFields: ['deleted_at', 'modified_at', 'created_at']
  }));
});

app.post(`/transfers`, async (req, res) => {
  const {
    amount,
    date,
    origin_account_id,
    destination_account_id,
    concept,
    location,
  } = req.body;

  // validar
  // buscar cuentas
  // validar que no sean la misma
  // validar moneda si querés bloquear cross-currency

  const transferGroup = crypto.randomUUID();


  const result = await prisma.$transaction([
    prisma.transactions.create({
      data: {
        concept: concept || "Transferencia enviada",
        date: new Date(date),
        amount,
        transfer_group: transferGroup,
        location: location || null,
        account: {
          connect: { id: origin_account_id }
        },
        category: {
          connect: { id: "ec2949e0-30ae-41f4-9253-db126957f2ae" }
        },
        type: {
          connect: {  id: "1e49a6a7-3519-4e5b-aa4b-62a4d11a7a11" }
        }
      },
    }),
    prisma.transactions.create({
      data: {
        concept: concept || "Transferencia recibida",
        date: new Date(date),
        amount,
        transfer_group: transferGroup,
        location: location || null,
        account: {
          connect: { id: destination_account_id }
        },
        category: {
          connect: { id: "ec2949e0-30ae-41f4-9253-db126957f2ae" }
        },
        type: {
          connect: { id: "ef0f7192-c4b3-4d7c-88ef-0d451a77baea" }
        }
      },
    })
    ]);
        
    res.status(201).json(result);
});

app.listen(port, () => {
  console.log(`Servidor Compass API escuchando en puerto ${port}`);
});