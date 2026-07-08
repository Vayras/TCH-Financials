# TCH Financials - Daily Developer Guide (Start & Stop)

This document provides a simple, step-by-step guide on how to start the local development server, log in, and stop the servers cleanly when you're finished.

---

## 1. How to Start the Project

Whenever you want to start working on the project, run the following steps in your terminal from the project's root directory:

### Step 1: Select the correct Node version
Ensure your terminal session is using Node.js v22:
```bash
nvm use 22
```

### Step 2: Start the servers
Launch the development environment:
```bash
npm run dev
```
This runs both the NestJS API (port `8000`) and the Next.js Frontend (port `5050`) concurrently in the background.

### Step 3: Open the application in your browser
Go to the frontend local URL:
👉 **[http://localhost:5050](http://localhost:5050)**

If you are not already logged in, you will be redirected to the login page:
*   **Default login emails**:
    - `admin@theculturehub.co.in`
    - `mayank@theculturehub.co.in`
    - `arzoo@theculturehub.co.in`
*   **Password**: Enter the password matching the account in your Supabase Auth dashboard.

---

## 2. How to Stop (Turn Off) the Project

When you are done working and want to shut down the servers and free up the network ports:

### Step 1: Terminate the running processes
Go to the terminal tab where the `npm run dev` command is running, and press:
```
Ctrl + C
```
This will cleanly terminate both the frontend and backend Node processes.

### Step 2: (Optional) Double-Check Port Status
If a server process ever gets stuck in the background and prevents you from restarting the project, you can verify if ports are clear by running:
```bash
# Check if anything is still listening on port 5050 (Frontend) or 8000 (Backend)
lsof -i :5050
lsof -i :8000
```
If a process is still running, you can kill it by using:
```bash
kill -9 <PID>
```
*(Replace `<PID>` with the process ID returned from the `lsof` command).*

---

## Helpful Commands Reference

| Action | Command | Target Directory | Description |
|---|---|---|---|
| **Start Dev Mode** | `npm run dev` | Project Root | Runs both frontend and backend concurrently |
| **Stop Dev Mode** | `Ctrl + C` | Active Terminal | Stops all dev servers |
| **Run Migrations** | `npm run migration:run` | `backend/` | Syncs the database schema with Supabase |
| **Production Build** | `npm run build` | Project Root | Generates optimized production assets |
