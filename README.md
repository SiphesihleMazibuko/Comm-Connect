# 📱 Comm-Connect

> **Connecting communities. Improving communication. Responding when it matters.**

Comm-Connect is a community-focused mobile application designed to improve communication, safety, incident reporting, emergency assistance, and access to community information.

The application connects **residents, community leaders, and emergency responders** through a centralised digital platform.

---

## 🎯 Project Overview

Many communities rely on fragmented communication channels when reporting incidents, requesting assistance, or sharing important community information.

Comm-Connect aims to provide a centralised platform where community members can:

* Report incidents
* Request emergency assistance
* Receive community updates
* Communicate with their community
* Access location-based information
* Provide and receive emergency support

The application uses a location hierarchy of:

**Province → City → Suburb → Ward**

This allows information and reports to be relevant to a user's specific community.

---

## ✨ Key Features

### 🔐 Authentication

* Phone number registration
* OTP-based authentication
* Supabase Authentication
* Role-based access

### 🏘️ Community

* Ward-based community feed
* Community announcements
* Real-time community updates
* Location-specific information

### 🚨 Emergency Services

* Emergency requests
* Emergency dispatch management
* Emergency responder dashboard
* Request tracking

### 🚔 Incident Reporting

* Report incidents
* Crime reporting
* Upload images with reports
* Community leader review and approval
* Ward-based incident management

### 📍 PinPoint

* Digital community addresses
* Location-based information
* PinPoint support for emergency communication

### 📶 Offline Support

The application includes offline functionality to allow selected features to remain accessible when internet connectivity is limited.

---

## 👥 User Roles

### 👤 Resident

Residents can:

* Access their community feed
* Submit incident reports
* Request emergency assistance
* View community information
* Use PinPoint digital addresses

### 🏘️ Community Leader

Community leaders can:

* Review community reports
* Approve or manage reports
* Monitor incidents within their ward
* Assist with community communication

### 🚑 Emergency Responder

Emergency responders can:

* Receive emergency requests
* View emergency information
* Respond to emergency requests
* Manage emergency dispatches
* Access the responder dashboard

---

## 🛠️ Technologies Used

### Frontend

* React Native
* Expo
* JavaScript
* Expo Router

### Backend

* Supabase
* PostgreSQL
* Supabase Authentication
* Supabase Storage
* Supabase Realtime

### APIs & Services

* Twilio / SMS OTP services
* REST Countries API
* Other third-party services used by the application

### Development Tools

* Visual Studio Code
* Git
* GitHub
* Expo Go
* EAS Build

---

## 🗄️ Database

Comm-Connect uses Supabase for its backend database and authentication services.

The application uses tables including:

```text
users
posts
pinpoints
reports
emergencyRequests
emergency_dispatches
```

Row Level Security (RLS) should be enabled on database tables to ensure that users can only access information permitted by the application's access-control rules.

The database schema is located in:

```text
supabase/schema.sql
```

---

## 🔐 Supabase Configuration

The Supabase client is configured in:

```text
config/supabase.js
```

Create a `.env` file in the root directory of the project:

```env
EXPO_PUBLIC_SUPABASE_URL=your-project-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

The required values can be found in:

**Supabase Dashboard → Project Settings → API**

### ⚠️ Security

Never commit private credentials to GitHub.

Do **not** commit:

* `.env`
* Supabase `service_role` keys
* Supabase secret keys
* Twilio Auth Tokens
* Private API credentials

Make sure `.env` is included in `.gitignore`.

---

## 📲 Running the Application

### Prerequisites

Install the following:

* Node.js
* npm
* Expo
* Expo Go

### 1. Clone the repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
```

### 2. Open the project

```bash
cd Comm-Connect
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure environment variables

Create a `.env` file and add the required Supabase configuration.

### 5. Start Expo

```bash
npx expo start
```

The application can then be opened using **Expo Go** on a supported mobile device.

---

## 🤖 Android

An Android APK can be created using **Expo Application Services (EAS)**.

```bash
npx eas-cli build --platform android --profile preview
```

The preview profile generates an installable Android APK that can be distributed to testers.

The standalone Android application does **not** require VS Code, Metro, or the developer's computer to be running after installation.

---

## 🍎 iOS

During development, Comm-Connect can be tested on iPhone using **Expo Go**.

For standalone iOS distribution, the application is distributed through **Apple TestFlight**.

---

## 📸 Screenshots

Screenshots of the application are added in the test logs.

### Login
### Community Feed
### Emergency Request
### Incident Reporting
### PinPoint
### Profile
---

## 🏗️ Project Structure

```text
Comm-Connect
│
├── app/
│   ├── Authentication
│   ├── Community
│   ├── Emergency
│   ├── Incident Reporting
│   └── Profile
│
├── components/
│
├── config/
│   └── supabase.js
│
├── context/
│
├── assets/
│
├── supabase/
│   └── schema.sql
│
├── app.json
├── eas.json
├── package.json
└── README.md
```

---

## 🔄 Application Flow

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
Role-Based Application Features
  │
  ├── Community Feed
  ├── Incident Reports
  ├── Emergency Requests
  ├── Emergency Dispatch
  └── PinPoint
```

---

## 🚀 Future Enhancements

Future development may include:

* 🖼️ Image recognition
* 🌍 Translation services
* 🚗 Transportation integration
* 💱 Currency conversion
* 🗺️ Advanced offline maps
* 🚑 Additional emergency service integrations
* 📊 Community analytics
* 🔔 Enhanced push notifications
* 🌐 Public production deployment
* 📱 Google Play Store distribution

---

## 📌 Project Status

**Status: Active Development**

Comm-Connect is currently being developed and tested as a community-focused mobile application.

The Android version can be distributed to testers as an APK, while the iOS version can currently be tested through Expo Go.

---

## 👨‍💻 Development Team

### Undiscovered

Comm-Connect is being developed by the **Undiscovered** development team as part of an academic software development project.

---

## 📄 Disclaimer

Comm-Connect is an academic software development project and is currently intended for development, testing, and demonstration purposes. MVP

---

## © 2026 Comm-Connect

Developed by **Undiscovered**.
