const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config();

const { hashPassword } = require("../helpers/password/password-util");
const ImageLabel = require("../models/ImageLabelModel");
const Job = require("../models/JobModel");
const Report = require("../models/ReportModel");
const User = require("../models/UserModel");

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function connect() {
  const uri = process.env.DB_CONNECTION_URI;
  if (!uri) throw new Error("DB_CONNECTION_URI not set in environment");
  await mongoose.connect(uri, { dbName: process.env.DB_NAME || undefined });
}

async function clearCollections() {
  await Promise.all([
    ImageLabel.deleteMany({}),
    Report.deleteMany({}),
    Job.deleteMany({}),
    User.deleteMany({}),
  ]);
}

async function seed() {
  try {
    console.log("Connecting to database...");
    await connect();
    console.log("Connected.");

    console.log(
      "Clearing existing collections (ImageLabel, Report, Job, User)..."
    );
    await clearCollections();

    // 1) Seed ImageLabels
    const baseLabels = [
      "Kitchen",
      "Bathroom",
      "Roof",
      "Foundation",
      "Electrical",
      "Plumbing",
      "Exterior",
      "Interior",
      "Bedroom",
      "Living Room",
      "Ceiling",
      "Floor",
      "Window",
      "Door",
      "Garage",
      "Driveway",
      "Deck",
      "Balcony",
      "Attic",
      "Basement",
    ];

    const imageLabelDocs = [];
    for (let i = 0; i < 100; i++) {
      imageLabelDocs.push({
        label: `${baseLabels[i % baseLabels.length]} ${
          Math.floor(i / baseLabels.length) + 1
        }`,
      });
    }

    const createdLabels = await ImageLabel.insertMany(imageLabelDocs, {
      ordered: false,
    });
    console.log(`Inserted ${createdLabels.length} image labels.`);

    // 2) Seed Users
    const firstNames = [
      "Alex",
      "Sam",
      "Jordan",
      "Taylor",
      "Casey",
      "Riley",
      "Morgan",
      "Jamie",
      "Avery",
      "Cameron",
    ];
    const lastNames = [
      "Smith",
      "Johnson",
      "Brown",
      "Taylor",
      "Anderson",
      "Thomas",
      "Jackson",
      "White",
      "Harris",
      "Martin",
    ];

    const DEFAULT_PASSWORD_PLAIN = "123456";
    const hashedPassword = await hashPassword(DEFAULT_PASSWORD_PLAIN);

    const usersToCreate = [];
    const TOTAL_USERS = 300;
    for (let i = 0; i < TOTAL_USERS; i++) {
      const firstName =
        firstNames[i % firstNames.length] +
        (i >= firstNames.length ? `_${Math.floor(i / firstNames.length)}` : "");
      const lastName =
        lastNames[i % lastNames.length] +
        (i >= lastNames.length ? `_${Math.floor(i / lastNames.length)}` : "");
      const role = i === 0 ? 0 : i < 6 ? 1 : 2; // 1 root, 5 admins, rest inspectors
      usersToCreate.push({
        firstName,
        lastName,
        email: `user${i}@example.com`,
        password: hashedPassword,
        role,
        isApproved: role !== 2 || true,
      });
    }

    const createdUsers = await User.insertMany(usersToCreate, {
      ordered: false,
    });
    console.log(`Inserted ${createdUsers.length} users.`);

    // collect inspector ids
    const inspectors = createdUsers
      .filter((u) => u.role === 2)
      .map((u) => u._id);
    if (!inspectors.length)
      throw new Error("No inspectors created to attach jobs to.");

    // 3) Seed Jobs
    const TOTAL_JOBS = 800;
    const formTypes = ["RCI Residential Building Code Inspection", "UnKnown"];
    const feeStatusOptions = [
      "Standard",
      "Rush Order",
      "Occupied Fee",
      "Modified Fee",
      "Long Distance Fee",
    ];

    const jobsToCreate = [];
    for (let i = 0; i < TOTAL_JOBS; i++) {
      const inspectorId = inspectors[randInt(0, inspectors.length - 1)];
      const due = new Date();
      due.setDate(due.getDate() + randInt(1, 90));
      jobsToCreate.push({
        inspectorId,
        formType: formTypes[i % formTypes.length],
        feeStatus: feeStatusOptions[i % feeStatusOptions.length],
        agreedFee: randInt(50, 2000),
        fhaCaseDetailsNo: `FHA-${Date.now()}-${i}`,
        orderId: `ORDER-${100000 + i}`,
        streetAddress: `${randInt(1, 9999)} Main St`,
        developmentName: `Development ${randInt(1, 200)}`,
        siteContactName: `${firstNames[i % firstNames.length]} ${
          lastNames[i % lastNames.length]
        }`,
        siteContactPhone: `+1${randInt(2000000000, 9999999999)}`,
        siteContactEmail: `contact${i}@example.com`,
        dueDate: due,
        specialNotesForInspector: "",
        specialNoteForApOrAr: "",
      });
    }

    const createdJobs = await Job.insertMany(jobsToCreate, { ordered: false });
    console.log(`Inserted ${createdJobs.length} jobs.`);

    // 4) Seed Reports
    const TOTAL_REPORTS = 1200;
    const reportsToCreate = [];
    const labelStrings = createdLabels.map((l) => l.label);

    for (let i = 0; i < TOTAL_REPORTS; i++) {
      const job = createdJobs[randInt(0, createdJobs.length - 1)];
      const inspector = createdUsers[randInt(0, createdUsers.length - 1)];
      const imagesCount = randInt(1, 4);
      const images = [];
      for (let j = 0; j < imagesCount; j++) {
        const label = labelStrings[randInt(0, labelStrings.length - 1)];
        images.push({
          imageLabel: label,
          url: `https://example.com/images/${i}_${j}.jpg`,
          fileName: `img_${i}_${j}.jpg`,
          alt: `${label} photo`,
          uploadedBy: inspector._id,
          mimeType: "image/jpeg",
          size: randInt(10000, 5000000),
          noteForAdmin: "",
        });
      }

      reportsToCreate.push({
        inspector: inspector._id,
        job: job._id,
        images,
      });
    }

    // Insert in batches to avoid memory pressure
    const BATCH = 200;
    let inserted = 0;
    for (let i = 0; i < reportsToCreate.length; i += BATCH) {
      const batch = reportsToCreate.slice(i, i + BATCH);
      const res = await Report.insertMany(batch, { ordered: false });
      inserted += res.length;
      console.log(`Inserted ${inserted}/${reportsToCreate.length} reports...`);
    }

    console.log("Seeding complete.");
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Seeding failed:", err);
    try {
      await mongoose.disconnect();
    } catch (e) {
      // ignore
    }
    process.exit(1);
  }
}

if (require.main === module) {
  seed();
}
