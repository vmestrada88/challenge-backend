
# Challenge Backend - Event Management System

## Project Overview
This project is a Node.js backend for an Event Management System using Fastify. It interacts with external APIs and provides endpoints to view and add events.

## Production-Ready Configuration

### 1. Environment Variables
- Configuration is separated using environment variables.
- `.env.example` file added to show the required variables.

### 2. Git Ignore
- `.gitignore` file to prevent committing sensitive files and dependencies (`node_modules`, `.env`, etc).

### 3. Linting and Formatting
- ESLint configuration (`.eslintrc.json`) to maintain code quality.
- Prettier configuration (`.prettierrc`) for consistent formatting.
- Scripts added in `package.json` for linting and formatting.

### 4. Useful Scripts
- `npm run start`: Starts the server in production mode.
- `npm run dev`: Starts the server in development mode with auto-reload (requires `nodemon`).
- `npm run lint`: Runs ESLint on the entire project.
- `npm run format`: Formats the code with Prettier.
- `npm test`: Runs automated tests with Jest.

### 5. Folder Structure
- `services/`: Main backend logic.
- `mock-server/`: Mock of external services for local testing.
- `utils/`: Utilities and helpers.
- `test/`: Automated tests for endpoints.

### 6. Dependencies
- Fastify for the HTTP server.
- MSW to mock external services.
- Jest and node-fetch for testing.

### 7. Testing
- Automated tests for main endpoints using Jest (`test/events.test.js`).
- Tests cover:
	- GET /getUsers
	- GET /getEvents
	- POST /addEvent (including circuit breaker behavior)

### 8. Security and Best Practices
- Do not commit `.env` or sensitive data to the repository.
- Use environment variables for endpoints and sensitive configurations.
- Keep dependencies up to date.

## Performance Improvements
- `/getEventsByUserId/:id` endpoint was optimized to fetch all events in parallel using `Promise.all`, greatly improving response time for users with many events.
- The original sequential code is commented for reference in `services/index.js`.

## Resilience Improvements
- `/addEvent` endpoint now implements a manual circuit breaker:
	- Detects 3+ failures in a 30-second window.
	- Opens the circuit and rejects new requests for 30 seconds.
	- Periodically probes the external service and resumes normal operation when available.
	- Returns appropriate 503 error responses to clients when the service is unavailable.

## Setup
```bash
npm install
cp .env.example .env # and customize if necessary
npm start
```

## Decisions
- ESLint and Prettier were chosen as industry standards.
- Jest was used for automated endpoint testing.
- All configuration and improvements are documented for clarity and maintainability.
- Continuous integration (CI) is recommended for future improvements.

---

For questions, check the `DevTask.md` file for specific challenge instructions.

