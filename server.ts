import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "adc.db");
const db = new Database(dbPath);

// Initialize DB schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    photo_url TEXT,
    role TEXT DEFAULT 'member', -- 'admin' or 'member'
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS meetings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS attendance (
    meeting_id INTEGER,
    user_id INTEGER,
    status TEXT DEFAULT 'absent', -- 'present' or 'absent'
    PRIMARY KEY (meeting_id, user_id),
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Check if admin exists, if not create default admin
const adminCount = db
  .prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'")
  .get() as { count: number };
if (adminCount.count === 0) {
  db.prepare(
    `
    INSERT INTO users (first_name, last_name, phone, email, role, status, password)
    VALUES ('Admin', 'ADC', '0000000000', 'admin@adc.org', 'admin', 'approved', 'admin123')
  `
  ).run();
}

const app = express();
app.use(express.json({ limit: "10mb" }));

// API Routes

// Auth
app.post("/api/login", (req, res) => {
  const { phone, password } = req.body;
  const user = db
    .prepare("SELECT * FROM users WHERE phone = ? AND password = ?")
    .get(phone, password);
  if (user) {
    res.json({ user });
  } else {
    res.status(401).json({ error: "Identifiants incorrects" });
  }
});

app.post("/api/register", (req, res) => {
  const { first_name, last_name, phone, email, photo_url, password } = req.body;
  try {
    const existing = db
      .prepare("SELECT * FROM users WHERE phone = ?")
      .get(phone);
    if (existing) {
      return res
        .status(400)
        .json({ error: "Ce numéro de téléphone est déjà utilisé" });
    }
    const result = db
      .prepare(
        `
      INSERT INTO users (first_name, last_name, phone, email, photo_url, password, status, role)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', 'member')
    `
      )
      .run(first_name, last_name, phone, email, photo_url, password);
    const user = db
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(result.lastInsertRowid);
    res.json({ user });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Users (Admin only for full list)
app.get("/api/users", (req, res) => {
  const users = db
    .prepare("SELECT * FROM users ORDER BY created_at DESC")
    .all();
  res.json(users);
});

app.put("/api/users/:id/status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  db.prepare("UPDATE users SET status = ? WHERE id = ?").run(status, id);
  res.json({ success: true });
});

app.put("/api/users/:id", (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, phone, email, photo_url } = req.body;
  db.prepare(
    `
    UPDATE users SET first_name = ?, last_name = ?, phone = ?, email = ?, photo_url = ?
    WHERE id = ?
  `
  ).run(first_name, last_name, phone, email, photo_url, id);
  res.json({ success: true });
});

app.delete("/api/users/:id", (req, res) => {
  const { id } = req.params;
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
  res.json({ success: true });
});

// Meetings
app.get("/api/meetings", (req, res) => {
  const meetings = db
    .prepare("SELECT * FROM meetings ORDER BY date DESC, time DESC")
    .all();
  res.json(meetings);
});

app.post("/api/meetings", (req, res) => {
  const { title, description, date, time } = req.body;
  const result = db
    .prepare(
      `
    INSERT INTO meetings (title, description, date, time)
    VALUES (?, ?, ?, ?)
  `
    )
    .run(title, description, date, time);

  // Initialize attendance for all approved members
  const meetingId = result.lastInsertRowid;
  const members = db
    .prepare("SELECT id FROM users WHERE status = 'approved'")
    .all() as { id: number }[];

  const insertAttendance = db.prepare(
    "INSERT INTO attendance (meeting_id, user_id, status) VALUES (?, ?, 'absent')"
  );
  const insertMany = db.transaction((members: { id: number }[]) => {
    for (const member of members) {
      insertAttendance.run(meetingId, member.id);
    }
  });
  insertMany(members);

  res.json({ id: meetingId });
});

app.delete("/api/meetings/:id", (req, res) => {
  const { id } = req.params;
  db.prepare("DELETE FROM meetings WHERE id = ?").run(id);
  res.json({ success: true });
});

// Attendance
app.get("/api/meetings/:id/attendance", (req, res) => {
  const { id } = req.params;
  const attendance = db
    .prepare(
      `
    SELECT a.*, u.first_name, u.last_name, u.phone, u.photo_url
    FROM attendance a
    JOIN users u ON a.user_id = u.id
    WHERE a.meeting_id = ?
    ORDER BY u.last_name, u.first_name
  `
    )
    .all(id);
  res.json(attendance);
});

app.put("/api/meetings/:id/attendance", (req, res) => {
  const { id } = req.params;
  const { user_id, status } = req.body;
  db.prepare(
    `
    INSERT INTO attendance (meeting_id, user_id, status)
    VALUES (?, ?, ?)
    ON CONFLICT(meeting_id, user_id) DO UPDATE SET status = excluded.status
  `
  ).run(id, user_id, status);
  res.json({ success: true });
});

// async function startServer() {
//   const PORT = 3000;

//   if (process.env.NODE_ENV !== 'production') {
//     const vite = await createViteServer({
//       server: { middlewareMode: true },
//       appType: 'spa',
//     });
//     app.use(vite.middlewares);
//   } else {
//     app.use(express.static(path.join(__dirname, 'dist')));
//     app.get('*', (req, res) => {
//       res.sendFile(path.join(__dirname, 'dist', 'index.html'));
//     });
//   }

//   app.listen(PORT, '0.0.0.0', () => {
//     console.log(`Server running on http://localhost:${PORT}`);
//   });
// }

async function startServer() {
  const PORT = 3000;

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });

    app.use(vite.middlewares);

    app.get("*", async (req, res) => {
      try {
        const url = req.originalUrl;

        let template = fs.readFileSync(
          path.resolve(__dirname, "index.html"),
          "utf-8"
        );

        template = await vite.transformIndexHtml(url, template);

        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        res.status(500).end(e);
      }
    });
  } else {
    app.use(express.static(path.join(__dirname, "dist")));

    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
