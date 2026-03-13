// db/prisma.js
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import pkg from "@prisma/client";

const { PrismaClient } = pkg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

// PrismaClient configurado con driver adapter (Neon)
const prisma = new PrismaClient({ adapter });

export { prisma };