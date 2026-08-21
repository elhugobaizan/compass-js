// db/prisma.js
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import pkg from "@prisma/client";

const { PrismaClient } = pkg;

// Neon cierra las conexiones ociosas por su cuenta. Si el pool se queda con una
// de esas, la siguiente consulta falla con "Server has closed the connection".
// Con un idleTimeout más corto que el de Neon, el pool las descarta primero y
// abre una nueva, así que el problema no llega a pasar.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  keepAlive: true,
});

pool.on("error", (error) => {
  // Una conexión ociosa que se murió no debe tumbar el proceso
  console.error("[pool] error en conexión ociosa:", error.message);
});

const adapter = new PrismaPg(pool);

const CONNECTION_ERROR_CODES = new Set([
  "P1001", // no se puede alcanzar el servidor
  "P1002", // timeout al conectar
  "P1017", // el servidor cerró la conexión
  "P2024", // timeout esperando una conexión del pool
]);

const CONNECTION_ERROR_SIGNATURES = [
  "Server has closed the connection",
  "Connection terminated",
  "ECONNRESET",
  "Can't reach database server",
  "Timed out fetching a new connection",
];

function isConnectionError(error) {
  if (!error) return false;
  if (error.code && CONNECTION_ERROR_CODES.has(error.code)) return true;

  const message = String(error.message ?? "");
  return CONNECTION_ERROR_SIGNATURES.some((s) => message.includes(s));
}

const base = new PrismaClient({ adapter });

// Segunda red, por si igual toca una conexión muerta: se reintenta una vez.
// Es seguro para escrituras porque estos errores son de conexión, no de
// ejecución: la consulta nunca llegó al servidor, así que no se duplica nada.
const prisma = base.$extends({
  query: {
    async $allOperations({ args, query }) {
      try {
        return await query(args);
      } catch (error) {
        if (!isConnectionError(error)) throw error;

        console.warn("[prisma] conexión caída, reintentando:", error.message);
        await new Promise((resolve) => setTimeout(resolve, 250));
        return query(args);
      }
    },
  },
});

export { prisma };
