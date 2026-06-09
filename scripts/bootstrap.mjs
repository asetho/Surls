import { Prisma, PrismaClient, UserRole } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "argon2";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
});

const DEFAULT_SETTINGS = {
  siteName: process.env.APP_NAME?.trim() || "Surls",
  displayTimeZone: "America/New_York",
  trackAdminClicks: false,
  preserveRedirectQuery: false,
  enablePasswordProtectedLinks: true,
  enableQrCodes: true,
  themeDefault: "auto",
  customIndexPage: null,
  customNotFoundPage: null
};

function getInitialAdminCredentials() {
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD;

  if (!email && !password) {
    return null;
  }

  if (!email || !password) {
    throw new Error("Set both INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD, or leave both empty.");
  }

  if (password.length < 12) {
    throw new Error("INITIAL_ADMIN_PASSWORD must be at least 12 characters.");
  }

  return {
    email,
    password,
    name: process.env.INITIAL_ADMIN_NAME?.trim() || "Surls Admin"
  };
}

async function seedMissingSettings() {
  const existingRows = await prisma.appSetting.findMany({ select: { key: true } });
  const existingKeys = new Set(existingRows.map((row) => row.key));
  const missingSettings = Object.entries(DEFAULT_SETTINGS)
    .filter(([key]) => !existingKeys.has(key))
    .map(([key, value]) => ({ key, value: value === null ? Prisma.JsonNull : value }));

  if (missingSettings.length === 0) {
    console.log("Bootstrap: settings already exist.");
    return;
  }

  await prisma.appSetting.createMany({
    data: missingSettings,
    skipDuplicates: true
  });
  console.log(`Bootstrap: created ${missingSettings.length} missing setting(s).`);
}

async function createInitialAdmin() {
  const credentials = getInitialAdminCredentials();
  if (!credentials) {
    console.log("Bootstrap: no initial admin credentials provided.");
    return;
  }

  const userCount = await prisma.user.count();
  if (userCount > 0) {
    console.log("Bootstrap: users already exist, initial admin creation skipped.");
    return;
  }

  const user = await prisma.user.create({
    data: {
      email: credentials.email,
      name: credentials.name,
      passwordHash: await hash(credentials.password),
      role: UserRole.ADMIN
    }
  });

  console.log(`Bootstrap: initial admin created for ${user.email}. Remove INITIAL_ADMIN_PASSWORD after first boot.`);
}

async function main() {
  await seedMissingSettings();
  await createInitialAdmin();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
