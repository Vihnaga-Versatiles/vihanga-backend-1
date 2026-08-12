/*
  Reset a single employee password by login email (no old password).

  Usage:
    node scripts/resetEmployeePasswordByEmail.js <email> [newPassword] --confirm

  Example:
    node scripts/resetEmployeePasswordByEmail.js user@example.com Test@123 --confirm

  Requires MongoDB connectivity (same DATABASE_URL as the app).
*/

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { DATABASE_URL } = require("../config/environment");
const EmployModel = require("../models/employee.model");

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function run() {
  const raw = process.argv.slice(2).filter((a) => a !== "--confirm");
  const confirm = process.argv.includes("--confirm");
  const email = (raw[0] || "").trim();
  const newPassword = (raw[1] || "Test@123").trim();

  if (!email) {
    console.error("Usage: node scripts/resetEmployeePasswordByEmail.js <email> [newPassword] --confirm");
    process.exit(1);
  }

  if (!confirm) {
    console.error("Refusing to run without --confirm (safety). Add --confirm to apply the change.");
    process.exit(1);
  }

  await mongoose.connect(DATABASE_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    tls: true,
  });

  try {
    const user = await EmployModel.findOne({
      "contactInformation.email": new RegExp(`^${escapeRegex(email)}$`, "i"),
    });

    if (!user) {
      console.error(`No employee found with email matching: ${email}`);
      process.exitCode = 1;
      return;
    }

    const hashed = bcrypt.hashSync(newPassword);
    await EmployModel.updateOne(
      { _id: user._id },
      { $set: { "personalInformation.password": hashed } }
    );

    console.log("Password updated.");
    console.log(`  _id: ${user._id}`);
    console.log(`  email: ${user.contactInformation?.email}`);
    console.log(`  new password (plain): ${newPassword}`);
  } catch (err) {
    console.error(err.message || err);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
}

run();
