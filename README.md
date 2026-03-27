# ⚡ Resty Flow - The Free & Powerful API Ecosystem

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Version: 2.0](https://img.shields.io/badge/Version-2.0-success.svg)
![Built With: AutoDev](https://img.shields.io/badge/Built%20With-AutoDev-purple.svg)

**Resty Flow** is a comprehensive, open-source API testing and collaboration platform designed as a robust alternative to tools like Postman or Insomnia. 

Going beyond a standard API Client, Resty Flow combines **Visual API Automation**, **Performance Load Testing**, **Smart Mock Servers**, and **Localhost Tunneling** into a single, unified collaborative workspace.

> 🤖 **Mind-Blowing Fact:** This entire application (React Frontend, Node.js Backend, MariaDB Database, and Golang Local Agent) was built from scratch in **under 30 minutes** using zero manual coding. It was generated entirely through natural language prompts via [AutoDev](https://autodev.asiahub.id).

🌐 **Live Demo:** [https://resty-flow.asiahub.id](https://resty-flow.asiahub.id)

---

## ✨ Key Features

- 🚀 **Advanced API Requests:** Full support for RESTful methods, dynamic Environment Variables, custom Headers, multiple Body types (JSON, Form-Data, Url-Encoded), and Pre/Post-request scripts.
- 🕸️ **Visual Scenario Builder:** Chain dozens of API endpoints into a single end-to-end (E2E) automation flow using an intuitive, drag-and-drop node-based editor.
- 📈 **Performance Load Testing:** Conduct stress tests without external tools. Simulate thousands of Concurrent Virtual Users (VUs), configure Spawn Rates, and get real-time Response Time metrics (Avg, Min, Max, P95). Exportable to Excel!
- 🚇 **Local Agent Tunneling:** Test your `localhost` APIs directly from the cloud without using Ngrok! Our lightweight Golang agent creates a secure WebSocket tunnel instantly. Perfect for testing Webhooks.
- 🎭 **Smart Mock Servers:** Create instant mock endpoints for your frontend teams so the development cycle never stops.
- 👥 **Real-Time Collaboration:** Create Workspaces, organize APIs into folders, and invite your team to collaborate without any quota limits.

---

## 🛠️ Tech Stack

- **Frontend:** React.js 18, Vite, Tailwind CSS, React Router.
- **Backend:** Node.js, Express.js, WebSocket (`ws`), JWT Authentication.
- **Database:** MariaDB 10.11
- **Local Agent Tunneling:** Golang (Go) & Gorilla WebSocket.
- **Infrastructure:** Docker & Docker Compose.

---

## 🚀 Quick Start (Local Deployment)

The easiest way to run Resty Flow locally is by using **Docker Compose**. Make sure you have [Docker](https://www.docker.com/) installed on your machine.

1. **Clone the Repository:**
   ```bash
   git clone git@github.com:ahdianrawuli/rest-flow.git
   cd resty-flow

 * Run with Docker Compose:
   docker-compose up -d --build

 * Access the Application:
   * Open your browser and visit: http://localhost:80 (Or the port you mapped for the frontend).
   * The Backend API runs on http://localhost:5001.
   * The MariaDB Database runs on port 3306.
(Note: The database schema database.sql will be executed automatically when the database container is created for the first time).
🚇 Using the Local Agent (Golang)
To test a local endpoint (e.g., an API you are developing on port 8080 on your machine) using a cloud-hosted Resty Flow instance:
 * Get your Agent Token and WebSocket URL from the "Local Agent" menu in the Resty Flow dashboard.
 * Navigate to the agent directory:
   cd restflow-agent

 * Run the agent using Go:
   go run main.go

 * Enter the WebSocket URL and Token when prompted in the terminal. Now, all requests to localhost from Resty Flow will be securely tunneled to your machine!
🤝 Contributing
This is an Open Source project. If you find any bugs, have feature requests, or want to contribute, feel free to open an Issue or submit a Pull Request.
📄 License
Distributed under the MIT License. See the LICENSE file for more information.
Powered by AI, built for Developers. Take your team's productivity to the next level.

**Catatan:** Jangan lupa untuk mengganti tautan `https://github.com/your-username/resty-flow.git` pada langkah **Clone the Repository** dengan tautan repositori GitHub Anda yang sebenarnya ya!


