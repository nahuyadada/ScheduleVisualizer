// Global state
let courses = [];
let selectedFile = null;
let savedSchedules = [];
let modalResolve = null;

// Custom confirmation modal
function showConfirmModal(message, title = 'Confirm', icon = '⚠️', confirmText = 'Confirm', isSuccess = false) {
    return new Promise((resolve) => {
        modalResolve = resolve;

        const modal = document.getElementById('confirmModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalMessage = document.getElementById('modalMessage');
        const modalIcon = document.getElementById('modalIcon');
        const confirmBtn = document.getElementById('modalConfirmBtn');
        const cancelBtn = document.getElementById('modalCancelBtn');

        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modalIcon.textContent = icon;
        confirmBtn.textContent = confirmText;

        if (isSuccess) {
            confirmBtn.classList.add('success');
        } else {
            confirmBtn.classList.remove('success');
        }

        modal.style.display = 'flex';

        // Handle confirm
        confirmBtn.onclick = () => {
            modal.style.display = 'none';
            resolve(true);
        };

        // Handle cancel
        cancelBtn.onclick = () => {
            modal.style.display = 'none';
            resolve(false);
        };

        // Handle click outside
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                resolve(false);
            }
        };

        // Handle escape key
        document.onkeydown = (e) => {
            if (e.key === 'Escape' && modal.style.display === 'flex') {
                modal.style.display = 'none';
                resolve(false);
            }
        };
    });
}

// Color palette for courses
const courseColors = [
    'color-1', 'color-2', 'color-3', 'color-4', 'color-5',
    'color-6', 'color-7', 'color-8', 'color-9', 'color-10'
];

// Day mapping
const dayMap = {
    'M': 'Monday',
    'T': 'Tuesday',
    'W': 'Wednesday',
    'TH': 'Thursday',
    'F': 'Friday',
    'S': 'Saturday',
    'SU': 'Sunday'
};

const dayIndexMap = {
    'Monday': 1,
    'Tuesday': 2,
    'Wednesday': 3,
    'Thursday': 4,
    'Friday': 5,
    'Saturday': 6,
    'Sunday': 7
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupDragAndDrop();
    setupFileInput();
    loadFromStorage();
    loadSavedSchedules();
});

// Drag and Drop functionality
function setupDragAndDrop() {
    const uploadArea = document.getElementById('uploadArea');
    if (!uploadArea) return; // Element was removed
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.classList.remove('dragover');
        }, false);
    });

    uploadArea.addEventListener('drop', handleDrop, false);
    uploadArea.addEventListener('click', () => {
        document.getElementById('imageInput').click();
    });
}

function setupFileInput() {
    const imageInput = document.getElementById('imageInput');
    if (imageInput) {
        imageInput.addEventListener('change', handleFileSelect);
    }
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

function handleFile(file) {
    if (!file.type.startsWith('image/')) {
        showToast('Please upload an image file', 'error');
        return;
    }

    selectedFile = file;
    const reader = new FileReader();

    reader.onload = (e) => {
        const previewContainer = document.getElementById('previewContainer');
        const previewImage = document.getElementById('previewImage');
        const uploadArea = document.getElementById('uploadArea');

        previewImage.src = e.target.result;
        previewContainer.style.display = 'block';
        uploadArea.style.display = 'none';
        document.getElementById('processBtn').disabled = false;
    };

    reader.readAsDataURL(file);
}

function removeImage() {
    selectedFile = null;
    const previewContainer = document.getElementById('previewContainer');
    const uploadArea = document.getElementById('uploadArea');

    previewContainer.style.display = 'none';
    uploadArea.style.display = 'block';
    document.getElementById('processBtn').disabled = true;
    document.getElementById('imageInput').value = '';
}

// OCR Processing
async function processImage() {
    if (!selectedFile) {
        showToast('Please upload an image first', 'error');
        return;
    }

    const progressContainer = document.getElementById('progressContainer');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const processBtn = document.getElementById('processBtn');

    progressContainer.style.display = 'block';
    processBtn.disabled = true;
    document.getElementById('processBtnText').textContent = 'Processing...';

    try {
        const result = await Tesseract.recognize(
            selectedFile,
            'eng',
            {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        const progress = Math.round(m.progress * 100);
                        progressFill.style.width = `${progress}%`;
                        progressText.textContent = `Recognizing text... ${progress}%`;
                    }
                }
            }
        );

        progressText.textContent = 'Parsing schedule data...';
        const extractedCourses = parseScheduleText(result.data.text);

        if (extractedCourses.length > 0) {
            courses = [...courses, ...extractedCourses];
            saveToStorage();
            updateCoursesTable();
            showToast(`Extracted ${extractedCourses.length} course(s)!`, 'success');
        } else {
            showToast('Could not extract courses. Try manual entry.', 'error');
        }

    } catch (error) {
        console.error('OCR Error:', error);
        showToast('Error processing image. Try manual entry.', 'error');
    } finally {
        progressContainer.style.display = 'none';
        processBtn.disabled = false;
        document.getElementById('processBtnText').textContent = 'Extract Schedule';
    }
}

// Parse extracted text to find course information
function parseScheduleText(text) {
    const extractedCourses = [];

    console.log('Raw OCR Text:', text);

    // Clean up the text
    const cleanText = text.replace(/\r/g, '').replace(/\n+/g, '\n');
    const lines = cleanText.split('\n').filter(line => line.trim());

    // Skip header lines
    const dataLines = lines.filter(line => {
        const lower = line.toLowerCase();
        return !lower.includes('course code') &&
            !lower.includes('course title') &&
            !lower.includes('schedule') &&
            line.trim().length > 2;
    });

    console.log('Data lines:', dataLines);

    // Course code pattern
    const codeRegex = /\b(CSIT|IT|CS|MATH|ENG|SCI|PHIL|PE|GE|FIL|NSTP)\s?(\d{3,4}[A-Z]?)\b/gi;

    // Time pattern - matches "08:00 AM - 10:00 AM" format
    const timeRangeRegex = /(\d{1,2}:\d{2}\s*(?:AM|PM))\s*[-–—]\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/gi;

    // Section pattern
    const sectionRegex = /\b(G\d+)\b/i;

    // Room pattern
    const roomRegex = /\b(ONLINE|NGE\d*|CASEROOM|FIELD)\s*(LEC|LAB)?/gi;

    // Day pattern
    const dayLetterRegex = /\b([MTWFS]|TH)\b/g;

    // Process each line looking for course data
    for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i];

        // Look for course codes
        codeRegex.lastIndex = 0;
        const codeMatch = codeRegex.exec(line);
        if (!codeMatch) continue;

        const courseCode = (codeMatch[1] + codeMatch[2]).replace(/\s/g, '').toUpperCase();

        // Look in current and nearby lines
        const searchText = dataLines.slice(i, Math.min(i + 5, dataLines.length)).join(' ');

        // Find section
        let section = '';
        const secMatch = searchText.match(sectionRegex);
        if (secMatch) section = secMatch[1].toUpperCase();

        // Find all time ranges
        timeRangeRegex.lastIndex = 0;
        const timeMatches = [...searchText.matchAll(/(\d{1,2}:\d{2}\s*(?:AM|PM))\s*[-–—]\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/gi)];

        // Find days
        const days = [];
        const dayMatches = searchText.matchAll(/\b([MTWFS]|TH)\b/g);
        for (const dm of dayMatches) {
            const day = dm[1].toUpperCase();
            if (!days.includes(day)) days.push(day);
        }

        // Find room
        let room = '';
        const roomMatch = searchText.match(/\b(ONLINE|NGE\d*|CASEROOM|FIELD)\s*(LEC|LAB)?/gi);
        if (roomMatch) room = roomMatch[0].trim();

        // Extract title
        let title = '';
        const afterCode = line.substring(line.indexOf(codeMatch[0]) + codeMatch[0].length);
        const titleWords = afterCode.match(/^\s*([A-Za-z\s&,]+)/);
        if (titleWords) {
            title = titleWords[1].trim().substring(0, 50);
        }

        // Create course entries
        if (timeMatches.length > 0) {
            for (let t = 0; t < timeMatches.length; t++) {
                const startTime = normalizeTime(timeMatches[t][1]);
                const endTime = normalizeTime(timeMatches[t][2]);
                const courseDays = days.length > t ? [days[t]] : (days.length > 0 ? [days[0]] : []);

                const isDupe = extractedCourses.some(c =>
                    c.code === courseCode && c.startTime === startTime && JSON.stringify(c.days) === JSON.stringify(courseDays)
                );

                if (!isDupe && (courseDays.length > 0 || startTime)) {
                    extractedCourses.push({
                        id: Date.now() + Math.random(),
                        code: courseCode,
                        section: section,
                        title: title,
                        days: courseDays,
                        startTime: startTime,
                        endTime: endTime,
                        room: room
                    });
                }
            }
        } else if (days.length > 0) {
            const isDupe = extractedCourses.some(c => c.code === courseCode);
            if (!isDupe) {
                extractedCourses.push({
                    id: Date.now() + Math.random(),
                    code: courseCode,
                    section: section,
                    title: title,
                    days: days,
                    startTime: '',
                    endTime: '',
                    room: room
                });
            }
        }
    }

    // Fallback: extract just course codes
    if (extractedCourses.length === 0) {
        console.log('Fallback: extracting just course codes...');
        const fullText = lines.join(' ');
        const allCodes = [...fullText.matchAll(/\b(CSIT|IT|CS|MATH|ENG|SCI|PHIL|PE|GE|FIL|NSTP)\s?(\d{3,4}[A-Z]?)\b/gi)];
        const seenCodes = new Set();

        for (const match of allCodes) {
            const code = (match[1] + match[2]).replace(/\s/g, '').toUpperCase();
            if (!seenCodes.has(code)) {
                seenCodes.add(code);
                extractedCourses.push({
                    id: Date.now() + Math.random(),
                    code: code,
                    section: '',
                    title: '',
                    days: [],
                    startTime: '',
                    endTime: '',
                    room: '',
                    isTBA: true
                });
            }
        }
    }

    return extractedCourses;
}

function normalizeTime(timeStr) {
    if (!timeStr) return '';

    timeStr = timeStr.trim().toUpperCase();

    // Handle already formatted times
    if (timeStr.match(/^\d{2}:\d{2}$/)) {
        return timeStr;
    }

    const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (match) {
        let hours = parseInt(match[1]);
        const minutes = match[2];
        const period = match[3];

        if (period) {
            if (period.toUpperCase() === 'PM' && hours !== 12) {
                hours += 12;
            } else if (period.toUpperCase() === 'AM' && hours === 12) {
                hours = 0;
            }
        }

        return `${hours.toString().padStart(2, '0')}:${minutes}`;
    }

    return timeStr;
}

function normalizeDay(dayStr) {
    const day = dayStr.toUpperCase().trim();
    const dayMapping = {
        'M': 'M', 'MON': 'M', 'MONDAY': 'M',
        'T': 'T', 'TUE': 'T', 'TUESDAY': 'T',
        'W': 'W', 'WED': 'W', 'WEDNESDAY': 'W',
        'TH': 'TH', 'THU': 'TH', 'THURSDAY': 'TH',
        'F': 'F', 'FRI': 'F', 'FRIDAY': 'F',
        'S': 'S', 'SAT': 'S', 'SATURDAY': 'S',
        'SU': 'SU', 'SUN': 'SU', 'SUNDAY': 'SU'
    };
    return dayMapping[day] || null;
}

// Manual course entry
function addManualCourse() {
    const courseCode = document.getElementById('courseCode').value.trim();
    const courseSection = document.getElementById('courseSection').value.trim();
    const courseTitle = document.getElementById('courseTitle').value.trim();
    const courseDaySelect = document.getElementById('courseDay');
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;
    const room = document.getElementById('room').value.trim();

    const selectedDays = Array.from(courseDaySelect.selectedOptions).map(opt => opt.value);

    if (!courseCode) {
        showToast('Please enter a course code', 'error');
        return;
    }

    if (selectedDays.length === 0) {
        showToast('Please select at least one day', 'error');
        return;
    }

    if (!startTime || !endTime) {
        showToast('Please enter start and end times', 'error');
        return;
    }

    const course = {
        id: Date.now(),
        code: courseCode,
        section: courseSection,
        title: courseTitle,
        days: selectedDays,
        startTime: startTime,
        endTime: endTime,
        room: room
    };

    courses.push(course);
    saveToStorage();
    updateCoursesTable();
    clearManualForm();
    showToast('Course added successfully!', 'success');
}

function clearManualForm() {
    document.getElementById('courseCode').value = '';
    document.getElementById('courseSection').value = '';
    document.getElementById('courseTitle').value = '';
    document.getElementById('courseDay').selectedIndex = -1;
    document.getElementById('startTime').value = '';
    document.getElementById('endTime').value = '';
    document.getElementById('room').value = '';
}

// Courses table management
function updateCoursesTable() {
    const section = document.getElementById('extractedDataSection');
    const tbody = document.getElementById('coursesTableBody');

    if (courses.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    tbody.innerHTML = '';

    courses.forEach((course, index) => {
        const row = document.createElement('tr');
        const daysDisplay = course.isTBA ? 'TBA' : course.days.map(d => dayMap[d] || d).join(', ');
        const timeDisplay = course.isTBA || (!course.startTime && !course.endTime)
            ? 'TBA'
            : `${formatTimeDisplay(course.startTime)} - ${formatTimeDisplay(course.endTime)}`;
        const roomDisplay = course.isTBA || !course.room ? 'TBA' : course.room;

        row.innerHTML = `
            <td>${course.code}</td>
            <td>${course.section || '-'}</td>
            <td>${course.title || '-'}</td>
            <td>${daysDisplay}</td>
            <td>${timeDisplay}</td>
            <td>${roomDisplay}</td>
            <td>
                <button class="edit-btn" onclick="editCourse(${index})">Edit</button>
                <button class="delete-btn" onclick="deleteCourse(${index})">Delete</button>
            </td>
        `;

        if (course.isTBA) {
            row.classList.add('tba-row');
        }

        tbody.appendChild(row);
    });
}

function formatTimeDisplay(time) {
    if (!time) return '';

    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayHour = h > 12 ? h - 12 : (h === 0 ? 12 : h);

    return `${displayHour}:${minutes} ${period}`;
}

function editCourse(index) {
    const course = courses[index];

    document.getElementById('courseCode').value = course.code;
    document.getElementById('courseSection').value = course.section || '';
    document.getElementById('courseTitle').value = course.title || '';
    document.getElementById('startTime').value = course.startTime;
    document.getElementById('endTime').value = course.endTime;
    document.getElementById('room').value = course.room || '';

    // Set selected days
    const select = document.getElementById('courseDay');
    Array.from(select.options).forEach(opt => {
        opt.selected = course.days.includes(opt.value);
    });

    // Remove the course and let user re-add it
    courses.splice(index, 1);
    updateCoursesTable();
    saveToStorage();

    // Scroll to form
    document.querySelector('.manual-entry-section').scrollIntoView({ behavior: 'smooth' });
}

function deleteCourse(index) {
    if (confirm('Are you sure you want to delete this course?')) {
        courses.splice(index, 1);
        saveToStorage();
        updateCoursesTable();
        showToast('Course deleted', 'success');

        // Also update visualization if visible
        if (document.getElementById('scheduleSection').style.display !== 'none') {
            visualizeSchedule();
        }
    }
}

// Schedule Visualization
function visualizeSchedule() {
    if (courses.length === 0) {
        showToast('No courses to visualize', 'error');
        return;
    }

    const section = document.getElementById('scheduleSection');
    section.style.display = 'block';

    generateScheduleGrid();
    generateLegend();

    section.scrollIntoView({ behavior: 'smooth' });
}

function generateScheduleGrid() {
    const grid = document.getElementById('scheduleGrid');
    grid.innerHTML = '';

    // Update schedule name label
    const scheduleNameInput = document.getElementById('scheduleName');
    const currentScheduleLabel = document.getElementById('currentScheduleName');
    const scheduleName = scheduleNameInput?.value?.trim() || currentScheduleLabel?.dataset?.loadedName || '';
    if (currentScheduleLabel) {
        if (scheduleName) {
            currentScheduleLabel.textContent = `📚 ${scheduleName}`;
            currentScheduleLabel.style.display = 'block';
        } else {
            currentScheduleLabel.style.display = 'none';
        }
    }

    // Time slots from 7:00 AM to 10:00 PM (15 hours), with half-hour slots
    const startHour = 7;
    const endHour = 22;
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    // Create header row
    const headerEmpty = document.createElement('div');
    headerEmpty.className = 'schedule-header';
    headerEmpty.textContent = 'Time';
    grid.appendChild(headerEmpty);

    days.forEach(day => {
        const header = document.createElement('div');
        header.className = 'schedule-header';
        header.textContent = day;
        grid.appendChild(header);
    });

    // Create time slots and cells (now with half-hour increments)
    for (let hour = startHour; hour < endHour; hour++) {
        for (let half = 0; half < 2; half++) {
            const minutes = half * 30;
            const isHalfHour = half === 1;

            // Time label
            const timeSlot = document.createElement('div');
            timeSlot.className = 'time-slot' + (isHalfHour ? ' half-hour' : '');
            const displayHour = hour > 12 ? hour - 12 : hour;
            const period = hour >= 12 ? 'PM' : 'AM';
            timeSlot.innerHTML = `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
            grid.appendChild(timeSlot);

            // Day cells
            days.forEach(day => {
                const cell = document.createElement('div');
                cell.className = 'schedule-cell' + (isHalfHour ? ' half-hour-cell' : '');
                cell.dataset.day = day;
                cell.dataset.hour = hour;
                cell.dataset.minutes = minutes;
                grid.appendChild(cell);
            });
        }
    }

    // Place course blocks
    placeCourseBlocks();
}

function placeCourseBlocks() {
    const startHour = 7;
    const slotHeight = 30; // Height per 30-minute slot

    // Create a map of unique course codes to colors
    const courseColorMap = {};
    const uniqueCodes = [...new Set(courses.map(c => c.code))];
    uniqueCodes.forEach((code, idx) => {
        courseColorMap[code] = courseColors[idx % courseColors.length];
    });

    courses.forEach((course, index) => {
        // Skip TBA courses - they can't be placed on the grid
        if (course.isTBA) return;

        const colorClass = courseColorMap[course.code];

        course.days.forEach(dayCode => {
            const dayName = dayMap[dayCode];
            if (!dayName) return;

            const startMinutes = timeToMinutes(course.startTime);
            const endMinutes = timeToMinutes(course.endTime);

            if (startMinutes === null || endMinutes === null) return;

            const duration = endMinutes - startMinutes;

            // Find the cell for the starting time slot
            const startCellHour = Math.floor(startMinutes / 60);
            const startCellMinutes = startMinutes % 60 >= 30 ? 30 : 0;
            const cell = document.querySelector(`.schedule-cell[data-day="${dayName}"][data-hour="${startCellHour}"][data-minutes="${startCellMinutes}"]`);

            if (!cell) return;

            const block = document.createElement('div');
            block.className = `course-block ${colorClass}`;

            // Calculate position within the cell
            const minuteOffset = startMinutes % 30;
            const topOffset = (minuteOffset / 30) * slotHeight;
            const blockHeight = (duration / 30) * slotHeight;

            block.style.top = `${topOffset}px`;
            block.style.height = `${blockHeight - 4}px`;

            block.style.top = `${topOffset}px`;
            block.style.height = `${blockHeight - 4}px`;

            const isOnline = course.room?.toUpperCase().includes('ONLINE');

            block.innerHTML = `
                ${isOnline ? '<div class="online-badge">🌐 ONLINE</div>' : ''}
                <div class="course-code">${course.code}${course.section ? ' <span class="course-section">' + course.section + '</span>' : ''}</div>
                ${course.title ? `<div class="course-title">${course.title}</div>` : ''}
                <div class="course-time">${formatTimeDisplay(course.startTime)} - ${formatTimeDisplay(course.endTime)}</div>
                ${course.room ? `<div class="course-room">📍 ${course.room}</div>` : ''}
            `;

            if (isOnline) {
                block.classList.add('online-course');
            }

            block.title = `${course.code}${course.section ? ' (' + course.section + ')' : ''}${course.title ? ' - ' + course.title : ''}\n${formatTimeDisplay(course.startTime)} - ${formatTimeDisplay(course.endTime)}${course.room ? '\n' + course.room : ''}`;

            cell.appendChild(block);
        });
    });
}

function timeToMinutes(timeStr) {
    if (!timeStr) return null;

    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (match) {
        return parseInt(match[1]) * 60 + parseInt(match[2]);
    }
    return null;
}

function generateLegend() {
    const legend = document.getElementById('legend');
    legend.innerHTML = '';

    // Create legend for unique courses only
    const courseColorMap = {};
    const uniqueCodes = [...new Set(courses.map(c => c.code))];
    uniqueCodes.forEach((code, idx) => {
        courseColorMap[code] = courseColors[idx % courseColors.length];
    });

    // Get unique courses by code
    const uniqueCourses = [];
    const seenCodes = new Set();
    courses.forEach(course => {
        if (!seenCodes.has(course.code)) {
            seenCodes.add(course.code);
            uniqueCourses.push(course);
        }
    });

    uniqueCourses.forEach((course) => {
        const colorClass = courseColorMap[course.code];
        const isOnline = courses.filter(c => c.code === course.code).some(c => c.room?.toUpperCase().includes('ONLINE'));
        const isTBA = courses.filter(c => c.code === course.code).some(c => c.isTBA);

        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `
            <div class="legend-color ${colorClass}"></div>
            <span>${course.code}${course.section ? ' (' + course.section + ')' : ''}${course.title ? ' - ' + course.title : ''}${isOnline ? ' 🌐' : ''}${isTBA ? ' <span class="tba-badge">TBA</span>' : ''}</span>
        `;
        legend.appendChild(item);
    });
}

// Local Storage
function saveToStorage() {
    localStorage.setItem('scheduleVisualizerCourses', JSON.stringify(courses));
}

function loadFromStorage() {
    const stored = localStorage.getItem('scheduleVisualizerCourses');
    if (stored) {
        courses = JSON.parse(stored);
        updateCoursesTable();
    }
}

// Saved Schedules Management
function loadSavedSchedules() {
    const stored = localStorage.getItem('scheduleVisualizerSavedSchedules');
    if (stored) {
        savedSchedules = JSON.parse(stored);
    }
    updateSavedSchedulesList();
}

function saveSavedSchedules() {
    localStorage.setItem('scheduleVisualizerSavedSchedules', JSON.stringify(savedSchedules));
}

function saveScheduleWithName() {
    const nameInput = document.getElementById('scheduleName');
    const name = nameInput.value.trim();

    if (!name) {
        showToast('Please enter a name for your schedule', 'error');
        nameInput.focus();
        return;
    }

    if (courses.length === 0) {
        showToast('No courses to save', 'error');
        return;
    }

    // Check if name already exists
    const existingIndex = savedSchedules.findIndex(s => s.name.toLowerCase() === name.toLowerCase());
    if (existingIndex !== -1) {
        if (!confirm(`A schedule named "${name}" already exists. Replace it?`)) {
            return;
        }
        savedSchedules.splice(existingIndex, 1);
    }

    const schedule = {
        id: Date.now(),
        name: name,
        courses: JSON.parse(JSON.stringify(courses)), // Deep copy
        createdAt: new Date().toISOString(),
        courseCount: courses.length,
        uniqueCourses: [...new Set(courses.map(c => c.code))].length
    };

    savedSchedules.unshift(schedule); // Add to beginning
    saveSavedSchedules();
    updateSavedSchedulesList();

    nameInput.value = '';
    showToast(`Schedule "${name}" saved!`, 'success');
}

function updateSavedSchedulesList() {
    const section = document.getElementById('savedSchedulesSection');
    const list = document.getElementById('savedSchedulesList');

    // Always show section so import button is accessible
    section.style.display = 'block';
    list.innerHTML = '';

    if (savedSchedules.length === 0) {
        list.innerHTML = `
            <div class="empty-schedules-message">
                <p>📭 No saved schedules yet</p>
                <p class="hint">Save a schedule from above, or import schedules from a friend!</p>
            </div>
        `;
        return;
    }

    savedSchedules.forEach((schedule) => {
        const card = document.createElement('div');
        card.className = 'saved-schedule-card';

        const date = new Date(schedule.createdAt);
        const dateStr = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        card.innerHTML = `
            <h3>📅 ${schedule.name}</h3>
            <div class="schedule-meta">
                <span>📚 ${schedule.uniqueCourses} courses (${schedule.courseCount} sessions)</span>
                <span>🕐 Saved: ${dateStr}</span>
            </div>
            <div class="saved-schedule-actions">
                <button class="load-schedule-btn" onclick="loadSavedSchedule('${schedule.id}')">📂 Load</button>
                <button class="delete-schedule-btn" onclick="deleteSavedSchedule('${schedule.id}')">🗑️</button>
            </div>
        `;

        list.appendChild(card);
    });
}

async function loadSavedSchedule(id) {
    const schedule = savedSchedules.find(s => String(s.id) === String(id));
    if (!schedule) {
        showToast('Schedule not found', 'error');
        return;
    }

    if (courses.length > 0) {
        const confirmed = await showConfirmModal(
            `This will replace your current schedule with "${schedule.name}". Continue?`,
            'Load Schedule',
            '📂',
            'Load',
            true
        );
        if (!confirmed) return;
    }

    courses = JSON.parse(JSON.stringify(schedule.courses)); // Deep copy
    saveToStorage();
    updateCoursesTable();

    // Store the loaded schedule name for display
    const currentScheduleLabel = document.getElementById('currentScheduleName');
    if (currentScheduleLabel) {
        currentScheduleLabel.dataset.loadedName = schedule.name;
    }

    // Also set the input field
    const scheduleNameInput = document.getElementById('scheduleName');
    if (scheduleNameInput) {
        scheduleNameInput.value = schedule.name;
    }

    showToast(`Loaded "${schedule.name}"`, 'success');

    // Scroll to courses table
    document.getElementById('extractedDataSection').scrollIntoView({ behavior: 'smooth' });
}

async function deleteSavedSchedule(id) {
    const schedule = savedSchedules.find(s => String(s.id) === String(id));
    if (!schedule) return;

    const confirmed = await showConfirmModal(
        `Are you sure you want to delete "${schedule.name}"? This action cannot be undone.`,
        'Delete Schedule',
        '🗑️',
        'Delete'
    );

    if (!confirmed) return;

    savedSchedules = savedSchedules.filter(s => String(s.id) !== String(id));
    saveSavedSchedules();
    updateSavedSchedulesList();
    showToast('Schedule deleted', 'success');
}

// Export all schedules to JSON file
function exportSchedules() {
    if (savedSchedules.length === 0) {
        showToast('No schedules to export', 'error');
        return;
    }

    const exportData = {
        exportedAt: new Date().toISOString(),
        version: '1.0',
        schedules: savedSchedules
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `schedules_export_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Exported ${savedSchedules.length} schedule(s)!`, 'success');
}

// Import schedules from JSON file
async function importSchedules(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const data = JSON.parse(text);

        // Validate the import data
        if (!data.schedules || !Array.isArray(data.schedules)) {
            showToast('Invalid file format', 'error');
            return;
        }

        // Check if any schedules already exist with same names
        const existingNames = savedSchedules.map(s => s.name);
        const newSchedules = data.schedules.filter(s => s.name && s.courses);

        if (newSchedules.length === 0) {
            showToast('No valid schedules found in file', 'error');
            return;
        }

        // Ask user how to handle import
        const hasConflicts = newSchedules.some(s => existingNames.includes(s.name));

        let confirmed = true;
        if (savedSchedules.length > 0) {
            confirmed = await showConfirmModal(
                `Import ${newSchedules.length} schedule(s)? ${hasConflicts ? 'Some schedule names already exist and will be renamed.' : ''}`,
                'Import Schedules',
                '📥',
                'Import',
                true
            );
        }

        if (!confirmed) {
            event.target.value = '';
            return;
        }

        // Import schedules with new IDs to avoid conflicts
        let importCount = 0;
        newSchedules.forEach(schedule => {
            // Generate new ID
            const newSchedule = {
                ...schedule,
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                importedAt: new Date().toISOString()
            };

            // Rename if name exists
            if (existingNames.includes(newSchedule.name)) {
                newSchedule.name = `${newSchedule.name} (imported)`;
            }

            savedSchedules.push(newSchedule);
            existingNames.push(newSchedule.name);
            importCount++;
        });

        saveSavedSchedules();
        updateSavedSchedulesList();
        showToast(`Imported ${importCount} schedule(s)!`, 'success');

    } catch (error) {
        console.error('Import error:', error);
        showToast('Error reading file. Make sure it\'s a valid JSON export.', 'error');
    }

    // Reset file input
    event.target.value = '';
}

// Toast notifications
function showToast(message, type = 'info') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Clear all data
function clearAllCourses() {
    if (confirm('Are you sure you want to clear all courses?')) {
        courses = [];
        saveToStorage();
        updateCoursesTable();
        document.getElementById('scheduleSection').style.display = 'none';
        showToast('All courses cleared', 'success');
    }
}

// Restart app - clear everything and reset UI
function restartApp() {
    if (confirm('This will clear all courses and reset the app. Continue?')) {
        // Clear courses
        courses = [];
        saveToStorage();

        // Reset UI
        updateCoursesTable();
        document.getElementById('scheduleSection').style.display = 'none';
        document.getElementById('extractedDataSection').style.display = 'none';

        // Reset upload area
        removeImage();

        // Clear paste area
        document.getElementById('pasteArea').value = '';

        // Clear manual form
        clearManualForm();

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });

        showToast('App restarted!', 'success');
    }
}

// Export schedule as image (bonus feature)
function exportSchedule() {
    showToast('Export feature - use browser print or screenshot', 'info');
}

// Parse text input from textarea
function parseTextInput(isNewSchedule = false) {
    const textarea = document.getElementById('pasteArea');
    const text = textarea.value.trim();

    if (!text) {
        showToast('Please paste your schedule data first', 'error');
        return;
    }

    // If new schedule, clear existing courses first
    if (isNewSchedule) {
        courses = [];
        // Also clear the schedule name
        const scheduleNameInput = document.getElementById('scheduleName');
        if (scheduleNameInput) {
            scheduleNameInput.value = '';
        }
        const currentScheduleLabel = document.getElementById('currentScheduleName');
        if (currentScheduleLabel) {
            currentScheduleLabel.dataset.loadedName = '';
        }
        // Hide schedule section if visible
        document.getElementById('scheduleSection').style.display = 'none';
    }

    const extractedCourses = parseScheduleFromText(text);
    const isFromTableFormat = extractedCourses._isTableFormat;
    delete extractedCourses._isTableFormat; // Clean up the marker

    if (extractedCourses.length > 0) {
        courses = [...courses, ...extractedCourses];
        saveToStorage();
        updateCoursesTable();
        textarea.value = '';
        const actionText = isNewSchedule ? 'Loaded' : 'Added';
        showToast(`${actionText} ${extractedCourses.length} course(s)!`, 'success');

        // Show warning for table format (study load) - no sections included
        if (isFromTableFormat) {
            showSectionWarningModal(extractedCourses);
        }
    } else {
        showToast('Could not parse courses. Check format.', 'error');
    }
}

// Show warning modal for missing sections (study load format)
function showSectionWarningModal(importedCourses) {
    // Get unique course codes
    const uniqueCodes = [...new Set(importedCourses.map(c => c.code))];

    // Create modal HTML
    const modalHtml = `
        <div class="section-warning-modal-overlay" id="sectionWarningModal">
            <div class="section-warning-modal">
                <div class="section-warning-header">
                    <span class="warning-icon">⚠️</span>
                    <h3>Sections Not Included</h3>
                </div>
                <div class="section-warning-body">
                    <p>The Study Load format doesn't include section information (e.g., G1, G2, D3).</p>
                    <p>You can add sections to your courses later by clicking on a course in the table and editing it.</p>
                    <div class="imported-courses-list">
                        <strong>Imported Courses:</strong>
                        <ul>
                            ${uniqueCodes.map(code => `<li>${code}</li>`).join('')}
                        </ul>
                    </div>
                </div>
                <div class="section-warning-footer">
                    <button class="section-warning-btn dismiss" onclick="closeSectionWarningModal()">
                        Got it, I'll add sections later
                    </button>
                </div>
            </div>
        </div>
    `;

    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Show with animation
    setTimeout(() => {
        document.getElementById('sectionWarningModal').classList.add('active');
    }, 10);
}

// Close section warning modal
function closeSectionWarningModal() {
    const modal = document.getElementById('sectionWarningModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }
}

// Better text parsing for pasted schedule data - handles multi-line format
function parseScheduleFromText(text) {
    const extractedCourses = [];
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);

    console.log('parseScheduleFromText called');
    console.log('Total lines:', lines.length);
    console.log('First few lines:', lines.slice(0, 5));

    // Check for 7-FIELD TABLE FORMAT FIRST
    // Pattern: Subject Code, Description, Lec Units, Lab Units, Credited Units, Room #, Schedule
    // Each field on separate line, header row contains "Subject Code" or "Room #" or "Schedule"
    if (isTableFormat(lines)) {
        console.log('Using parseTableFormat');
        const result = parseTableFormat(lines);
        result._isTableFormat = true; // Mark that this came from table format
        return result;
    }

    // Check BLOCK FORMAT - this is the most common format from enrollment systems
    // Pattern: CourseCode, Section (G#/D#), C0, Title, credits, schedule lines, rooms, mode
    if (isBlockFormat(lines)) {
        console.log('Using parseBlockFormat');
        return parseBlockFormat(lines);
    }

    // Check if this is the multi-line format (starts with CCS college code header)
    // This format has "CCS" on its own line followed by "BACHELOR OF SCIENCE..."
    if (text.includes('BACHELOR OF SCIENCE') && lines.some(l => l === 'CCS')) {
        console.log('Using parseMultiLineFormat');
        return parseMultiLineFormat(lines);
    }

    // Otherwise try the simple one-line-per-course format
    console.log('Using parseSimpleFormat');
    return parseSimpleFormat(lines);
}

// Check if the text follows the 7-field table format
function isTableFormat(lines) {
    // Look for header keywords that indicate table format
    const headerKeywords = ['subject code', 'lec units', 'lab units', 'credited units', 'room #', 'schedule'];
    const firstFewLines = lines.slice(0, 10).map(l => l.toLowerCase());

    // Count how many header keywords we find in separate lines
    let headerCount = 0;
    for (const keyword of headerKeywords) {
        if (firstFewLines.some(line => line.includes(keyword) || line === keyword.replace(' ', ''))) {
            headerCount++;
        }
    }

    // If we find at least 3 header keywords on separate lines, it's likely table format
    return headerCount >= 3;
}

// Parse 7-field table format:
// Subject Code, Description, Lec Units, Lab Units, Credited Units, Room #, Schedule
function parseTableFormat(lines) {
    const extractedCourses = [];

    console.log('parseTableFormat called with', lines.length, 'lines');

    // Find where headers end - look for the last header keyword
    let startIndex = 0;
    const headerKeywords = ['subject code', 'description', 'lec units', 'lab units', 'credited units', 'credited', 'room #', 'room', 'schedule'];

    for (let i = 0; i < Math.min(lines.length, 15); i++) {
        const lineLower = lines[i].toLowerCase();
        if (headerKeywords.some(kw => lineLower === kw || lineLower.includes(kw))) {
            startIndex = i + 1;
        }
    }

    console.log('Data starts at line:', startIndex);

    const dataLines = lines.slice(startIndex);
    const fieldsPerCourse = 7; // Subject Code, Description, Lec Units, Lab Units, Credited Units, Room #, Schedule

    console.log('Data lines:', dataLines.length);
    console.log('First 14 data lines:', dataLines.slice(0, 14));

    for (let i = 0; i + fieldsPerCourse <= dataLines.length; i += fieldsPerCourse) {
        const code = dataLines[i];
        const title = dataLines[i + 1];
        const lecUnits = dataLines[i + 2];
        const labUnits = dataLines[i + 3];
        const creditedUnits = dataLines[i + 4];
        const room = dataLines[i + 5];
        const schedule = dataLines[i + 6];

        console.log('Parsing course:', { code, title, room, schedule });

        // Validate this looks like a course code (should have letters and numbers)
        if (!code || !/[A-Za-z]/.test(code) || !/\d/.test(code)) {
            console.log('Skipping invalid code:', code);
            continue;
        }

        // Parse the schedule string
        const sessions = parseTableScheduleString(schedule, room);

        console.log('Sessions parsed:', sessions);

        // Handle multiple rooms
        const rooms = room ? room.split(',').map(r => r.trim()) : ['TBA'];

        if (sessions.length === 0) {
            // No schedule parsed, add as TBA
            extractedCourses.push({
                id: Date.now() + Math.random(),
                code: code,
                title: title,
                days: [],
                startTime: '',
                endTime: '',
                room: rooms[0] || 'TBA',
                isTBA: true
            });
        } else {
            sessions.forEach((session, index) => {
                extractedCourses.push({
                    id: Date.now() + Math.random(),
                    code: code,
                    title: title,
                    days: session.days,
                    startTime: session.startTime,
                    endTime: session.endTime,
                    room: rooms[index] || rooms[0] || 'TBA',
                    isTBA: false
                });
            });
        }
    }

    return extractedCourses;
}

// Parse schedule string from table format
// Examples: "Thu: 08:00AM - 10:00AM, Sat: 08:00AM - 11:00AM"
//           "Tue, Sat: 03:00PM - 04:30PM"
//           "Mon: 03:00PM - 06:00PM, Thu: 03:00PM - 05:00PM"
function parseTableScheduleString(scheduleStr, defaultRoom) {
    const sessions = [];

    if (!scheduleStr) return sessions;

    console.log('Parsing schedule string:', scheduleStr);

    // Split by comma, but be careful with "Tue, Sat:" format (days separated by comma)
    // Strategy: find all "Day: Time - Time" patterns

    // First, try to match individual schedule entries
    // Pattern: Day(s): StartTime - EndTime
    const schedulePattern = /([A-Za-z,\s]+):\s*(\d{1,2}:\d{2}\s*(?:AM|PM))\s*[-–]\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/gi;

    let match;
    while ((match = schedulePattern.exec(scheduleStr)) !== null) {
        const daysStr = match[1].trim();
        const startTimeRaw = match[2].trim();
        const endTimeRaw = match[3].trim();

        console.log('Match found:', { daysStr, startTimeRaw, endTimeRaw });

        const startTime = normalizeTime(startTimeRaw);
        const endTime = normalizeTime(endTimeRaw);

        // Parse days
        const days = parseTableDays(daysStr);

        console.log('Days parsed:', days);

        if (days.length === 0) {
            // Couldn't parse days, add as single session with original day string
            sessions.push({
                days: ['TBA'],
                startTime: startTime,
                endTime: endTime
            });
        } else {
            // Create a session for each day
            days.forEach(day => {
                sessions.push({
                    days: [day],
                    startTime: startTime,
                    endTime: endTime
                });
            });
        }
    }

    return sessions;
}

// Parse days from table format
// Handles: "Thu", "Tue, Sat", "Mon", "Wed", "Fri", etc.
function parseTableDays(daysStr) {
    const days = [];
    const dayMappings = {
        'monday': 'M', 'mon': 'M',
        'tuesday': 'T', 'tue': 'T', 'tu': 'T',
        'wednesday': 'W', 'wed': 'W',
        'thursday': 'TH', 'thu': 'TH', 'thur': 'TH', 'thurs': 'TH',
        'friday': 'F', 'fri': 'F',
        'saturday': 'S', 'sat': 'S',
        'sunday': 'SU', 'sun': 'SU'
    };

    // Split by comma or space
    const dayParts = daysStr.split(/[,\s]+/).filter(d => d.trim());

    dayParts.forEach(dayPart => {
        const normalized = dayPart.toLowerCase().trim();
        if (dayMappings[normalized]) {
            days.push(dayMappings[normalized]);
        }
    });

    return days;
}

// Check if the text follows the block format pattern
function isBlockFormat(lines) {
    // Look for pattern: course code followed by G# section, D# section, or CCS-SAT-AM style section
    for (let i = 0; i < lines.length - 1; i++) {
        // Course code: 2-6 uppercase letters followed by 2-4 digits and optional letter
        if (lines[i].match(/^[A-Z]{2,6}\d{2,4}[A-Z]?$/) &&
            (lines[i + 1].match(/^[GD]\d+$/) || lines[i + 1].match(/^[A-Z]{2,4}-[A-Z]{2,4}-[A-Z0-9]+$/i))) {
            return true;
        }
    }
    return false;
}

// Parse the block format:
// CourseCode
// Section (G5)
// C0
// Title
// Credits (2.0, 1.0, 3)
// Schedule(s): "TH 08:00 AM - 10:00 AM," or "S 08:00 AM - 11:00 AM"
// Room(s): "ONLINE," or "NGE207"
// Mode: "Online" or "In-Person"
function parseBlockFormat(lines) {
    const extractedCourses = [];
    let i = 0;

    console.log('parseBlockFormat called with', lines.length, 'lines');
    console.log('First 10 lines:', lines.slice(0, 10));

    while (i < lines.length) {
        const line = lines[i];

        // Look for course code (2-6 letters followed by 2-4 digits and optional letter)
        if (!line.match(/^[A-Z]{2,6}\d{2,4}[A-Z]?$/)) {
            i++;
            continue;
        }

        const courseCode = line;
        i++;

        // Section (G5, G3, D4, CCS-SAT-AM1, etc.)
        let section = '';
        if (i < lines.length && (lines[i].match(/^[GD]\d+$/) || lines[i].match(/^[A-Z]{2,4}-[A-Z]{2,4}-[A-Z0-9]+$/i))) {
            section = lines[i];
            i++;
        }

        // Skip C0 or similar
        if (i < lines.length && lines[i].match(/^C\d+$/)) {
            i++;
        }

        // Course title (next non-number line)
        let title = '';
        if (i < lines.length && !lines[i].match(/^\d+\.?\d*$/)) {
            title = lines[i];
            i++;
        }

        // Skip credit numbers (2.0, 1.0, 3, etc.)
        while (i < lines.length && lines[i].match(/^\d+\.?\d*$/)) {
            i++;
        }

        // Collect schedule lines (contain day codes and times)
        // Format: "TH 08:00 AM - 10:00 AM," or "M 03:00 PM - 06:00 PM,"
        const scheduleLines = [];
        while (i < lines.length) {
            const scheduleLine = lines[i];
            // Check if it contains a time pattern
            if (scheduleLine.match(/\d{1,2}:\d{2}\s*(AM|PM)/i)) {
                scheduleLines.push(scheduleLine.replace(/,\s*$/, '')); // Remove trailing comma
                i++;
            } else {
                break;
            }
        }

        // Collect room lines
        const roomLines = [];
        while (i < lines.length) {
            let roomLine = lines[i].replace(/,\s*$/, '').trim(); // Remove trailing comma first
            
            // Skip if this is a mode indicator (Online, In-Person, Hybrid)
            // Note: Mode is title case "Online", rooms are uppercase "ONLINE"
            if (roomLine.match(/^(Online|In-Person|Hybrid)$/)) {
                break;
            }
            
            // Room patterns: ONLINE, building codes + numbers, TBA, PE areas, etc.
            // Known room/building prefixes: NGE, GLE, RTL, etc.
            // Check for known room patterns FIRST (these take priority)
            const isKnownRoomPrefix = roomLine.match(/^(NGE|GLE|RTL|SJ|AS|PE-)\d*[A-Z]?/i);
            const isKnownRoomName = roomLine.match(/^(ONLINE|TBA|CASEROOM|FIELD)$/i);
            
            // Course codes are typically department codes like IT, CS, CSIT followed by 3+ digits
            // Room codes like NGE103 should NOT be treated as course codes
            const isCourseCode = !isKnownRoomPrefix && roomLine.match(/^[A-Z]{2,6}\d{3,4}[A-Z]?$/);
            
            if (isKnownRoomPrefix || isKnownRoomName) {
                roomLines.push(roomLine);
                i++;
            } else if (isCourseCode) {
                // This looks like the next course code, stop here
                break;
            } else {
                break;
            }
        }

        // Skip mode line (Online, In-Person, Hybrid) - case sensitive!
        if (i < lines.length && lines[i].match(/^(Online|In-Person|Hybrid)$/)) {
            i++;
        }

        console.log('Course parsed:', { code: courseCode, section, title, scheduleLines, roomLines });

        // Parse each schedule line and create course entries
        for (let s = 0; s < scheduleLines.length; s++) {
            let scheduleLine = scheduleLines[s];
            const room = roomLines[s] || roomLines[0] || '';

            // Clean up schedule line - remove trailing comma, extra whitespace
            scheduleLine = scheduleLine.replace(/,\s*$/, '').trim();

            // Parse day and time from schedule line
            // Format: "TH 08:00 AM - 10:00 AM" or "TS 03:00 PM - 04:30 PM"
            const scheduleMatch = scheduleLine.match(/^([A-Z]+)\s+(\d{1,2}:\d{2}\s*(?:AM|PM))\s*[-–]\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);

            console.log('Schedule line:', scheduleLine, 'Match:', scheduleMatch);

            if (scheduleMatch) {
                const dayStr = scheduleMatch[1].toUpperCase();
                const startTimeRaw = scheduleMatch[2];
                const endTimeRaw = scheduleMatch[3];

                const startTime = normalizeTime(startTimeRaw);
                const endTime = normalizeTime(endTimeRaw);

                // Parse days (could be combined like "TS" for Tuesday+Saturday)
                const days = parseMultipleDays(dayStr);

                console.log('Parsed:', { code: courseCode, dayStr, days, startTime, endTime });

                extractedCourses.push({
                    id: Date.now() + Math.random(),
                    code: courseCode,
                    section: section,
                    title: title,
                    days: days,
                    startTime: startTime,
                    endTime: endTime,
                    room: room
                });
            }
        }

        // If no schedules found, still add the course as TBA
        if (scheduleLines.length === 0) {
            extractedCourses.push({
                id: Date.now() + Math.random(),
                code: courseCode,
                section: section,
                title: title,
                days: [],
                startTime: '',
                endTime: '',
                room: '',
                isTBA: true
            });
        }
    }

    return extractedCourses;
}

// Parse combined day strings like "TS" (Tuesday + Saturday), "TH" (Thursday)
function parseMultipleDays(dayStr) {
    const days = [];
    let remaining = dayStr.toUpperCase();

    // Handle special cases first
    if (remaining === 'TH') {
        return ['TH'];
    }
    if (remaining === 'SU') {
        return ['SU'];
    }

    // Check for TH (Thursday) first
    if (remaining.includes('TH')) {
        days.push('TH');
        remaining = remaining.replace('TH', '');
    }

    // Check for SU (Sunday) 
    if (remaining.includes('SU')) {
        days.push('SU');
        remaining = remaining.replace('SU', '');
    }

    // Handle remaining single-letter days
    for (const char of remaining) {
        if (char === 'M') days.push('M');
        else if (char === 'T') days.push('T');
        else if (char === 'W') days.push('W');
        else if (char === 'F') days.push('F');
        else if (char === 'S') days.push('S');
    }

    return [...new Set(days)]; // Remove duplicates
}

// Parse the multi-line format from the school portal
function parseMultiLineFormat(lines) {
    const extractedCourses = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        // Look for college code (CCS, etc.) which starts a new course block
        if (line === 'CCS' || line.match(/^[A-Z]{2,4}$/) && lines[i + 1]?.includes('BACHELOR')) {
            // Skip college name
            i++;

            // Skip program name (BACHELOR OF SCIENCE IN...)
            if (lines[i]?.includes('BACHELOR') || lines[i]?.includes('SCIENCE')) {
                i++;
            }

            // Course code should be next
            const courseCode = lines[i];
            if (!courseCode?.match(/^[A-Z]{2,4}\d{3,4}[A-Z]?$/)) {
                i++;
                continue;
            }
            i++;

            // Course title
            const courseTitle = lines[i] || '';
            i++;

            // Section (G1, G2, G3, etc.)
            let courseSection = '';
            if (lines[i]?.match(/^G\d+$/)) {
                courseSection = lines[i];
                i++;
            }

            // Now collect days, times, and rooms
            const days = [];
            const times = [];
            const rooms = [];

            // Collect days (M, T, W, TH, F, S, THS, etc.)
            while (i < lines.length && isDay(lines[i])) {
                const dayStr = lines[i].trim();
                // Handle combined days like "THS" (Thursday + Saturday)
                const parsedDays = parseDayString(dayStr);
                days.push(...parsedDays);
                i++;
            }

            // Collect times
            while (i < lines.length && isTime(lines[i])) {
                times.push(lines[i].trim());
                i++;
            }

            // Collect rooms
            while (i < lines.length && isRoom(lines[i])) {
                rooms.push(lines[i].trim());
                i++;
            }

            // Skip remaining metadata (numbers, Online/In-Person, N, etc.)
            while (i < lines.length &&
                (lines[i].match(/^\d+$/) ||
                    lines[i] === 'Online' ||
                    lines[i] === 'In-Person' ||
                    lines[i] === 'N' ||
                    lines[i] === 'Y' ||
                    lines[i].match(/^C\d+$/))) {
                i++;
            }

            // Create course entries - pair days with times and rooms
            // If no days found, create a TBA entry
            if (days.length === 0) {
                const course = {
                    id: Date.now() + Math.random(),
                    code: courseCode,
                    section: courseSection,
                    title: courseTitle,
                    days: ['TBA'],
                    startTime: '',
                    endTime: '',
                    room: '',
                    isTBA: true
                };
                extractedCourses.push(course);
            } else {
                for (let j = 0; j < days.length; j++) {
                    const day = days[j];
                    const time = times[j] || times[0] || '';
                    const room = rooms[j] || rooms[0] || '';

                    // Parse time range
                    const timeMatch = time.match(/(\d{1,2}:\d{2}\s*(?:AM|PM))\s*[-–—]\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
                    let startTime = '', endTime = '';
                    if (timeMatch) {
                        startTime = normalizeTime(timeMatch[1]);
                        endTime = normalizeTime(timeMatch[2]);
                    }

                    const course = {
                        id: Date.now() + Math.random(),
                        code: courseCode,
                        section: courseSection,
                        title: courseTitle,
                        days: [day],
                        startTime: startTime,
                        endTime: endTime,
                        room: room
                    };

                    extractedCourses.push(course);
                }
            }
        } else {
            i++;
        }
    }

    return extractedCourses;
}

// Check if a string is a day abbreviation
function isDay(str) {
    if (!str) return false;
    const cleaned = str.trim().toUpperCase();
    // Match single days or combinations like THS, MS, etc.
    // First check if it's a number (metadata) - not a day
    if (/^\d+$/.test(cleaned)) return false;
    // Check for valid day patterns
    return /^(M|T|W|TH|F|S|SU|THS|MS|MWF|TTH|MW|TS|WF|MTW|MTWTH|MTWTHF)+$/.test(cleaned);
}

// Parse day string that might contain multiple days
function parseDayString(str) {
    const days = [];
    const upper = str.toUpperCase().trim();

    // Handle special combinations first (order matters - check longer patterns first)
    if (upper === 'MTWTHF') {
        days.push('M', 'T', 'W', 'TH', 'F');
    } else if (upper === 'MTWTH') {
        days.push('M', 'T', 'W', 'TH');
    } else if (upper === 'MTW') {
        days.push('M', 'T', 'W');
    } else if (upper === 'THS') {
        days.push('TH', 'S');
    } else if (upper === 'TTH') {
        days.push('T', 'TH');
    } else if (upper === 'MWF') {
        days.push('M', 'W', 'F');
    } else if (upper === 'MW') {
        days.push('M', 'W');
    } else if (upper === 'MS') {
        days.push('M', 'S');
    } else if (upper === 'TS') {
        days.push('T', 'S');
    } else if (upper === 'WF') {
        days.push('W', 'F');
    } else if (upper === 'TH') {
        days.push('TH');
    } else if (upper === 'SU') {
        days.push('SU');
    } else if (['M', 'T', 'W', 'F', 'S'].includes(upper)) {
        days.push(upper);
    } else {
        // Try to parse character by character for other combinations
        let i = 0;
        while (i < upper.length) {
            if (upper.substring(i, i + 2) === 'TH') {
                days.push('TH');
                i += 2;
            } else if (upper.substring(i, i + 2) === 'SU') {
                days.push('SU');
                i += 2;
            } else if (['M', 'T', 'W', 'F', 'S'].includes(upper[i])) {
                days.push(upper[i]);
                i += 1;
            } else {
                i += 1;
            }
        }
    }

    return [...new Set(days)]; // Remove duplicates
}

// Check if a string is a time
function isTime(str) {
    if (!str) return false;
    return /\d{1,2}:\d{2}\s*(AM|PM)/i.test(str);
}

// Check if a string is a room
function isRoom(str) {
    if (!str) return false;
    const cleaned = str.trim().toUpperCase();
    return /^(ONLINE|NGE|CASEROOM|FIELD|ROOM|[A-Z]+\d+)\s*(LEC|LAB|LECTURE|LABORATORY)?/i.test(cleaned);
}

// Parse simple one-line format
function parseSimpleFormat(lines) {
    const extractedCourses = [];

    for (const line of lines) {
        // Skip header lines
        if (line.toLowerCase().includes('course code') ||
            line.toLowerCase().includes('course title') ||
            line.toLowerCase().includes('program offered')) {
            continue;
        }

        // Try to find course code
        const codeMatch = line.match(/\b([A-Z]{2,4}\s?\d{3,4}[A-Z]?)\b/i);
        if (!codeMatch) continue;

        const code = codeMatch[1].replace(/\s/g, '').toUpperCase();

        // Extract times
        const times = [];
        const timeRegex = /(\d{1,2}:\d{2}\s*(?:AM|PM))/gi;
        let timeMatch;
        while ((timeMatch = timeRegex.exec(line)) !== null) {
            times.push(timeMatch[1]);
        }

        let startTime = '', endTime = '';
        if (times.length >= 2) {
            startTime = normalizeTime(times[0]);
            endTime = normalizeTime(times[1]);
        }

        // Extract days
        const days = extractDaysFromText(line);

        // Extract room
        let room = '';
        const roomMatch = line.match(/\b(ONLINE|NGE\s?\d+|CASEROOM|FIELD)\s*(LEC|LAB)?/i);
        if (roomMatch) {
            room = roomMatch[0].trim();
        }

        if (code.match(/^[A-Z]{2,4}\d{3,4}[A-Z]?$/)) {
            extractedCourses.push({
                id: Date.now() + Math.random(),
                code: code,
                title: '',
                days: days,
                startTime: startTime,
                endTime: endTime,
                room: room
            });
        }
    }

    return extractedCourses;
}

// Extract days from text
function extractDaysFromText(text) {
    const days = [];
    const upper = text.toUpperCase();

    // Check for full day names first
    if (upper.includes('THURSDAY') || upper.includes('THU')) days.push('TH');
    if (upper.includes('SUNDAY') || upper.includes('SUN')) days.push('SU');
    if (upper.includes('MONDAY') || upper.includes('MON')) days.push('M');
    if ((upper.includes('TUESDAY') || upper.includes('TUE')) && !days.includes('T')) days.push('T');
    if (upper.includes('WEDNESDAY') || upper.includes('WED')) days.push('W');
    if (upper.includes('FRIDAY') || upper.includes('FRI')) days.push('F');
    if ((upper.includes('SATURDAY') || upper.includes('SAT')) && !days.includes('S')) days.push('S');

    // If no full names found, check for abbreviations
    if (days.length === 0) {
        // Look for day column patterns - usually single letters separated by spaces or in sequence
        const daySection = upper.match(/\b((?:TH|SU|[MTWFS])\s*)+\b/g);

        if (daySection) {
            const dayStr = daySection.join(' ');
            if (dayStr.includes('TH')) days.push('TH');
            if (dayStr.includes('SU')) days.push('SU');
            if (/\bM\b/.test(dayStr)) days.push('M');
            if (/\bT\b/.test(dayStr) && !days.includes('TH')) days.push('T');
            if (/\bW\b/.test(dayStr)) days.push('W');
            if (/\bF\b/.test(dayStr)) days.push('F');
            if (/\bS\b/.test(dayStr) && !days.includes('SU')) days.push('S');
        }
    }

    return [...new Set(days)];
}

// Mobile Wallpaper Functions
let currentWallpaperColor = '#000000';
let currentBoxColor = '#2a2a2a';
let currentTextColor = '#ffffff';
let currentWallpaperWidth = 393;
let currentWallpaperHeight = 852;
let currentTimeFormat = localStorage.getItem('scheduleVisualizerTimeFormat') || '12h';

// Layout position variables (default: fullscreen with no margins)
let currentTopOffset = 0;
let currentScheduleHeight = 100;
let currentBottomSpace = 0;

function showMobileWallpaper() {
    if (courses.length === 0) {
        showToast('No courses to display', 'error');
        return;
    }

    const modal = document.getElementById('mobileWallpaperModal');
    const content = document.getElementById('mobileWallpaperContent');

    // Apply current dimensions
    content.style.width = currentWallpaperWidth + 'px';
    content.style.height = currentWallpaperHeight + 'px';

    // Update custom size inputs
    const widthInput = document.getElementById('customWidth');
    const heightInput = document.getElementById('customHeight');
    if (widthInput) widthInput.value = currentWallpaperWidth;
    if (heightInput) heightInput.value = currentWallpaperHeight;

    // Sync layout sliders
    syncLayoutSliders();

    // Generate the mobile schedule content
    content.innerHTML = generateMobileScheduleHTML();

    // Apply all colors
    applyWallpaperColor(currentWallpaperColor);
    applyBoxColor(currentBoxColor);
    applyTextColor(currentTextColor);

    // Setup color picker event listeners
    setupColorPicker();

    // Setup device preset event listeners
    setupDevicePresets();

    // Setup layout controls
    setupLayoutControls();

    // Setup time format toggle
    setupTimeFormatToggle();

    // Show the modal
    modal.style.display = 'flex';

    // Prevent body scroll
    document.body.style.overflow = 'hidden';
}

function syncLayoutSliders() {
    const topSlider = document.getElementById('topOffsetSlider');
    const scheduleSlider = document.getElementById('scheduleHeightSlider');
    const topValue = document.getElementById('topOffsetValue');
    const scheduleValue = document.getElementById('scheduleHeightValue');

    if (topSlider) {
        topSlider.value = currentTopOffset;
        topValue.textContent = currentTopOffset + '%';
    }
    if (scheduleSlider) {
        scheduleSlider.value = currentScheduleHeight;
        scheduleValue.textContent = currentScheduleHeight + '%';
    }

    // Auto-calculate bottom space
    currentBottomSpace = Math.max(0, 100 - currentTopOffset - currentScheduleHeight);
}

function setupLayoutControls() {
    const topSlider = document.getElementById('topOffsetSlider');
    const scheduleSlider = document.getElementById('scheduleHeightSlider');

    if (topSlider) {
        topSlider.addEventListener('input', (e) => {
            currentTopOffset = parseInt(e.target.value);
            document.getElementById('topOffsetValue').textContent = currentTopOffset + '%';
            // Auto-calculate bottom space
            currentBottomSpace = Math.max(0, 100 - currentTopOffset - currentScheduleHeight);
            updateWallpaperLayout();
        });
    }

    if (scheduleSlider) {
        scheduleSlider.addEventListener('input', (e) => {
            currentScheduleHeight = parseInt(e.target.value);
            document.getElementById('scheduleHeightValue').textContent = currentScheduleHeight + '%';
            // Auto-calculate bottom space
            currentBottomSpace = Math.max(0, 100 - currentTopOffset - currentScheduleHeight);
            updateWallpaperLayout();
        });
    }
}

function setupTimeFormatToggle() {
    const options = document.querySelectorAll('.time-format-option');
    if (!options.length) return;

    options.forEach(option => {
        option.classList.toggle('active', option.dataset.format === currentTimeFormat);
        option.onclick = () => {
            options.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');
            currentTimeFormat = option.dataset.format === '24h' ? '24h' : '12h';
            localStorage.setItem('scheduleVisualizerTimeFormat', currentTimeFormat);
            updateWallpaperLayout();
        };
    });
}

function updateWallpaperLayout() {
    const content = document.getElementById('mobileWallpaperContent');
    if (!content) return;

    // Regenerate with new layout
    content.innerHTML = generateMobileScheduleHTML();

    // Reapply colors
    applyWallpaperColor(currentWallpaperColor);
    applyBoxColor(currentBoxColor);
    applyTextColor(currentTextColor);
}

function setupColorPicker() {
    const colorOptions = document.querySelectorAll('.color-option');
    const customColorInput = document.getElementById('customWallpaperColor');

    colorOptions.forEach(option => {
        option.addEventListener('click', () => {
            // Remove active class from all
            colorOptions.forEach(opt => opt.classList.remove('active'));
            // Add active to clicked
            option.classList.add('active');
            // Apply the color
            const color = option.dataset.color;
            currentWallpaperColor = color;
            applyWallpaperColor(color);
        });
    });

    if (customColorInput) {
        customColorInput.addEventListener('input', (e) => {
            // Remove active from preset options
            colorOptions.forEach(opt => opt.classList.remove('active'));
            // Apply custom color
            const color = e.target.value;
            currentWallpaperColor = color;
            applyWallpaperColor(color);
        });
    }

    // Box color options
    const boxColorOptions = document.querySelectorAll('.box-color-option');
    const customBoxColor = document.getElementById('customBoxColor');

    boxColorOptions.forEach(option => {
        option.addEventListener('click', () => {
            boxColorOptions.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');
            const color = option.dataset.color;
            currentBoxColor = color;
            applyBoxColor(color);
        });
    });

    if (customBoxColor) {
        customBoxColor.addEventListener('input', (e) => {
            boxColorOptions.forEach(opt => opt.classList.remove('active'));
            const color = e.target.value;
            currentBoxColor = color;
            applyBoxColor(color);
        });
    }

    // Text color options
    const textColorOptions = document.querySelectorAll('.text-color-option');
    const customTextColor = document.getElementById('customTextColor');

    textColorOptions.forEach(option => {
        option.addEventListener('click', () => {
            textColorOptions.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');
            const color = option.dataset.color;
            currentTextColor = color;
            applyTextColor(color);
        });
    });

    if (customTextColor) {
        customTextColor.addEventListener('input', (e) => {
            textColorOptions.forEach(opt => opt.classList.remove('active'));
            const color = e.target.value;
            currentTextColor = color;
            applyTextColor(color);
        });
    }
}

function setupDevicePresets() {
    const presetBtns = document.querySelectorAll('.device-preset-btn');

    presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active from all presets
            presetBtns.forEach(b => b.classList.remove('active'));
            // Add active to clicked
            btn.classList.add('active');

            // Get dimensions from data attributes
            const width = parseInt(btn.dataset.width);
            const height = parseInt(btn.dataset.height);

            // Get layout position from data attributes
            const top = parseInt(btn.dataset.top) || 0;
            const schedule = parseInt(btn.dataset.schedule) || 100;
            const bottom = parseInt(btn.dataset.bottom) || 0;

            // Update layout position variables
            currentTopOffset = top;
            currentScheduleHeight = schedule;
            currentBottomSpace = bottom;

            // Apply the new size
            applyWallpaperSize(width, height);

            // Update custom input fields
            const widthInput = document.getElementById('customWidth');
            const heightInput = document.getElementById('customHeight');
            if (widthInput) widthInput.value = width;
            if (heightInput) heightInput.value = height;

            // Sync layout sliders
            syncLayoutSliders();
        });
    });
}

function applyCustomSize() {
    const widthInput = document.getElementById('customWidth');
    const heightInput = document.getElementById('customHeight');

    if (!widthInput || !heightInput) return;

    const width = parseInt(widthInput.value) || 393;
    const height = parseInt(heightInput.value) || 852;

    // Clamp values
    const clampedWidth = Math.max(200, Math.min(600, width));
    const clampedHeight = Math.max(400, Math.min(1200, height));

    // Update inputs with clamped values
    widthInput.value = clampedWidth;
    heightInput.value = clampedHeight;

    // Remove active from all presets (since this is a custom size)
    const presetBtns = document.querySelectorAll('.device-preset-btn');
    presetBtns.forEach(b => b.classList.remove('active'));

    // Apply the size
    applyWallpaperSize(clampedWidth, clampedHeight);

    showToast(`Resized to ${clampedWidth}×${clampedHeight}`, 'success');
}

function applyWallpaperSize(width, height) {
    currentWallpaperWidth = width;
    currentWallpaperHeight = height;

    const content = document.getElementById('mobileWallpaperContent');
    if (content) {
        content.style.width = width + 'px';
        content.style.height = height + 'px';

        // Regenerate the schedule to fit new dimensions
        content.innerHTML = generateMobileScheduleHTML();

        // Reapply colors
        applyWallpaperColor(currentWallpaperColor);
        applyBoxColor(currentBoxColor);
        applyTextColor(currentTextColor);
    }
}

function applyBoxColor(color) {
    const content = document.getElementById('mobileWallpaperContent');
    const blocks = content.querySelectorAll('.mobile-course-block');

    blocks.forEach(block => {
        block.style.backgroundColor = color;
        // Adjust border based on box color
        const isDark = isColorDark(color);
        block.style.borderColor = isDark ? '#555' : '#999';
    });
}

function applyTextColor(color) {
    const content = document.getElementById('mobileWallpaperContent');
    const blocks = content.querySelectorAll('.mobile-course-block');

    blocks.forEach(block => {
        const code = block.querySelector('.mobile-course-code');
        const section = block.querySelector('.mobile-course-section');
        const room = block.querySelector('.mobile-course-room');

        if (code) code.style.color = color;
        if (section) section.style.color = color;
        // Room uses slightly more muted version
        if (room) {
            const isDark = isColorDark(color);
            room.style.color = isDark ? '#ccc' : '#666';
        }
    });
}

function applyWallpaperColor(color) {
    const content = document.getElementById('mobileWallpaperContent');

    if (content) {
        content.style.backgroundColor = color;
    }

    const isDark = isColorDark(color);

    // Handle new lockscreen layout
    const lockscreenLayout = content.querySelector('.lockscreen-layout');
    if (lockscreenLayout) {
        lockscreenLayout.style.backgroundColor = color;

        // Update day headers
        const dayHeaders = content.querySelectorAll('.day-header-cell');
        dayHeaders.forEach(header => {
            header.style.color = isDark ? '#888' : '#444';
            header.style.borderColor = isDark ? '#333' : 'rgba(0, 0, 0, 0.25)';
        });

        // Update time cells
        const timeCells = content.querySelectorAll('.time-cell');
        timeCells.forEach(cell => {
            cell.style.borderColor = isDark ? '#333' : 'rgba(0, 0, 0, 0.25)';
        });

        const timeHours = content.querySelectorAll('.time-hour');
        timeHours.forEach(hour => {
            hour.style.color = isDark ? '#666' : '#444';
        });

        const timePeriods = content.querySelectorAll('.time-period');
        timePeriods.forEach(period => {
            period.style.color = isDark ? '#555' : '#888';
        });

        // Update grid cells
        const daysContainer = content.querySelector('.days-container');
        if (daysContainer) {
            daysContainer.style.borderRightColor = isDark ? '#333' : 'rgba(0, 0, 0, 0.35)';
            daysContainer.style.borderBottomColor = isDark ? '#333' : 'rgba(0, 0, 0, 0.35)';
        }

        const dayColumns = content.querySelectorAll('.day-column');
        dayColumns.forEach(col => {
            col.style.borderColor = isDark ? '#333' : 'rgba(0, 0, 0, 0.35)';
        });

        const hourCells = content.querySelectorAll('.hour-cell');
        hourCells.forEach(cell => {
            cell.style.borderColor = isDark ? '#333' : 'rgba(0, 0, 0, 0.25)';
            // Update the half-hour line color dynamically using CSS custom property
            cell.style.setProperty('--half-line-color', isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.2)');
        });

        return;
    }

    // Legacy support for old layout
    const grid = content.querySelector('.mobile-schedule-grid');
    if (grid) {
        grid.style.backgroundColor = color;
        grid.style.color = isDark ? '#fff' : '#333';

        const cells = grid.querySelectorAll('.mobile-grid-cell');
        const headers = grid.querySelectorAll('.mobile-grid-header');
        const timeLabels = grid.querySelectorAll('.mobile-time-label');

        cells.forEach(cell => {
            cell.style.borderColor = isDark ? '#333' : '#ccc';
        });

        headers.forEach(header => {
            header.style.color = isDark ? '#888' : '#555';
            header.style.borderColor = isDark ? '#333' : '#ccc';
        });

        timeLabels.forEach(label => {
            label.style.borderColor = isDark ? '#333' : '#ccc';
            const main = label.querySelector('.time-main');
            const sub = label.querySelector('.time-sub');
            if (main) main.style.color = isDark ? '#777' : '#555';
            if (sub) sub.style.color = isDark ? '#555' : '#888';
        });
    }
}

function isColorDark(hexColor) {
    // Convert hex to RGB
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return luminance < 0.5;
}

function closeMobileWallpaper() {
    const modal = document.getElementById('mobileWallpaperModal');
    modal.style.display = 'none';
    document.body.style.overflow = '';
}

function generateMobileScheduleHTML() {
    // Check if schedule has Sunday courses
    const hasSunday = courses.some(course => course.days && course.days.includes('SU'));

    // Build days array dynamically
    const days = hasSunday ? ['M', 'T', 'W', 'TH', 'F', 'S', 'SU'] : ['M', 'T', 'W', 'TH', 'F', 'S'];
    const dayNames = hasSunday ? ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] : ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const dayAbbrev = hasSunday
        ? { 'M': 0, 'T': 1, 'W': 2, 'TH': 3, 'F': 4, 'S': 5, 'SU': 6 }
        : { 'M': 0, 'T': 1, 'W': 2, 'TH': 3, 'F': 4, 'S': 5 };
    const numDays = days.length;

    // Time range: 7:00 AM to 9:00 PM (14 hours)
    const startHour = 7;
    const endHour = 21; // 9 PM
    const numHours = endHour - startHour; // 14 hours

    // Place courses into the grid
    const coursePlacements = []; // {dayIndex, startSlot, endSlot, course}

    courses.forEach(course => {
        if (course.isTBA) return;

        const startMinutes = timeToMinutes(course.startTime);
        const endMinutes = timeToMinutes(course.endTime);

        if (startMinutes === null || endMinutes === null) return;

        // Convert to hour-based position
        const startPos = (startMinutes - startHour * 60) / 60; // in hours
        const endPos = (endMinutes - startHour * 60) / 60; // in hours

        if (startPos < 0 || endPos > numHours) return; // Out of range

        course.days.forEach(dayCode => {
            const dayIndex = dayAbbrev[dayCode];
            if (dayIndex === undefined) return;

            coursePlacements.push({
                dayIndex,
                startPos,
                endPos,
                course: {
                    code: course.code,
                    section: course.section || '',
                    room: course.room || ''
                }
            });
        });
    });

    // Calculate grid dimensions based on wallpaper size
    // Use dynamic layout variables
    const topSpacePercent = currentTopOffset;
    const scheduleHeightPercent = currentScheduleHeight;
    const bottomSpacePercent = currentBottomSpace;

    // Schedule grid internal dimensions
    const timeColumnWidth = currentTimeFormat === '24h' ? 40 : 44;
    const scheduleWidth = currentWallpaperWidth - 20; // 10px padding each side
    const scheduleAreaHeight = (currentWallpaperHeight * scheduleHeightPercent) / 100;

    // Each hour gets equal height
    const hourHeight = scheduleAreaHeight / numHours;
    const dayWidth = (scheduleWidth - timeColumnWidth) / numDays; // time column width

    // Build HTML with lockscreen layout
    let html = `<div class="lockscreen-layout ${currentTimeFormat === '24h' ? 'time-24' : ''}">`;

    // Top area (empty for iOS date/time)
    html += `<div class="lockscreen-top" style="height: ${topSpacePercent}%;"></div>`;

    // Middle: Schedule grid area
    html += `<div class="lockscreen-schedule" style="height: ${scheduleHeightPercent}%;">`;
    html += `<div class="schedule-grid-wrapper">`;

    // Day headers
    html += `<div class="day-headers" style="grid-template-columns: ${timeColumnWidth}px repeat(${numDays}, 1fr);">`;
    html += `<div class="time-header-cell"></div>`; // Empty corner
    dayNames.forEach(day => {
        html += `<div class="day-header-cell">${day}</div>`;
    });
    html += `</div>`;

    // Schedule grid with time column and day columns
    html += `<div class="schedule-body">`;

    // Time column
    html += `<div class="time-column" style="width: ${timeColumnWidth}px;">`;
    for (let h = 0; h < numHours; h++) {
        const hour = startHour + h;
        const timeParts = formatWallpaperTime(hour);
        const halfTimeParts = formatWallpaperHalfTime(hour);
        html += `<div class="time-cell" style="height: ${hourHeight}px;">
            <div class="time-main-row">
                <span class="time-hour">${timeParts.label}</span>
                <span class="time-period">${timeParts.period}</span>
            </div>
            <div class="time-half-row">
                <span class="time-hour">${halfTimeParts.label}</span>
                <span class="time-period">${halfTimeParts.period}</span>
            </div>
        </div>`;
    }
    html += `</div>`;

    // Day columns with course blocks
    html += `<div class="days-container" style="grid-template-columns: repeat(${numDays}, 1fr);">`;

    for (let d = 0; d < numDays; d++) {
        html += `<div class="day-column">`;

        // Add hour grid lines
        for (let h = 0; h < numHours; h++) {
            html += `<div class="hour-cell" style="height: ${hourHeight}px;"></div>`;
        }

        // Add course blocks for this day
        const dayCourses = coursePlacements.filter(p => p.dayIndex === d);
        dayCourses.forEach(placement => {
            const topPos = placement.startPos * hourHeight;
            const height = (placement.endPos - placement.startPos) * hourHeight - 2;
            const roomDisplay = abbreviateRoom(placement.course.room);

            html += `<div class="mobile-course-block" style="top: ${topPos}px; height: ${height}px;">
                <div class="mobile-course-code">${placement.course.code}</div>
                <div class="mobile-course-section">${placement.course.section}</div>
                <div class="mobile-course-room">${roomDisplay}</div>
            </div>`;
        });

        html += `</div>`;
    }

    html += `</div>`; // days-container
    html += `</div>`; // schedule-body
    html += `</div>`; // schedule-grid-wrapper
    html += `</div>`; // lockscreen-schedule

    // Bottom area (empty for iOS controls)
    html += `<div class="lockscreen-bottom" style="height: ${bottomSpacePercent}%;"></div>`;

    html += `</div>`; // lockscreen-layout

    return html;
}

function formatWallpaperTime(hour) {
    if (currentTimeFormat === '24h') {
        return { label: `${hour.toString().padStart(2, '0')}:00`, period: '' };
    }

    const period = hour >= 12 ? 'pm' : 'am';
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return { label: `${displayHour}:00`, period };
}

function formatWallpaperHalfTime(hour) {
    if (currentTimeFormat === '24h') {
        return { label: `${hour.toString().padStart(2, '0')}:30`, period: '' };
    }

    const period = hour >= 12 ? 'pm' : 'am';
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return { label: `${displayHour}:30`, period };
}

// Abbreviate room names for mobile display
function abbreviateRoom(room) {
    if (!room) return '';
    const upper = room.toUpperCase();
    if (upper.includes('CASEROOM')) return 'CASE';
    if (upper.includes('ONLINE')) return 'ONLINE';
    if (upper.includes('FIELD')) return 'FIELD';
    // NGE101, NGE207, etc. - keep as is but shorten if needed
    if (upper.match(/^NGE\d+/)) return room;
    return room;
}

// Close mobile wallpaper on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('mobileWallpaperModal');
        if (modal && modal.style.display === 'flex') {
            closeMobileWallpaper();
        }
    }
});

// Save mobile wallpaper as PNG
async function saveMobileWallpaper() {
    const content = document.getElementById('mobileWallpaperContent');

    if (!content) {
        showToast('No wallpaper to save', 'error');
        return;
    }

    try {
        showToast('Generating PNG...', 'info');

        const canvas = await html2canvas(content, {
            backgroundColor: currentWallpaperColor,
            scale: 3, // Higher resolution for iPhone
            useCORS: true,
            logging: false
        });

        // Create download link
        const link = document.createElement('a');
        link.download = `schedule_wallpaper_${new Date().toISOString().slice(0, 10)}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        showToast('Wallpaper saved!', 'success');
    } catch (error) {
        console.error('Error saving wallpaper:', error);
        showToast('Error saving wallpaper. Try screenshot instead.', 'error');
    }
}
