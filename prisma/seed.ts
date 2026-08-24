import { PrismaClient, RoleName } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create all roles idempotently.
  for (const roleName of Object.values(RoleName)) {
    await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@example.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { name: RoleName.ADMINISTRATOR },
  });

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: "System Administrator",
        passwordHash,
        roleId: adminRole.id,
      },
    });
    console.log(`Created initial administrator: ${adminEmail}`);
    console.log(`Temporary password: ${adminPassword} — change this after first login.`);
  } else {
    console.log("Administrator user already exists, skipping.");
  }

  // Seed the default defect categories from the brief (Section 13).
  const defectCategories = [
    "Scratch",
    "Color Difference",
    "Uneven Surface",
    "Dimension / Tolerance",
    "Material Defect",
    "Construction Defect",
    "Assembly Issue",
    "Missing Component",
    "Incorrect Component",
    "Functional Issue",
    "Surface Finish",
    "Stitching",
    "Joint / Connection",
    "Packaging Damage",
    "Transport Damage",
    "Other",
  ];

  for (const name of defectCategories) {
    await prisma.defectCategory.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
