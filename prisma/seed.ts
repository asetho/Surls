import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { DEFAULT_SETTINGS } from "../src/lib/settings";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.appSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value }
    });
  }

  if (email && password) {
    await prisma.user.upsert({
      where: { email: email.toLowerCase() },
      update: {},
      create: {
        email: email.toLowerCase(),
        name: "Surls Admin",
        passwordHash: await hashPassword(password)
      }
    });
    console.log(`Admin user ready: ${email.toLowerCase()}`);
  } else {
    console.log("Settings seeded. Set ADMIN_EMAIL and ADMIN_PASSWORD to seed the first admin user.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
