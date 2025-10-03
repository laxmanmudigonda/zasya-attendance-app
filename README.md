Zasya Attendance Application
A simple, modern web application for Zasya employees and interns to mark their daily attendance. The application features a secure login system and a dedicated admin panel for management to view comprehensive attendance reports.

✨ Features
User Authentication: Secure login system for all personnel.

First-time users are prompted to create a secure password.

"Forgot Password" functionality allows users to reset their password via email.

Daily Attendance Marking: Simple interface for employees and interns to mark themselves as "Present" or "Absent".

Admin Dashboard: A private dashboard accessible only to the CEO (Varaprasad Mudigonda).

Comprehensive Reporting: The admin dashboard provides a summary of:

Total working days in the current month.

Number of days each person was present.

Days Missed: Highlights working days where a user did not mark their attendance.

Total paid leaves taken in the current year.

Remaining paid leaves for the year.

Detailed Monthly View: The admin can click on any user in the dashboard to see a full calendar view of their attendance for the current month.

💻 Technology Stack
Frontend: HTML5, CSS3, JavaScript (ES6+)

Backend: Google Firebase

Firebase Authentication: For managing user accounts, logins, and password resets.

Cloud Firestore: A NoSQL database used to store all user and attendance data in real-time.

Deployment: Can be hosted on any static web hosting service (e.g., Netlify, GitHub Pages).

🚀 Setup and Installation
To get this project running on your local machine, follow these steps.

1. Prerequisites
A modern web browser (like Chrome or Firefox).

A code editor (like Visual Studio Code).

The Live Server extension for VS Code is highly recommended for local development.

2. Firebase Setup
This application requires a Firebase project to handle the backend.

Create a Firebase Project: Go to the Firebase Console and create a new project.

Add a Web App: In your project dashboard, add a new web application to get your unique configuration keys.

Enable Authentication: Go to the Authentication tab, click "Get started," and enable the Email/Password sign-in provider.

Authorize Domain: In Authentication settings, add 127.0.0.1 to the list of authorized domains for local testing.

Create Firestore Database: Go to the Firestore Database tab and create a new database. Start in test mode for initial setup.

Enable APIs: Ensure both the Identity Toolkit API and the Cloud Firestore API are enabled in your Google Cloud project settings.

3. Project Configuration
Clone the Repository or download the project files.

Add Firebase Config: Open the script.js file. At the top, you will find a firebaseConfig object. Paste your unique keys from the Firebase console here.

4. Running Locally
Open the project folder in Visual Studio Code.

Right-click on the index.html file and select "Open with Live Server," or click the "Go Live" button in the bottom-right corner.

The application will open in your browser at an address like http://127.0.0.1:5500.

🌐 Deployment
This app can be deployed to any static hosting service. The easiest way is with Netlify:

Log in to your Netlify account.

Drag and drop your project folder (containing index.html, style.css, script.js, and logo.png) into the deployment area.

Netlify will provide you with a live URL for your application.
