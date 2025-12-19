// Global state
let courses = [];
let selectedFile = null;
let savedSchedules = [];

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
    document.getElementById('imageInput').addEventListener('change', handleFileSelect);
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
    
    console.log('Raw OCR Text:', text); // Debug
    
    // Clean up the text
    const cleanText = text.replace(/\r/g, '').replace(/\n+/g, '\n');
    const lines = cleanText.split('\n').filter(line => line.trim());
    
    // Course code pattern - matches CSIT440, IT332, CS101, etc.
    const courseCodePattern = /\b([A-Z]{2,4}\s?\d{3,4}[A-Z]?)\b/g;
    
    // Time patterns - various formats
    const timePatterns = [
        /(\d{1,2}:\d{2}\s*(?:AM|PM))\s*[-–—to]+\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/gi,
        /(\d{1,2}:\d{2})\s*(?:AM|PM)?\s*[-–—to]+\s*(\d{1,2}:\d{2})\s*(?:AM|PM)?/gi,
        /(\d{1,2}:\d{2}\s*[AP]M)\s*(\d{1,2}:\d{2}\s*[AP]M)/gi
    ];
    
    // Day patterns
    const dayPatternSingle = /\b(TH|SU|M|T|W|F|S)\b/g;
    const dayPatternFull = /\b(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY|MON|TUE|WED|THU|FRI|SAT|SUN)\b/gi;
    
    // Room patterns
    const roomPattern = /\b(ONLINE|NGE\d*|CASEROOM|FIELD|LAB|LEC|ROOM\s*\d+|[A-Z]+\d{2,})\s*(LEC|LAB|LECTURE|LABORATORY)?\b/gi;
    
    // Strategy 1: Try to find course rows with all information
    const fullText = lines.join(' ');
    
    // Find all course codes first
    const courseCodes = [];
    let match;
    const codeRegex = /\b(CSIT|IT|CS|MATH|ENG|SCI|PHIL|PE)\s?(\d{3,4}[A-Z]?)\b/gi;
    
    while ((match = codeRegex.exec(fullText)) !== null) {
        const code = (match[1] + match[2]).replace(/\s/g, '');
        if (!courseCodes.includes(code)) {
            courseCodes.push(code);
        }
    }
    
    console.log('Found course codes:', courseCodes);
    
    // For each line, try to extract course information
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const nextLines = lines.slice(i, i + 3).join(' '); // Look at current and next 2 lines
        
        // Check if line contains a course code
        const codeMatch = line.match(/\b([A-Z]{2,4}\s?\d{3,4}[A-Z]?)\b/);
        if (!codeMatch) continue;
        
        const courseCode = codeMatch[1].replace(/\s/g, '');
        
        // Extract times from this line or nearby lines
        let startTime = '', endTime = '';
        for (const pattern of timePatterns) {
            pattern.lastIndex = 0;
            const timeMatch = pattern.exec(nextLines);
            if (timeMatch) {
                startTime = normalizeTime(timeMatch[1]);
                endTime = normalizeTime(timeMatch[2]);
                break;
            }
        }
        
        // Extract days
        const days = [];
        
        // Check for single letter days (be careful with T and TH)
        const dayText = nextLines.toUpperCase();
        
        // First check for TH (Thursday) to avoid confusion with T
        if (dayText.includes('TH') || dayText.includes('THURSDAY') || dayText.includes('THU')) {
            days.push('TH');
        }
        if (/\bT\b/.test(dayText) || dayText.includes('TUESDAY') || dayText.includes('TUE')) {
            if (!days.includes('T')) days.push('T');
        }
        if (/\bM\b/.test(dayText) || dayText.includes('MONDAY') || dayText.includes('MON')) {
            days.push('M');
        }
        if (/\bW\b/.test(dayText) || dayText.includes('WEDNESDAY') || dayText.includes('WED')) {
            days.push('W');
        }
        if (/\bF\b/.test(dayText) || dayText.includes('FRIDAY') || dayText.includes('FRI')) {
            days.push('F');
        }
        if (/\bS\b/.test(dayText) || dayText.includes('SATURDAY') || dayText.includes('SAT')) {
            if (!days.includes('S')) days.push('S');
        }
        if (/\bSU\b/.test(dayText) || dayText.includes('SUNDAY') || dayText.includes('SUN')) {
            days.push('SU');
        }
        
        // Extract room
        let room = '';
        const roomMatch = nextLines.match(roomPattern);
        if (roomMatch) {
            room = roomMatch.join(' ').trim();
        }
        
        // Extract title (text between code and other data)
        let title = '';
        const afterCode = line.substring(line.indexOf(courseCode) + courseCode.length).trim();
        const titleMatch = afterCode.match(/^([A-Za-z\s&]+)/);
        if (titleMatch) {
            title = titleMatch[1].trim();
            // Clean up title
            if (title.length > 50) title = title.substring(0, 50);
        }
        
        // Only add if we have meaningful data
        if (courseCode && (days.length > 0 || startTime)) {
            const course = {
                id: Date.now() + Math.random(),
                code: courseCode,
                title: title,
                days: [...new Set(days)],
                startTime: startTime,
                endTime: endTime,
                room: room
            };
            
            // Check if we already have this course
            const exists = extractedCourses.some(c => c.code === courseCode);
            if (!exists) {
                extractedCourses.push(course);
                console.log('Extracted course:', course);
            }
        }
    }
    
    // If no courses found, try alternative parsing
    if (extractedCourses.length === 0) {
        console.log('Trying alternative parsing...');
        
        // Look for any course codes and create entries
        courseCodes.forEach(code => {
            extractedCourses.push({
                id: Date.now() + Math.random(),
                code: code,
                title: '',
                days: [],
                startTime: '',
                endTime: '',
                room: ''
            });
        });
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
    
    if (savedSchedules.length === 0) {
        section.style.display = 'none';
        return;
    }
    
    section.style.display = 'block';
    list.innerHTML = '';
    
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
                <button class="load-schedule-btn" onclick="loadSavedSchedule(${schedule.id})">📂 Load</button>
                <button class="delete-schedule-btn" onclick="deleteSavedSchedule(${schedule.id})">🗑️</button>
            </div>
        `;
        
        list.appendChild(card);
    });
}

function loadSavedSchedule(id) {
    const schedule = savedSchedules.find(s => s.id === id);
    if (!schedule) {
        showToast('Schedule not found', 'error');
        return;
    }
    
    if (courses.length > 0) {
        if (!confirm('This will replace your current schedule. Continue?')) {
            return;
        }
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

function deleteSavedSchedule(id) {
    const schedule = savedSchedules.find(s => s.id === id);
    if (!schedule) return;
    
    if (!confirm(`Delete "${schedule.name}"?`)) {
        return;
    }
    
    savedSchedules = savedSchedules.filter(s => s.id !== id);
    saveSavedSchedules();
    updateSavedSchedulesList();
    showToast('Schedule deleted', 'success');
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
function parseTextInput() {
    const textarea = document.getElementById('pasteArea');
    const text = textarea.value.trim();
    
    if (!text) {
        showToast('Please paste your schedule data first', 'error');
        return;
    }
    
    const extractedCourses = parseScheduleFromText(text);
    
    if (extractedCourses.length > 0) {
        courses = [...courses, ...extractedCourses];
        saveToStorage();
        updateCoursesTable();
        textarea.value = '';
        showToast(`Added ${extractedCourses.length} course(s)!`, 'success');
    } else {
        showToast('Could not parse courses. Check format.', 'error');
    }
}

// Better text parsing for pasted schedule data - handles multi-line format
function parseScheduleFromText(text) {
    const extractedCourses = [];
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    
    // Check if this is the multi-line format (starts with CCS or similar college code)
    if (text.includes('BACHELOR OF SCIENCE') || text.includes('CCS')) {
        return parseMultiLineFormat(lines);
    }
    
    // Otherwise try the simple one-line-per-course format
    return parseSimpleFormat(lines);
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
