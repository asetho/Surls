import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

async function promptAdmin() {
  const rl = createInterface({ input, output });
  const email = (await rl.question("Admin email: ")).trim().toLowerCase();
  const name = (await rl.question("Display name (optional): ")).trim() || "Surls Admin";
  const password = await rl.question("Password: ");
  rl.close();

  if (!email || !password || password.length < 12) {
    throw new Error("Admin email and a password of at least 12 characters are required.");
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      passwordHash: await hashPassword(password)
    },
    create: {
      email,
      name,
      passwordHash: await hashPassword(password)
    }
  });

  console.log(`Admin user ready: ${user.email}`);
}

promptAdmin()
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
