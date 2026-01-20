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

### 5. Folder Structure
- `services/`: Main backend logic.
- `mock-server/`: Mock of external services for local testing.
- `utils/`: Utilities and helpers.

### 6. Dependencies
- Fastify for the HTTP server.
- MSW to mock external services.

### 7. Testing (Pending)
- No automated tests yet. It is recommended to add Jest or similar for unit and integration testing.

### 8. Security and Best Practices
- Do not commit `.env` or sensitive data to the repository.
- Use environment variables for endpoints and sensitive configurations.
- Keep dependencies up to date.

## Setup
```bash
npm install
cp .env.example .env # and customize if necessary
npm start
```

## Decisions
- ESLint and Prettier were chosen as they are industry standards.
- Each configuration is documented to facilitate onboarding and maintenance.
- It is recommended to add continuous integration (CI) and tests in the future.

---

For questions, check the `DevTask.md` file for specific challenge instructions.

