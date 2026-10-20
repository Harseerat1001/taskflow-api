const express = require("express");
const pool = require("./db");
const authenticateToken = require("./middleware/auth");

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  console.log("Incoming request:", req.method, req.url);
  next();
});

// Register a new user
app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body;

  // 1. Validate the input
  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof email !== "string" ||
    !email.trim() ||
    typeof password !== "string" ||
    password.length < 8
  ) {
    return res.status(400).json({
      error: "Name and email are required, and password must be at least 8 characters"
    });
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Basic email format validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({
      error: "Please provide a valid email address"
    });
  }

  try {
    // 2. Hash the password before storing it
    const bcrypt = require("bcryptjs");
    const passwordHash = await bcrypt.hash(password, 10);

    // 3. Save the user in PostgreSQL
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, created_at`,
      [name.trim(), normalizedEmail, passwordHash]
    );

    // 4. Return the new user's details
    res.status(201).json({
      message: "User registered successfully",
      user: result.rows[0]
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        error: "An account with this email already exists"
      });
    }

    console.error("Registration failed:", error.message);
    res.status(500).json({
      error: "Failed to register user"
    });
  }
});

// Log in an existing user
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (
    typeof email !== "string" ||
    !email.trim() ||
    typeof password !== "string" ||
    !password
  ) {
    return res.status(400).json({
      error: "Email and password are required"
    });
  }

  try {
    const bcrypt = require("bcryptjs");
    const jwt = require("jsonwebtoken");

    // Find the user by email
    const result = await pool.query(
      `SELECT id, name, email, password_hash
       FROM users
       WHERE email = $1`,
      [email.trim().toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "Invalid email or password"
      });
    }

    const user = result.rows[0];

    // Compare the submitted password with the stored hash
    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        error: "Invalid email or password"
      });
    }

    // Generate a JWT that expires after one day
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error("Login failed:", error.message);
    res.status(500).json({
      error: "Login failed"
    });
  }
});

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({
      message: "TaskFlow API is running",
      database: "connected"
    });
  } catch (error) {
    console.error("Health check failed:", error.message);
    res.status(500).json({ error: "Database connection failed" });
  }
});

console.log("Registering protected GET /api/tasks route");
app.get("/api/tasks", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, status
       FROM tasks
       WHERE user_id = $1
       ORDER BY id`,
      [req.user.id]
    );

    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Fetching tasks failed:", error.message);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

app.get("/api/tasks/:id", authenticateToken, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid task ID" });
  }

  try {
    const result = await pool.query(
      `SELECT id, title, status
       FROM tasks
       WHERE id = $1 AND user_id = $2`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Fetching task failed:", error.message);
    res.status(500).json({ error: "Failed to fetch task" });
  }
});

app.put("/api/tasks/:id", authenticateToken, async (req, res) => {
  const id = Number(req.params.id);
  const { title, status } = req.body;

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid task ID" });
  }

  if (
    (title !== undefined &&
      (typeof title !== "string" || !title.trim())) ||
    (status !== undefined &&
      !["PENDING", "IN_PROGRESS", "COMPLETED"].includes(status))
  ) {
    return res.status(400).json({ error: "Invalid title or status" });
  }

  if (title === undefined && status === undefined) {
    return res.status(400).json({
      error: "Provide a title or status to update"
    });
  }

  try {
    const result = await pool.query(
      `UPDATE tasks
       SET title = COALESCE($1, title),
           status = COALESCE($2, status)
       WHERE id = $3 AND user_id = $4
       RETURNING id, title, status`,
      [
        title === undefined ? null : title.trim(),
        status === undefined ? null : status,
        id,
        req.user.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Updating task failed:", error.message);
    res.status(500).json({ error: "Failed to update task" });
  }
});


app.post("/api/tasks", authenticateToken, async (req, res) => {
  const { title } = req.body;

  if (typeof title !== "string" || !title.trim()) {
    return res.status(400).json({
      error: "A valid task title is required"
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO tasks (title, user_id)
       VALUES ($1, $2)
       RETURNING id, title, status`,
      [title.trim(), req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Creating task failed:", error.message);
    res.status(500).json({ error: "Failed to create task" });
  }
});

app.delete("/api/tasks/:id", authenticateToken, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid task ID" });
  }

  try {
    const result = await pool.query(
      `DELETE FROM tasks
       WHERE id = $1 AND user_id = $2
       RETURNING id, title, status`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }

    res.status(200).json({
      message: "Task deleted successfully",
      task: result.rows[0]
    });
  } catch (error) {
    console.error("Deleting task failed:", error.message);
    res.status(500).json({ error: "Failed to delete task" });
  }
});

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log("Server listening:", server.listening);
});

server.on("close", () => {
  console.log("Server has closed");
});

server.on("error", (error) => {
  console.error("Server error:", error.message);
});