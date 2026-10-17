# ChatWave — Web Messenger

A real-time web messaging application built with modern web technologies, designed to provide a clean user experience for connecting with people and managing conversations.

## 🚀 Project Overview

**ChatWave** is a full-stack messaging application with a React-based frontend and an Express backend. The project uses Socket.IO for real-time communication and MongoDB for data persistence.

The application is being developed with a focus on reliable user discovery, conversation management, and a responsive messaging experience.

## ✨ Features

### Current Project Capabilities

- **User Accounts** — User data managed through the backend and MongoDB.
- **User Discovery** — Find registered users using their user ID or email address.
- **Conversation Management** — Create and retrieve conversations between users.
- **Real-Time Communication Infrastructure** — Socket.IO integration in the backend.
- **Persistent Storage** — MongoDB integration through Mongoose.
- **Modern Frontend** — React and Vite for development and production builds.
- **REST API** — Express-based backend API.
- **Duplicate Conversation Handling** — Conversation creation logic designed to handle existing conversations and duplicate-key conflicts.

> Feature availability and completeness may vary as development continues.

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React |
| Build Tool | Vite |
| Backend | Node.js |
| API Framework | Express |
| Real-Time Communication | Socket.IO |
| Database | MongoDB |
| Database ODM | Mongoose |
| Code Quality | ESLint |
| Version Control | Git and GitHub |

## 📁 Project Structure

```text
chatwave-web-messenger/
├── backend/
│   └── src/
│       ├── controllers/
│       │   └── conversation.controller.js
│       └── models/
│           ├── Conversation.js
│           └── User.js
├── src/
│   └── ... frontend source files
├── public/
├── package.json
├── README.md
└── ... configuration files
```

*The structure above highlights key files currently involved in the project. Other application files and folders may also be present.*

## ⚙️ Getting Started

### Prerequisites

Install the following before running the application:

- [Node.js](https://nodejs.org/) — use a version compatible with the project dependencies.
- npm — included with Node.js.
- A MongoDB database, local or hosted.
- Git.

### 1. Clone the Repository

```bash
git clone https://github.com/Prashantspatil3952/chatwave-web-messenger.git
cd chatwave-web-messenger
```

### 2. Install Frontend Dependencies

From the project root:

```bash
npm install
```

### 3. Configure the Backend

Navigate to the backend directory:

```bash
cd backend
npm install
```

Create a `.env` file in the backend directory using the environment variables expected by the backend configuration.

Example configuration:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
```

Add any additional environment variables required by your implementation, such as authentication secrets or frontend origin settings.

**Security:** Never commit `.env` files, database credentials, access tokens, or private secrets to GitHub.

### 4. Start the Backend

From the `backend` directory, run:

```bash
npm run dev
```

The backend is expected to run on port `5000` when configured with the default port.

### 5. Start the Frontend

Open a separate terminal at the project root:

```bash
npm run dev
```

Vite normally serves the frontend at:

[http://localhost:5173](http://localhost:5173)

If the terminal displays a different local URL, use that URL instead.

## 🧪 Validation

The following frontend checks have been run successfully during development:

```bash
npm run lint
npm run build
```

- **Lint:** Passed.
- **Production build:** Passed.

The backend has also been started successfully, and its MongoDB connection has been confirmed.

The user-discovery and conversation-creation flow should be tested in the running application after the latest database index cleanup and controller changes. These flows are not marked as fully verified here.

## 🗃️ Database Notes

ChatWave uses MongoDB to store application data, including users and conversations.

The conversation model includes a `directKey` field for identifying direct conversations. During development, an obsolete unique `participantKey` index was identified in the existing database and removed to address duplicate-key conflicts.

Database indexes may differ between existing databases and fresh installations. Review the model definitions and index configuration before deploying to production.

## 🔐 Security Considerations

Before deploying ChatWave publicly:

- Keep credentials and secrets in environment variables.
- Ensure `.env` files are excluded from version control.
- Validate and sanitize user input on the backend.
- Apply appropriate authentication and authorization to API endpoints.
- Configure CORS for trusted frontend origins.
- Add rate limiting and suitable error handling.
- Use HTTPS in production.
- Protect private conversations and user information from unauthorized access.

## 🗺️ Development Roadmap

Potential next steps include:

- [ ] Verify user search using valid user IDs and email addresses.
- [ ] Test creating conversations between two registered users.
- [ ] Confirm that reopening an existing conversation does not create duplicates.
- [ ] Test real-time messaging between two users.
- [ ] Verify authentication and authorization flows.
- [ ] Test error handling and expired or missing authentication.
- [ ] Improve responsive layouts and accessibility.
- [ ] Prepare production environment configuration and deployment.

## 🤝 Contributing

Contributions, bug reports, and suggestions are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Make your changes and test them.
4. Commit your changes with a descriptive message.
5. Open a pull request.

## 📄 License

No license has been specified in this README. Add a `LICENSE` file and update this section if you intend to distribute the project under a particular open-source license.

## 👨‍💻 Author

**Prashant Patil**

GitHub: [@Prashantspatil3952](https://github.com/Prashantspatil3952)

---

*ChatWave — Connect, communicate, and keep the conversation going.*