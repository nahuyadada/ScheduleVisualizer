# Schedule Visualizer

A modern web app to visualize and manage class schedules.

## Features

- 📋 Paste schedule text from your school portal
- ✏️ Manual course entry
- 📊 Visual weekly schedule grid
- 📂 Save multiple schedules
- 🔄 Compare schedules side-by-side
- ✨ Build new schedules by drag & drop
- 📤 Export/Import schedules to share with friends

## Getting Started

1. Open `index.html` in your browser (double-click or use a local server)
2. Paste your schedule or enter courses manually
3. Click "Visualize Schedule" to see your weekly view

## Project Structure

```
ScheduleVisualizer/
├── index.html          # Main page
├── builder.html        # Build new schedule page
├── compare.html        # Compare schedules page
├── README.md
├── css/
│   ├── styles.css      # Global styles
│   ├── builder.css     # Builder page styles
│   └── compare.css     # Compare page styles
├── js/
│   ├── app.js          # Main page logic
│   ├── builder.js      # Builder page logic
│   └── compare.js      # Compare page logic
└── assets/
    └── EXAMPLE.gif     # Tutorial animation
```

## Development

No build step required. Edit the files and refresh the browser.

### Running Locally

Option 1: Simply open `index.html` in your browser

Option 2: Use a local server (recommended):
```bash
# Python
python -m http.server 8000

# Node.js
npx serve
```

## Author

Christian Andrey Reyes
