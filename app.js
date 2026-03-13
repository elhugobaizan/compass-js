import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import {generateUltimateCRUDRouter} from './midlewares/crudHelper.js';

const app = express();
const port = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.send('Compass API 2.0.1');
});

// Listado de modelos
const models = ["account_groups", "accounts", "assets", "bills", "categories", "settings", "snapshots", "transaction_types", "transactions"];

// Crear routers automáticamente
models.forEach(model => {
  app.use(`/${model}`, generateUltimateCRUDRouter(model, {
    include: undefined,
    protectFields: ["deleted_at", "modified_at", "created_at"]
  }));
});


app.listen(port, () => {
  console.log(`Servidor Compass API escuchando en puerto ${port}`);
});