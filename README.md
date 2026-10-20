# TaskFlow API

TaskFlow is a RESTful task management API built with Node.js, Express, and PostgreSQL. It supports user authentication and allows users to manage their tasks securely.

## Features

- User registration and login
- Password hashing using bcrypt
- JWT-based authentication
- Create, view, update, and delete tasks
- Task ownership and user-level data isolation
- PostgreSQL database integration

## Tech Stack

- **Backend:** Node.js, Express.js
- **Database:** PostgreSQL (Neon)
- **Authentication:** JSON Web Tokens (JWT)
- **Password Security:** bcryptjs
- **Tools:** Git, GitHub, Postman

## API Endpoints

| Method | Endpoint | Description | Authentication |
|---|---|---|---|
| POST | `/api/auth/register` | Register a user | No |
| POST | `/api/auth/login` | Log in and receive a token | No |
| GET | `/api/health` | Check API health | No |
| POST | `/api/tasks` | Create a task | Yes |
| GET | `/api/tasks` | Get your tasks | Yes |
| GET | `/api/tasks/:id` | Get a task by ID | Yes |
| PUT | `/api/tasks/:id` | Update a task | Yes |
| DELETE | `/api/tasks/:id` | Delete a task | Yes |

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Harseerat1001/taskflow-api.git
cd taskflow-api
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
DATABASE_URL=your_postgresql_connection_string
JWT_SECRET=your_long_random_secret
PORT=3000
```

Replace the example values with your own credentials. Never commit your `.env` file.

### 4. Start the server

```bash
node src/server.js
```

The API will run on `http://localhost:3000` by default.

## Example Authentication Flow

1. Register an account using `/api/auth/register`.
2. Log in using `/api/auth/login` to receive a JWT.
3. Send the token in the request header when accessing task endpoints:

```http
Authorization: Bearer YOUR_JWT_TOKEN
```

## Security

- Passwords are stored as hashes rather than plain text.
- Protected endpoints require a valid JWT.
- Users can access only their own tasks.

## Future Improvements

- Add task deadlines and priorities
- Add automated tests
- Add API documentation using Swagger
- Add pagination and filtering

## Author

**Harseerat Kaur**

GitHub: [Harseerat1001](https://github.com/Harseerat1001)