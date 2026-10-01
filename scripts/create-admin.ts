import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { UserRole } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { prisma } from "../src/lib/prisma";

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
      passwordHash: await hashPassword(password),
      passwordResetEligible: true
    },
    create: {
      email,
      name,
      passwordHash: await hashPassword(password),
      passwordResetEligible: true,
      role: UserRole.ADMIN
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
