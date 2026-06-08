import { hashPassword } from "../src/lib/password";
import { prisma } from "../src/lib/prisma";
import { DEFAULT_SETTINGS } from "../src/lib/settings";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const existingSettings = await prisma.appSetting.findMany({ select: { key: true } });
  const existingSettingKeys = new Set(existingSettings.map((setting) => setting.key));
  const missingSettings = Object.entries(DEFAULT_SETTINGS)
    .filter(([key]) => !existingSettingKeys.has(key))
    .map(([key, value]) => ({ key, value }));

  if (missingSettings.length > 0) {
    await prisma.appSetting.createMany({
      data: missingSettings,
      skipDuplicates: true
    });
  }

  if (email && password) {
    const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      console.log(`Admin user already exists: ${email.toLowerCase()}`);
      return;
    }

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
    console.log("Missing settings seeded. Set ADMIN_EMAIL and ADMIN_PASSWORD to seed the first admin user.");
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
