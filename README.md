# Firebase Payroll Manager

A responsive weekly payroll web app using React, Vite, Firebase Realtime Database, Excel export, and PDF export.

## Included
- Add/delete employees and assign hourly rates
- Monday through Sunday clock-in/clock-out entry
- Break deductions, overnight shifts, automatic hours and gross pay
- Firebase Realtime Database storage
- Past payroll history with delete option
- Employee summary showing total hours and total earnings
- Excel and PDF exports
- GitHub Pages deployment workflow

## Required Firebase setup
1. In Firebase Console, open **Realtime Database** and create the database if it does not exist.
2. Copy the exact database URL and verify `databaseURL` in `src/firebase.js`.
3. Open Realtime Database → **Rules**, paste the contents of `database.rules.json`, and publish.

> The included rules allow public access for initial testing. Do not store real payroll data publicly. Add Firebase Authentication and authenticated admin-only rules before production use.

## Local development
```bash
npm install
npm run dev
```

## GitHub Pages
Open repository **Settings → Pages** and set **Source** to **GitHub Actions**. The deployment workflow will publish the site at the repository's GitHub Pages URL.
