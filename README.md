# 📱 Comm-Connect

> **Connecting communities. Improving communication. Responding when it matters.**

Comm-Connect is a community-focused mobile application designed to improve communication, safety, incident reporting, emergency assistance, and access to community information.

The application connects **residents, community leaders, and emergency responders** through a centralised digital platform.

---

# 🎯 Project Overview

Many communities rely on fragmented communication channels when reporting incidents, requesting assistance, or sharing important community information.

Comm-Connect provides a centralised platform where community members can:

* Report incidents
* Request emergency assistance
* Receive community updates
* Communicate with their community
* Access location-based information
* Use digital community addresses
* Find community support services

The application uses a location hierarchy:

**Province → City → Suburb → Ward**

This allows information and reports to be associated with the user's relevant community.

---

# 🚀 Sprint 9–10 Release

**Release:** `Sprint-9-Security-Evaluation`

**Release commit:** `fa85710`

**Release branch:** `main`

**Testing branch:** `Testing`

The Sprint 9–10 release focuses on system evaluation, security readiness, usability improvements, bug resolution and verified improvements to the application.

### Sprint 9–10 Changes

The main changes included:

* Added the new **Help Near You** feature.
* Improved the community feed experience.
* Removed unnecessary/repeated Crime Alert content.
* Updated the resident home-screen greeting.
* Improved the shared `ScreenHeader` implementation.
* Fixed a navigation/header issue where an unwanted white area could reappear after returning to a screen.
* Improved incident-report validation and user feedback.
* Improved incident-report location error handling.
* Added/updated South African language translations.
* Added language selection improvements.
* Continued refinement of community leader and emergency responder experiences.

### New Feature: Help Near You

**Help Near You is new Sprint 9–10 functionality and is not a bug fix.**

The feature allows users to search for useful community support services and information.

Examples may include:

* Therapists
* Psychologists
* Community centres
* Community support services
* Services available at specific locations or on specific days

The purpose is to make useful community assistance easier for residents to discover.

---

# 🔐 Key Features

## Authentication

* Phone number registration
* OTP-based authentication
* Supabase Authentication
* Role-based access
* Persistent authentication sessions

## 🏘️ Community

* Ward-based community feed
* Community announcements
* Community updates
* Location-specific information
* Community communication

## 🚨 Emergency Services

* Emergency requests
* Emergency request tracking
* Emergency dispatch management
* Emergency responder dashboard
* Emergency responder workflow
* SOS functionality

## 🚔 Incident Reporting

* Incident reporting
* Crime reporting
* Incident descriptions
* Location information
* Image uploads where supported
* Community leader review
* Ward-based incident management

## 📍 PinPoint

PinPoint provides digital community addresses and supports location-based communication.

Users can:

* Generate a PinPoint address
* Save and manage their address
* Scan QR information
* Use location information for navigation
* Provide location information during emergency communication

## 🆘 Help Near You

Help Near You provides access to community-support information and allows users to search for relevant services.

## 🌍 Language Support

The application includes South African language translations and language-selection functionality.

## 📶 Connectivity

Selected application functionality has been designed with limited connectivity in mind. However, cloud-based functionality remains dependent on network availability.

---

# 👥 User Roles

## 👤 Resident

Residents can:

* Access their community feed
* Submit incident reports
* Request emergency assistance
* Use SOS functionality
* View community information
* Generate and manage PinPoint addresses
* Scan QR information
* Access Help Near You
* Select supported languages

## 🏘️ Community Leader

Community leaders can:

* Access their community feed
* Review community reports
* Approve or manage reports
* Monitor incidents within their ward
* Assist with community communication

## 🚑 Emergency Responder

Emergency responders can:

* Receive emergency requests
* View emergency information
* Respond to emergency requests
* Manage emergency dispatches
* Use the responder dashboard
* Manage responder availability where supported

---

# 🛠️ Technologies Used

## Frontend

* React Native
* Expo
* JavaScript / JSX
* Expo Router

## Backend

* Supabase
* PostgreSQL
* Supabase Authentication
* Supabase Storage
* Supabase Realtime

## APIs and Services

* Twilio / SMS OTP services
* Location and geocoding services
* Mapping/navigation services
* Other third-party services required by the application

## Development Tools

* Visual Studio Code
* Git
* GitHub
* Expo Go
* EAS Build
* Node.js
* ESLint

---

# 🗄️ Database

Comm-Connect uses Supabase and PostgreSQL for its backend database and authentication services.

The application uses database structures including:

```text
users
posts
pinpoints
reports
emergencyRequests
emergency_dispatches
```

Row Level Security (RLS) is used where configured to control access to database records according to application permissions.

The database schema is maintained in:

```text
supabase/schema.sql
```

---

# 🔐 Security and Configuration

Supabase configuration is maintained in:

```text
config/supabase.js
```

Environment variables are used for project configuration.

Create a `.env` file in the root directory:

```env
EXPO_PUBLIC_SUPABASE_URL=your-project-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

The required values are available through the Supabase project configuration.

## ⚠️ Security Requirements

Private credentials must never be committed to GitHub.

Do not commit:

* `.env`
* Supabase service-role keys
* Supabase secret keys
* Twilio Auth Tokens
* Private API credentials
* Other sensitive credentials

The `.env` file should be included in `.gitignore`.

Test accounts should be used for evaluation wherever possible.

---

# 📲 Running the Application

## Prerequisites

Install:

* Node.js
* npm
* Expo
* Expo Go

## 1. Clone the repository

```bash
git clone https://github.com/SiphesihleMazibuko/Comm-Connect.git
```

## 2. Open the project

```bash
cd Comm-Connect
```

## 3. Install dependencies

```bash
npm install
```

## 4. Configure environment variables

Create the `.env` file and add the required Supabase configuration.

## 5. Start Expo

```bash
npx expo start
```

The application can then be opened using Expo Go on a supported mobile device.

---

# 🤖 Android Installation

An installable Android build can be generated using **Expo Application Services (EAS)**.

For example:

```bash
npx eas-cli build --platform android --profile preview
```

The preview profile is configured to produce an installable Android build for testing.

Once an APK has been installed, the standalone application does not require Visual Studio Code, Metro or the developer's computer to remain running.

---

# 🍎 iOS

During development, Comm-Connect can be tested on iPhone using Expo Go.

Standalone iOS distribution requires the appropriate Apple distribution configuration and can be distributed through TestFlight where configured.

---

# 🔄 Application Flow

```text
User
  ↓
Phone OTP Authentication
  ↓
Role Identification
  ↓
Province
  ↓
City
  ↓
Suburb
  ↓
Ward
  ↓
Role-Based Features
  │
  ├── Community Feed
  ├── Incident Reports
  ├── Emergency Requests
  ├── Emergency Dispatch
  ├── PinPoint
  └── Help Near You
```

---

# 🧪 Testing and Evaluation

The Sprint 9–10 release is identified by:

```text
Sprint-9-Security-Evaluation
```

The release commit is:

```text
fa85710
```

Testing should be performed against the **Sprint-9-Security-Evaluation** release so that the evaluated version can be traced back to a stable Git commit.

Evaluation should use dedicated test accounts representing the supported roles:

* Resident
* Community Leader
* Emergency Responder

Testers should avoid entering unnecessary real personal information.

Detailed security testing, usability evaluation, participant results, metrics and regression results are documented separately in the Sprint 9–10 Security Review and System Evaluation report.

---

# 🐛 Updated Bug Register

The main issues addressed during development include:

| ID     | Issue                                     | Severity | Status      |
| ------ | ----------------------------------------- | -------- | ----------- |
| BUG-01 | Incorrect SOS location URL                | High     | Fixed       |
| BUG-02 | Incident-report validation                | High     | Fixed       |
| BUG-03 | Incident description validation           | Medium   | Fixed       |
| BUG-04 | Missing incident-report location handling | Medium   | Fixed       |
| BUG-05 | Repeated Crime Alert content              | Medium   | Fixed       |
| BUG-06 | Resident home greeting                    | Low      | Fixed       |
| BUG-07 | White area appearing after navigation     | Medium   | Fixed       |
| BUG-08 | Language support and selection            | Medium   | Implemented |

These issues were addressed through changes made during the relevant development sprints.

---

# ⚠️ Known Limitations

### Internet Connectivity

Several cloud-based functions require an active internet connection. Network interruptions may affect authentication, database operations and other online functionality.

### OTP/SMS Services

Phone authentication depends on the availability and configuration of the authentication and SMS services.

### Location and Mapping Services

Location, geocoding and navigation functionality may depend on external services and may therefore be affected by service availability or network conditions.

### External Services

Third-party services used by the application may have availability limits, configuration requirements or service interruptions.

### Help Near You

Help Near You provides configured community-service information. It should not be considered a complete real-time directory of every available service.

### Offline Functionality

Selected functionality supports limited-connectivity scenarios, but full offline synchronisation across the entire application remains future work.

### Test Data

The application is currently intended for development, testing and academic demonstration. Test accounts and appropriate test data should be used during evaluation.

---

# 📋 Sprint 10 Backlog

| ID    | Backlog Item                                                       | Priority |
| ----- | ------------------------------------------------------------------ | -------- |
| BL-01 | Expand Help Near You with more verified community services         | Medium   |
| BL-02 | Add authorised management of Help Near You information             | Medium   |
| BL-03 | Improve offline synchronisation                                    | Medium   |
| BL-04 | Expand automated security regression testing                       | High     |
| BL-05 | Improve audit and monitoring while minimising personal information | Medium   |
| BL-06 | Continue usability improvements based on evaluation findings       | Medium   |

---

# 🚀 Future Enhancements

Possible future enhancements include:

* Advanced offline maps
* Additional emergency-service integrations
* Community analytics
* Enhanced push notifications
* Additional verified community services
* Improved offline synchronisation
* Public production deployment
* Google Play Store distribution
* Additional accessibility and usability improvements

---

# 📌 Project Status

**Status: Active Development and Evaluation**

Comm-Connect is currently being developed, tested and evaluated as a community-focused mobile application.

The Sprint 9–10 evaluation version is identified by:

**`Sprint-9-Security-Evaluation`**

**Commit:** `fa85710`

---

# 👨‍💻 Development Team

## Undiscovered

Comm-Connect is being developed by the **Undiscovered** development team as part of an academic software development project.

### Group Members

* MAZIBUKO S — 222223517
* MADISHA RK — 218031586
* MONYEKI TL — 223159406
* LEKOTA FM — 218021837
* MSIMANGO N — 222090967
* MOLOI M — 200801553
* MAILA P — 221086184

---

# 📄 Disclaimer

Comm-Connect is an academic software development project intended for development, testing, evaluation and demonstration purposes.

The application should not currently be treated as a fully operational public emergency-response platform. Emergency and community information should be verified through appropriate official services where necessary.

---

# © 2026 Comm-Connect

Developed by **Undiscovered**.
