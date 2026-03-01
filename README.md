# Extracurricular Tracker (GitHub Pages)

Minimalist dark tracker for extracurriculars / volunteering.

**Features**
- Orgs cards (total hours, start date, end date; end date can be marked as **Present**)
- Org detail view (sortable/filterable activities + totals by type + "Mark as ongoing" toggle)
- Timeline view (chronological list)
- Add/Edit/Delete activities
- Login via Firebase Auth
- Data stored in Firestore

## 1) Create Firebase project
1. Firebase Console → Add project
2. Authentication → Sign-in method → enable **Email/Password**
3. Firestore Database → Create database (you can start in test mode, then lock down rules below)

## 2) Add a Web App + paste config
Project Settings → Your apps → Web app → copy config  
Paste into `firebase-config.js`.

## 3) Firestore security rules (IMPORTANT)
After you confirm it works, lock it down:

Firestore → Rules:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /activities/{docId} {
      allow create: if request.auth != null
        && request.resource.data.uid == request.auth.uid;

      allow read, update, delete: if request.auth != null
        && resource.data.uid == request.auth.uid;
    }

    match /orgSettings/{docId} {
      allow create: if request.auth != null
        && request.resource.data.uid == request.auth.uid;

      allow read, update, delete: if request.auth != null
        && resource.data.uid == request.auth.uid;
    }
  }
}
```

## 4) Deploy on GitHub Pages
1. Create repo, upload files (`index.html`, `styles.css`, `app.js`, `firebase-config.js`, `README.md`)
2. Repo Settings → Pages → Deploy from branch → `main` / root
3. Copy your Pages URL, then Firebase Console → Authentication → Settings → **Authorized domains**  
   Add your GitHub Pages domain (e.g. `YOURNAME.github.io`)

## Local testing
Because ES modules are used, open with a local server:
- VS Code “Live Server”, or
- `python3 -m http.server` then open http://localhost:8000
