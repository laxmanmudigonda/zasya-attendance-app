# Zasya Attendance

![Zasya logo](logo.png)

Zasya Attendance is a browser-based attendance and leave-management application for Zasya employees and interns. It uses Firebase Authentication for user accounts, Cloud Firestore for attendance data, and Firebase Hosting for deployment.

The application has no custom server. The browser communicates directly with Firebase, while Firestore Security Rules enforce access to employee and administrative data.

## Features

- Email and password authentication using a company-name login format.
- First-time password creation for configured employees and interns.
- Password-reset emails through Firebase Authentication.
- Daily Present or Absent attendance marking with punch-in time.
- Leave requests with a date and optional reason.
- A ten-minute inactivity timeout for authenticated sessions.
- CEO attendance confirmation before opening the admin dashboard.
- Monthly attendance totals, missed days, annual leave usage, and remaining leave.
- A per-user monthly calendar with attendance details.
- Administrative approval or denial of pending leave requests.
- Responsive layout for desktop and mobile browsers.

## How the application works

Each configured person's email is generated from their name by removing spaces and appending `@zasya.online`. For example, `Laxman Mudigonda` becomes `laxmanmudigonda@zasya.online`.

Firebase Authentication owns the login credential. The matching document in `users/{uid}` stores the employee's name, email, role, and an attendance map indexed by local calendar date. Leave applications are stored as separate documents in the `leave-requests` collection.

The CEO account is identified by both its configured name and authenticated email. Firestore rules separately enforce administrative access on the Firebase side.

## Project structure

- `index.html` contains the login, attendance, admin, calendar, password-reset, and leave-request interfaces.
- `style.css` defines the responsive presentation.
- `config.js` is the central source for Firebase settings, personnel, holidays, leave allowance, and session duration.
- `script.js` contains authentication, attendance, leave, session, and dashboard behavior.
- `firestore.rules` restricts Firestore data to approved accounts and administrative operations.
- `firebase.json` configures Firestore rules and Firebase Hosting.
- `.firebaserc` selects the Firebase project.
- `scripts/validate.js` checks project structure, configuration consistency, and HTML/JavaScript wiring.

## Requirements

- Node.js 20 or newer.
- A Firebase account with access to the `zasya-attendance-app` project.
- Email/Password sign-in enabled in Firebase Authentication.
- A Cloud Firestore database in Native mode.

The Firebase CLI is run through `npx`, so a global installation is optional.

## Local setup

Clone the repository and enter the project directory:

```bash
git clone https://github.com/laxmanmudigonda/zasya-attendance-app.git
cd zasya-attendance-app
```

Validate the project:

```bash
npm run check
```

Sign in to Firebase when setting up a new development machine:

```bash
npx firebase-tools login
```

Deploy the Firestore rules:

```bash
npm run deploy:rules
```

Start the local Firebase Hosting emulator:

```bash
npm run dev
```

Open the local URL printed by the Firebase CLI. Do not open `index.html` directly through a `file://` URL.

## Firebase configuration

### Authentication

In Firebase Console, open Authentication and enable the Email/Password provider.

Under Authentication settings, add every hostname used to serve the app to Authorized domains. Local development commonly uses `localhost` or `127.0.0.1`. Production uses the Firebase Hosting domain or the application's custom domain.

### Firestore

The repository includes rules that support the application's current data flows:

- Approved employees may create, read, and update their own profile.
- Employees may submit leave requests for their own authenticated user ID.
- Only the configured CEO email may read all profiles or process leave requests.
- Public and unapproved-account access is denied.

Deploy rule changes with `npm run deploy:rules`. Rules maintained only in Firebase Console can be overwritten by a CLI deployment, so keep the repository version authoritative.

### Application settings

Edit `config.js` to change:

- Firebase web-app identifiers.
- Company email domain.
- CEO name and role.
- Employee and intern lists.
- Annual paid-leave allowance.
- National holidays.
- Session timeout duration.

When adding or removing personnel, update the email allowlist in `firestore.rules` as well. `npm run check` detects configured people who are missing from the rules.

Firebase web configuration values identify the Firebase project; they are not server credentials. Access control belongs in Authentication, Firestore Security Rules, and optional Firebase App Check enforcement.

## Data model

A user document follows this shape:

```text
users/{uid}
  name: "Laxman Mudigonda"
  email: "laxmanmudigonda@zasya.online"
  role: "Employee"
  attendance:
    2026-10-01:
      status: "Present"
      time: "09:30 AM"
```

A leave request follows this shape:

```text
leave-requests/{requestId}
  userId: "firebase-auth-uid"
  userName: "Laxman Mudigonda"
  date: "2026-10-10"
  reason: "Personal work"
  status: "pending"
```

Approving a leave request atomically changes its status to `approved` and writes an Absent record for the requested date.

## Available commands

- `npm run check` checks JavaScript syntax and validates project configuration.
- `npm run dev` starts the Firebase Hosting emulator.
- `npm run deploy:rules` deploys only Firestore Security Rules.
- `npm run deploy:hosting` deploys only the website.
- `npm run deploy` deploys both the rules and website.

## Deployment

Run validation before every deployment:

```bash
npm run check
npm run deploy
```

Firebase Hosting publishes only the browser assets. Documentation, rules, local Firebase data, Git files, and development scripts are excluded by `firebase.json`.

## Troubleshooting

### The login page appears, but login fails

Confirm that Email/Password authentication is enabled, the account exists, and the current hostname is in Authorized domains. Network failures and credential failures are displayed separately in the login form.

### A first-time user cannot create a password

Confirm that the person's name exists in `config.js`, their generated email is listed in `firestore.rules`, and the latest rules are deployed. If Authentication already contains that email, use the normal login or password-reset flow.

### Attendance or leave requests cannot be saved

Deploy the current rules with `npm run deploy:rules`, confirm the signed-in user's Firestore profile has the same email as their Authentication account, and inspect the browser console for the Firebase error code.

### The admin dashboard does not load

The authenticated account must use the configured CEO email and its profile name must match the configured CEO name. The account also needs permission under the deployed Firestore rules.

### Firebase libraries do not load

The page loads Firebase from Google's CDN. Check the network connection, content blocker, corporate firewall, and browser console. The login page displays a startup error when the SDK is unavailable.

## Security considerations

The current first-time flow lets an unclaimed, allowlisted employee identity create its initial password. For use beyond a trusted internal rollout, pre-provision Authentication accounts or replace self-registration with an administrator-controlled invitation flow.

Keep personnel changes synchronized between `config.js` and `firestore.rules`. Review and test rules before deployment because deploying the repository rules replaces the active Firestore ruleset.

## License

This project is distributed under the [MIT License](LICENSE).
