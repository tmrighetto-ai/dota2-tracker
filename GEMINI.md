# GEMINI.md

## Project Overview

This project is a React-based web application client, structured as a single-page application (SPA). It was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

The codebase is contained entirely within the `client/` directory.

## Architecture & Technologies

*   **Framework:** React
*   **Build Tool:** React Scripts (Webpack/Babel under the hood via CRA)
*   **Testing:** Jest & React Testing Library
*   **State Management:** (To be determined - currently standard React state)
*   **Routing:** (To be determined - check for `react-router-dom`)

## Key Directories

*   `client/src/`: Source code for the React application.
    *   `App.js`: Main application component.
    *   `index.js`: Entry point.
*   `client/public/`: Static assets (HTML, images, etc.).
*   `client/build/`: Production build output (created after running build script).

## Development Workflow

All commands must be run from the `client/` directory.

### Installation

```bash
cd client
npm install
```

### Running the Development Server

Runs the app in development mode. Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

```bash
cd client
npm start
```

### Testing

Launches the test runner in interactive watch mode.

```bash
cd client
npm test
```

### Building for Production

Builds the app for production to the `build` folder. It correctly bundles React in production mode and optimizes the build for the best performance.

```bash
cd client
npm run build
```

## Configuration

*   **Environment Variables:** Create a `.env` file in the `client/` directory for environment-specific configurations (e.g., API endpoints). Prefix variables with `REACT_APP_`.
*   **Manifest:** `client/public/manifest.json` handles PWA configuration.
