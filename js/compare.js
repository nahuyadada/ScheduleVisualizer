// Compare Schedules Page JavaScript

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

let savedSchedules = [];
let schedule1Data = null;
let schedule2Data = null;
let newScheduleCourses = []; // Courses for the new schedule being built
let globalCourseColorMap = {}; // Global color mapping for consistent colors

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadSavedSchedules();
    populateSelectors();
    initDropZone();
});

function loadSavedSchedules() {
    const stored = localStorage.getItem('scheduleVisualizerSavedSchedules');
    if (stored) {
        savedSchedules = JSON.parse(stored);
    }

    // Also add current schedule if it exists
    const currentCourses = localStorage.getItem('scheduleVisualizerCourses');
    if (currentCourses) {
        const courses = JSON.parse(currentCourses);
        if (courses.length > 0) {
            // Check if "Current Schedule" already exists in saved
            const hasCurrentOption = true; // We'll always show current
            savedSchedules = [{
                id: 'current',
                name: '📌 Current Schedule (Unsaved)',
                courses: courses,
                createdAt: new Date().toISOString(),
                courseCount: courses.length,
                uniqueCourses: [...new Set(courses.map(c => c.code))].length
            }, ...savedSchedules];
        }
    }
}

function populateSelectors() {
    const select1 = document.getElementById('schedule1Select');
    const select2 = document.getElementById('schedule2Select');

    savedSchedules.forEach(schedule => {
        const option1 = document.createElement('option');
        option1.value = schedule.id;
        option1.textContent = `${schedule.name} (${schedule.uniqueCourses} courses)`;
        select1.appendChild(option1);

        const option2 = document.createElement('option');
        option2.value = schedule.id;
        option2.textContent = `${schedule.name} (${schedule.uniqueCourses} courses)`;
        select2.appendChild(option2);
    });
}

function loadSchedulePreview(panelNum) {
    const select = document.getElementById(`schedule${panelNum}Select`);
    const scheduleId = select.value;

    if (!scheduleId) {
        clearPanel(panelNum);
        return;
    }

    const schedule = savedSchedules.find(s => s.id == scheduleId || s.id === scheduleId);
    if (!schedule) {
        clearPanel(panelNum);
        return;
    }

    if (panelNum === 1) {
        schedule1Data = schedule;
    } else {
        schedule2Data = schedule;
    }

    // Rebuild global color map based on all loaded schedules
    rebuildGlobalColorMap();

    // Re-render both panels to use consistent colors
    if (schedule1Data) renderSchedulePanel(1, schedule1Data);
    if (schedule2Data) renderSchedulePanel(2, schedule2Data);
}

function rebuildGlobalColorMap() {
    // Collect all unique course codes from both schedules
    const allCodes = new Set();

    if (schedule1Data) {
        schedule1Data.courses.forEach(c => allCodes.add(c.code));
    }
    if (schedule2Data) {
        schedule2Data.courses.forEach(c => allCodes.add(c.code));
    }

    // Assign colors to each unique course code
    globalCourseColorMap = {};
    [...allCodes].sort().forEach((code, idx) => {
        globalCourseColorMap[code] = courseColors[idx % courseColors.length];
    });
}

function clearPanel(panelNum) {
    const grid = document.getElementById(`grid${panelNum}`);
    const legend = document.getElementById(`legend${panelNum}`);
    const title = document.getElementById(`panel${panelNum}Title`);
    const stats = document.getElementById(`panel${panelNum}Stats`);

    grid.innerHTML = '<div class="empty-panel">Select a schedule to preview</div>';
    legend.innerHTML = '';
    title.textContent = 'Select a schedule';
    stats.innerHTML = '';

    if (panelNum === 1) schedule1Data = null;
    else schedule2Data = null;

    document.getElementById('comparisonSummary').style.display = 'none';
}

function renderSchedulePanel(panelNum, schedule) {
    const grid = document.getElementById(`grid${panelNum}`);
    const legend = document.getElementById(`legend${panelNum}`);
    const title = document.getElementById(`panel${panelNum}Title`);
    const stats = document.getElementById(`panel${panelNum}Stats`);

    title.textContent = schedule.name;

    // Calculate stats
    const courses = schedule.courses;
    const uniqueCourses = [...new Set(courses.map(c => c.code))];
    const totalHours = calculateTotalHours(courses);
    const onlineCourses = courses.filter(c => c.room?.toUpperCase().includes('ONLINE')).length;

    stats.innerHTML = `
        <div class="stat-item">📚 <span>${uniqueCourses.length}</span> Courses</div>
        <div class="stat-item">📅 <span>${courses.length}</span> Sessions</div>
        <div class="stat-item">⏱️ <span>${totalHours}</span> Hours/Week</div>
        <div class="stat-item">🌐 <span>${onlineCourses}</span> Online</div>
    `;

    // Render grid
    renderGrid(grid, courses);

    // Render legend
    renderLegend(legend, courses);
}

function renderGrid(gridElement, courses) {
    gridElement.innerHTML = '';

    const startHour = 7;
    const endHour = 22;
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    // Header row
    const headerEmpty = document.createElement('div');
    headerEmpty.className = 'schedule-header';
    headerEmpty.textContent = 'Time';
    gridElement.appendChild(headerEmpty);

    days.forEach(day => {
        const header = document.createElement('div');
        header.className = 'schedule-header';
        header.textContent = day.substring(0, 3);
        gridElement.appendChild(header);
    });

    // Time slots (every 30 min)
    for (let hour = startHour; hour < endHour; hour++) {
        for (let half = 0; half < 2; half++) {
            const minutes = half * 30;
            const isHalfHour = half === 1;

            const timeSlot = document.createElement('div');
            timeSlot.className = 'time-slot' + (isHalfHour ? ' half-hour' : '');
            const displayHour = hour > 12 ? hour - 12 : hour;
            const period = hour >= 12 ? 'PM' : 'AM';
            timeSlot.innerHTML = `${displayHour}:${minutes.toString().padStart(2, '0')}`;
            gridElement.appendChild(timeSlot);

            days.forEach(day => {
                const cell = document.createElement('div');
                cell.className = 'schedule-cell' + (isHalfHour ? ' half-hour-cell' : '');
                cell.dataset.day = day;
                cell.dataset.hour = hour;
                cell.dataset.minutes = minutes;
                gridElement.appendChild(cell);
            });
        }
    }

    // Place course blocks
    placeCourseBlocks(gridElement, courses);
}

function placeCourseBlocks(gridElement, courses) {
    const slotHeight = 20;

    // Use global color map for consistent colors across schedules
    courses.forEach(course => {
        if (course.isTBA) return;

        const colorClass = globalCourseColorMap[course.code] || 'color-1';

        // Check if this course code is already in the build area (any section)
        const isInBuildArea = newScheduleCourses.some(c => c.code === course.code);

        // Check for time conflicts with courses in the build area
        const conflictInfo = checkTimeConflict(course);
        const hasConflict = conflictInfo !== null;
        const shouldGrayOut = isInBuildArea || hasConflict;

        course.days.forEach(dayCode => {
            const dayName = dayMap[dayCode];
            if (!dayName) return;

            const startMinutes = timeToMinutes(course.startTime);
            const endMinutes = timeToMinutes(course.endTime);

            if (startMinutes === null || endMinutes === null) return;

            const duration = endMinutes - startMinutes;
            const startCellHour = Math.floor(startMinutes / 60);
            const startCellMinutes = startMinutes % 60 >= 30 ? 30 : 0;

            const cell = gridElement.querySelector(`.schedule-cell[data-day="${dayName}"][data-hour="${startCellHour}"][data-minutes="${startCellMinutes}"]`);
            if (!cell) return;

            const block = document.createElement('div');
            block.className = `course-block ${colorClass}`;

            // Add grayed-out class if already in build area or has conflict
            if (shouldGrayOut) block.classList.add('grayed-out');
            if (hasConflict) block.classList.add('has-conflict');

            const minuteOffset = startMinutes % 30;
            const topOffset = (minuteOffset / 30) * slotHeight;
            const blockHeight = (duration / 30) * slotHeight;

            block.style.top = `${topOffset}px`;
            block.style.height = `${blockHeight - 2}px`;

            const isOnline = course.room?.toUpperCase().includes('ONLINE');

            block.innerHTML = `
                ${isOnline ? '<div class="online-badge">🌐</div>' : ''}
                <div class="course-code">${course.code}${course.section ? ' <span class="course-section">' + course.section + '</span>' : ''}</div>
            `;

            if (isOnline) {
                block.classList.add('online-course');
            }

            // Build tooltip with conflict reason
            let tooltip = `${course.code}${course.section ? ' (' + course.section + ')' : ''}${course.title ? '\n' + course.title : ''}\n${formatTimeDisplay(course.startTime)} - ${formatTimeDisplay(course.endTime)}${course.room ? '\n' + course.room : ''}`;
            if (isInBuildArea) {
                tooltip += '\n\n✅ Already in your schedule';
            } else if (hasConflict) {
                tooltip += `\n\n⚠️ TIME CONFLICT with ${conflictInfo.code}${conflictInfo.section ? ' (' + conflictInfo.section + ')' : ''}\non ${conflictInfo.day} ${formatTimeDisplay(conflictInfo.startTime)} - ${formatTimeDisplay(conflictInfo.endTime)}`;
            } else {
                tooltip += '\n\n🖱️ Drag to add to new schedule';
            }
            block.title = tooltip;

            // Make course block draggable only if not grayed out
            if (!shouldGrayOut) makeDraggable(block, course.code, course.section);

            cell.appendChild(block);
        });
    });
}

// Check if a course has time conflict with any course in the build area
function checkTimeConflict(course) {
    if (!course.days || course.isTBA) return null;

    for (const buildCourse of newScheduleCourses) {
        if (buildCourse.isTBA || !buildCourse.days) continue;
        if (buildCourse.code === course.code) continue; // Same course, skip (handled by isInBuildArea)

        // Check each day combination
        for (const day1 of course.days) {
            for (const day2 of buildCourse.days) {
                if (day1 === day2) {
                    // Same day - check time overlap
                    const start1 = timeToMinutes(course.startTime);
                    const end1 = timeToMinutes(course.endTime);
                    const start2 = timeToMinutes(buildCourse.startTime);
                    const end2 = timeToMinutes(buildCourse.endTime);

                    if (start1 !== null && end1 !== null && start2 !== null && end2 !== null) {
                        // Check if times overlap
                        if (start1 < end2 && start2 < end1) {
                            return {
                                code: buildCourse.code,
                                section: buildCourse.section,
                                day: dayMap[day1] || day1,
                                startTime: buildCourse.startTime,
                                endTime: buildCourse.endTime
                            };
                        }
                    }
                }
            }
        }
    }
    return null;
}

function renderLegend(legendElement, courses) {
    legendElement.innerHTML = '';

    // Track unique code+section combinations
    const seenKeys = new Set();
    courses.forEach(course => {
        const key = course.section ? `${course.code}|${course.section}` : course.code;
        if (seenKeys.has(key)) return;
        seenKeys.add(key);

        // Use global color map for consistent colors
        const colorClass = globalCourseColorMap[course.code] || 'color-1';
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `
            <div class="legend-color ${colorClass}"></div>
            <span>${course.code}${course.section ? ' <span class="legend-section">' + course.section + '</span>' : ''}</span>
        `;
        item.title = `Drag to add ${course.code}${course.section ? ' (' + course.section + ')' : ''} to new schedule`;

        // Make legend item draggable - include section
        makeDraggable(item, course.code, course.section);

        legendElement.appendChild(item);
    });
}

function calculateTotalHours(courses) {
    let totalMinutes = 0;
    courses.forEach(course => {
        if (course.isTBA) return;
        const start = timeToMinutes(course.startTime);
        const end = timeToMinutes(course.endTime);
        if (start !== null && end !== null) {
            totalMinutes += (end - start);
        }
    });
    return Math.round(totalMinutes / 60 * 10) / 10;
}

function timeToMinutes(timeStr) {
    if (!timeStr) return null;
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (match) {
        return parseInt(match[1]) * 60 + parseInt(match[2]);
    }
    return null;
}

function formatTimeDisplay(time) {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayHour = h > 12 ? h - 12 : (h === 0 ? 12 : h);
    return `${displayHour}:${minutes} ${period}`;
}

// ========== Drag and Drop Functionality ==========

function initDropZone() {
    const dropZone = document.getElementById('builderDropZone');

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');

        const courseCode = e.dataTransfer.getData('text/plain');
        if (courseCode) {
            addCourseToNewSchedule(courseCode);
        }
    });
}

function makeDraggable(element, courseCode, section) {
    element.draggable = true;
    const courseKey = section ? `${courseCode}|${section}` : courseCode;
    element.dataset.courseKey = courseKey;

    element.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', courseKey);
        element.classList.add('dragging');

        // Highlight all blocks with the same course code + section
        document.querySelectorAll(`[data-course-key="${courseKey}"]`).forEach(el => {
            el.classList.add('dragging');
        });
    });

    element.addEventListener('dragend', () => {
        element.classList.remove('dragging');
        document.querySelectorAll('.dragging').forEach(el => {
            el.classList.remove('dragging');
        });
    });
}

function addCourseToNewSchedule(courseKey) {
    // Parse the course key (format: "CODE|SECTION" or just "CODE")
    const [courseCode, section] = courseKey.includes('|') ? courseKey.split('|') : [courseKey, null];

    // Check if this specific course+section already exists in new schedule
    const alreadyExists = newScheduleCourses.some(c =>
        c.code === courseCode && (section ? c.section === section : true)
    );
    if (alreadyExists) {
        return; // Already added
    }

    // Get all sessions with this course code AND section from both schedules
    const coursesFromBoth = [];

    if (schedule1Data) {
        const fromSchedule1 = schedule1Data.courses.filter(c =>
            c.code === courseCode && (section ? c.section === section : true)
        );
        coursesFromBoth.push(...fromSchedule1);
    }

    if (schedule2Data) {
        const fromSchedule2 = schedule2Data.courses.filter(c =>
            c.code === courseCode && (section ? c.section === section : true)
        );
        // Add only if not duplicate (same day/time)
        fromSchedule2.forEach(course => {
            const isDuplicate = coursesFromBoth.some(existing =>
                existing.code === course.code &&
                JSON.stringify(existing.days) === JSON.stringify(course.days) &&
                existing.startTime === course.startTime &&
                existing.endTime === course.endTime
            );
            if (!isDuplicate) {
                coursesFromBoth.push(course);
            }
        });
    }

    newScheduleCourses.push(...coursesFromBoth);
    renderNewSchedule();

    // Re-render source schedule panels so blocks already added become grayed-out
    if (schedule1Data) renderSchedulePanel(1, schedule1Data);
    if (schedule2Data) renderSchedulePanel(2, schedule2Data);
}

function removeCourseFromNewSchedule(courseKey) {
    // Parse the course key (format: "CODE|SECTION" or just "CODE")
    const [courseCode, section] = courseKey.includes('|') ? courseKey.split('|') : [courseKey, null];

    newScheduleCourses = newScheduleCourses.filter(c => {
        if (section) {
            // Remove only courses matching both code and section
            return !(c.code === courseCode && c.section === section);
        } else {
            // Remove all courses with this code (no section specified)
            return c.code !== courseCode;
        }
    });
    renderNewSchedule();

    // Re-render source schedule panels to un-gray removed items
    if (schedule1Data) renderSchedulePanel(1, schedule1Data);
    if (schedule2Data) renderSchedulePanel(2, schedule2Data);
}

function renderNewSchedule() {
    const dropZoneContent = document.getElementById('dropZoneContent');
    const gridContainer = document.getElementById('newScheduleGridContainer');
    const grid = document.getElementById('newScheduleGrid');
    const legend = document.getElementById('builderLegend');
    const actions = document.getElementById('builderActions');

    if (newScheduleCourses.length === 0) {
        dropZoneContent.style.display = 'flex';
        gridContainer.style.display = 'none';
        legend.innerHTML = '';
        actions.style.display = 'none';
        return;
    }

    dropZoneContent.style.display = 'none';
    gridContainer.style.display = 'block';
    actions.style.display = 'flex';

    // Render grid
    renderNewScheduleGrid(grid, newScheduleCourses);

    // Render legend with remove buttons
    renderNewScheduleLegend(legend, newScheduleCourses);
}

function renderNewScheduleGrid(gridElement, courses) {
    gridElement.innerHTML = '';

    const startHour = 7;
    const endHour = 22;
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    // Header row
    const headerEmpty = document.createElement('div');
    headerEmpty.className = 'schedule-header';
    headerEmpty.textContent = 'Time';
    gridElement.appendChild(headerEmpty);

    days.forEach(day => {
        const header = document.createElement('div');
        header.className = 'schedule-header';
        header.textContent = day.substring(0, 3);
        gridElement.appendChild(header);
    });

    // Time slots (every 30 min)
    for (let hour = startHour; hour < endHour; hour++) {
        for (let half = 0; half < 2; half++) {
            const minutes = half * 30;
            const isHalfHour = half === 1;

            const timeSlot = document.createElement('div');
            timeSlot.className = 'time-slot' + (isHalfHour ? ' half-hour' : '');
            const displayHour = hour > 12 ? hour - 12 : hour;
            timeSlot.innerHTML = `${displayHour}:${minutes.toString().padStart(2, '0')}`;
            gridElement.appendChild(timeSlot);

            days.forEach(day => {
                const cell = document.createElement('div');
                cell.className = 'schedule-cell' + (isHalfHour ? ' half-hour-cell' : '');
                cell.dataset.day = day;
                cell.dataset.hour = hour;
                cell.dataset.minutes = minutes;
                gridElement.appendChild(cell);
            });
        }
    }

    // Place course blocks
    placeNewScheduleCourseBlocks(gridElement, courses);
}

function placeNewScheduleCourseBlocks(gridElement, courses) {
    const slotHeight = 25;

    // Use global color map for consistent colors
    courses.forEach(course => {
        if (course.isTBA) return;

        const colorClass = globalCourseColorMap[course.code] || 'color-1';

        course.days.forEach(dayCode => {
            const dayName = dayMap[dayCode];
            if (!dayName) return;

            const startMinutes = timeToMinutes(course.startTime);
            const endMinutes = timeToMinutes(course.endTime);

            if (startMinutes === null || endMinutes === null) return;

            const duration = endMinutes - startMinutes;
            const startCellHour = Math.floor(startMinutes / 60);
            const startCellMinutes = startMinutes % 60 >= 30 ? 30 : 0;

            const cell = gridElement.querySelector(`.schedule-cell[data-day="${dayName}"][data-hour="${startCellHour}"][data-minutes="${startCellMinutes}"]`);
            if (!cell) return;

            const block = document.createElement('div');
            block.className = `course-block ${colorClass}`;

            const minuteOffset = startMinutes % 30;
            const topOffset = (minuteOffset / 30) * slotHeight;
            const blockHeight = (duration / 30) * slotHeight;

            block.style.top = `${topOffset}px`;
            block.style.height = `${blockHeight - 2}px`;

            const isOnline = course.room?.toUpperCase().includes('ONLINE');

            block.innerHTML = `
                ${isOnline ? '<div class="online-badge">🌐</div>' : ''}
                <div class="course-code">${course.code}${course.section ? ' <span class="course-section">' + course.section + '</span>' : ''}</div>
                <div class="course-time">${formatTimeDisplay(course.startTime)} - ${formatTimeDisplay(course.endTime)}</div>
            `;

            if (isOnline) {
                block.classList.add('online-course');
            }

            block.title = `${course.code}${course.section ? ' (' + course.section + ')' : ''}${course.title ? '\n' + course.title : ''}\n${formatTimeDisplay(course.startTime)} - ${formatTimeDisplay(course.endTime)}${course.room ? '\n' + course.room : ''}`;

            cell.appendChild(block);
        });
    });
}

function renderNewScheduleLegend(legendElement, courses) {
    legendElement.innerHTML = '';

    // Track unique code+section combinations
    const seenKeys = new Set();
    courses.forEach(course => {
        const key = course.section ? `${course.code}|${course.section}` : course.code;
        if (seenKeys.has(key)) return;
        seenKeys.add(key);

        // Use global color map for consistent colors
        const colorClass = globalCourseColorMap[course.code] || 'color-1';
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `
            <div class="legend-color ${colorClass}"></div>
            <span>${course.code}${course.section ? ' <span class="legend-section">' + course.section + '</span>' : ''}</span>
            <button class="remove-course" onclick="removeCourseFromNewSchedule('${key}')" title="Remove course">✕</button>
        `;
        legendElement.appendChild(item);
    });
}

function clearNewSchedule() {
    newScheduleCourses = [];
    renderNewSchedule();
}

function saveNewSchedule() {
    if (newScheduleCourses.length === 0) {
        alert('Add some courses first!');
        return;
    }

    const name = prompt('Enter a name for this schedule:');
    if (!name || !name.trim()) return;

    const scheduleToSave = {
        id: Date.now().toString(),
        name: name.trim(),
        courses: newScheduleCourses,
        createdAt: new Date().toISOString(),
        courseCount: newScheduleCourses.length,
        uniqueCourses: [...new Set(newScheduleCourses.map(c => c.code))].length
    };

    // Get existing saved schedules
    let allSaved = [];
    const stored = localStorage.getItem('scheduleVisualizerSavedSchedules');
    if (stored) {
        allSaved = JSON.parse(stored);
    }

    allSaved.push(scheduleToSave);
    localStorage.setItem('scheduleVisualizerSavedSchedules', JSON.stringify(allSaved));

    alert(`Schedule "${name}" saved successfully!`);

    // Refresh selectors
    location.reload();
}

function useNewSchedule() {
    if (newScheduleCourses.length === 0) {
        alert('Add some courses first!');
        return;
    }

    // Set as current schedule in localStorage
    localStorage.setItem('scheduleVisualizerCourses', JSON.stringify(newScheduleCourses));

    alert('Schedule set as current! Redirecting to main page...');
    window.location.href = 'index.html';
}
