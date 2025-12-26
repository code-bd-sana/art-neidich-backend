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

    // Image labels will be seeded after users so we can set `createdBy`

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
      // determine approval and suspension states
      // root (role 0) and admins (role 1) default to approved; inspectors (role 2) may be unapproved
      const isApproved = role === 2 ? Math.random() < 0.7 : true; // ~70% of inspectors approved
      // don't suspend root; small chance to suspend admins/inspectors
      const isSuspended =
        role === 0 ? false : Math.random() < (role === 1 ? 0.05 : 0.08);

      usersToCreate.push({
        firstName,
        lastName,
        email: `user${i}@example.com`,
        password: hashedPassword,
        role,
        isApproved,
        isSuspended,
      });
    }

    const createdUsers = await User.insertMany(usersToCreate, {
      ordered: false,
    });
    console.log(`Inserted ${createdUsers.length} users.`);

    // 1) Seed ImageLabels (moved here so we can assign createdBy)
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

    // pick a creator (prefer root or admin)
    const creator = createdUsers.find((u) => u.role === 0) || createdUsers[0];
    const creatorId = creator?._id;

    console.log(
      `Preparing to insert ${imageLabelDocs.length} image label docs (creator: ${creatorId})...`
    );
    let createdLabels = [];
    try {
      const docsWithCreator = imageLabelDocs.map((d) => ({
        ...d,
        createdBy: creatorId,
      }));
      createdLabels = await ImageLabel.insertMany(docsWithCreator, {
        ordered: false,
      });
      console.log(`Inserted ${createdLabels.length} image labels.`);
      console.dir(createdLabels, { depth: 1 });
    } catch (e) {
      console.error("Error inserting image labels:", e);
      // continue so we can still seed jobs/reports
    }

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
        createdBy: creatorId,
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
      // pick an inspector id for the report and uploader
      const inspectorId = inspectors[randInt(0, inspectors.length - 1)];
      const imagesCount = randInt(1, 4);
      const images = [];
      for (let j = 0; j < imagesCount; j++) {
        const idx = randInt(0, labelStrings.length - 1);
        // always store the label text (not ObjectId)
        const label = labelStrings[idx];
        images.push({
          imageLabel: label,
          url: `https://example.com/images/${i}_${j}.jpg`,
          fileName: `img_${i}_${j}.jpg`,
          alt: `${labelStrings[idx]} photo`,
          uploadedBy: inspectorId,
          mimeType: "image/jpeg",
          size: randInt(10000, 5000000),
          noteForAdmin: "",
        });
      }

      // assign varied statuses so not all reports are "in_progress"
      const r = Math.random();
      const status = r < 0.6 ? "in_progress" : r < 0.9 ? "success" : "rejected"; // 60/30/10 split

      reportsToCreate.push({
        inspector: inspectorId,
        job: job._id,
        images,
        status,
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
