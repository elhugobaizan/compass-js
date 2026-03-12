import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cuentas from './routes/cuentas.js';
import impuestos from './routes/impuestos.js';
import plazosfijos from './routes/plazosfijos.js';
import movimientos from './routes/movimientos.js';

const app = express();
const port = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/cuentas', cuentas);
app.use('/impuestos', impuestos);
app.use('/plazosfijos', plazosfijos);
app.use('/movimientos', movimientos);

app.get('/', (req, res) => {
  res.send('Compass API 2.0.1');
});

app.listen(port, () => {
  console.log(`Servidor Compass API escuchando en puerto ${port}`);
});