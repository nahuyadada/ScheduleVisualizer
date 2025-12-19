// Builder Page JavaScript

const courseColors = [
    'color-1', 'color-2', 'color-3', 'color-4', 'color-5',
    'color-6', 'color-7', 'color-8', 'color-9', 'color-10'
];
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
let selectedSchedule = null;
let newScheduleCourses = [];
let globalCourseColorMap = {};

document.addEventListener('DOMContentLoaded', () => {
    loadSavedSchedules();
    populateSelector();
    initDropZone();
});

function loadSavedSchedules() {
    const stored = localStorage.getItem('scheduleVisualizerSavedSchedules');
    if (stored) {
        savedSchedules = JSON.parse(stored);
    }
}

function populateSelector() {
    const select = document.getElementById('savedScheduleSelect');
    savedSchedules.forEach(schedule => {
        const option = document.createElement('option');
        option.value = schedule.id;
        option.textContent = `${schedule.name} (${schedule.uniqueCourses} courses)`;
        select.appendChild(option);
    });
    select.addEventListener('change', () => {
        loadSchedulePreview();
    });
}

function loadSchedulePreview() {
    const select = document.getElementById('savedScheduleSelect');
    const scheduleId = select.value;
    if (!scheduleId) {
        clearPanel();
        return;
    }
    selectedSchedule = savedSchedules.find(s => s.id == scheduleId || s.id === scheduleId);
    rebuildGlobalColorMap();
    renderSchedulePanel(selectedSchedule);
}

function clearPanel() {
    document.getElementById('savedScheduleGrid').innerHTML = '<div class="empty-panel">Select a saved schedule to preview</div>';
    document.getElementById('savedScheduleLegend').innerHTML = '';
    document.getElementById('savedScheduleTitle').textContent = 'Select a saved schedule';
    document.getElementById('savedScheduleStats').innerHTML = '';
}

function rebuildGlobalColorMap() {
    const allCodes = new Set();
    if (selectedSchedule) {
        selectedSchedule.courses.forEach(c => allCodes.add(c.code));
    }
    globalCourseColorMap = {};
    [...allCodes].sort().forEach((code, idx) => {
        globalCourseColorMap[code] = courseColors[idx % courseColors.length];
    });
}

function renderSchedulePanel(schedule) {
    const grid = document.getElementById('savedScheduleGrid');
    const legend = document.getElementById('savedScheduleLegend');
    const title = document.getElementById('savedScheduleTitle');
    const stats = document.getElementById('savedScheduleStats');
    title.textContent = schedule.name;
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
    renderGrid(grid, courses);
    renderLegend(legend, courses);
}

function renderGrid(gridElement, courses) {
    gridElement.innerHTML = '';
    const startHour = 7;
    const endHour = 22;
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
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
    placeCourseBlocks(gridElement, courses);
}

function placeCourseBlocks(gridElement, courses) {
    const slotHeight = 20;
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
    const seenKeys = new Set();
    courses.forEach(course => {
        const key = course.section ? `${course.code}|${course.section}` : course.code;
        if (seenKeys.has(key)) return;
        seenKeys.add(key);
        const colorClass = globalCourseColorMap[course.code] || 'color-1';
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `
            <div class="legend-color ${colorClass}"></div>
            <span>${course.code}${course.section ? ' <span class="legend-section">' + course.section + '</span>' : ''}</span>
        `;
        item.title = `Drag to add ${course.code}${course.section ? ' (' + course.section + ')' : ''} to new schedule`;
        makeDraggable(item, course.code, course.section);
        legendElement.appendChild(item);
    });
}

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
        const courseKey = e.dataTransfer.getData('text/plain');
        if (courseKey) {
            addCourseToNewSchedule(courseKey);
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
    const [courseCode, section] = courseKey.includes('|') ? courseKey.split('|') : [courseKey, null];
    const alreadyExists = newScheduleCourses.some(c => c.code === courseCode && (section ? c.section === section : true));
    if (alreadyExists) return;
    const coursesFrom = [];
    if (selectedSchedule) {
        const fromSchedule = selectedSchedule.courses.filter(c => c.code === courseCode && (section ? c.section === section : true));
        coursesFrom.push(...fromSchedule);
    }
    newScheduleCourses.push(...coursesFrom);
    renderNewSchedule();
    // Re-render the source schedule panel so blocks already added become grayed-out
    if (selectedSchedule) renderSchedulePanel(selectedSchedule);
}

function removeCourseFromNewSchedule(courseKey) {
    const [courseCode, section] = courseKey.includes('|') ? courseKey.split('|') : [courseKey, null];
    newScheduleCourses = newScheduleCourses.filter(c => {
        if (section) {
            return !(c.code === courseCode && c.section === section);
        } else {
            return c.code !== courseCode;
        }
    });
    renderNewSchedule();
    // Re-render the source schedule panel to un-gray items if removed
    if (selectedSchedule) renderSchedulePanel(selectedSchedule);
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
    renderNewScheduleGrid(grid, newScheduleCourses);
    renderNewScheduleLegend(legend, newScheduleCourses);
}

function renderNewScheduleGrid(gridElement, courses) {
    gridElement.innerHTML = '';
    const startHour = 7;
    const endHour = 22;
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
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
    placeNewScheduleCourseBlocks(gridElement, courses);
}

function placeNewScheduleCourseBlocks(gridElement, courses) {
    const slotHeight = 25;
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
    const seenKeys = new Set();
    courses.forEach(course => {
        const key = course.section ? `${course.code}|${course.section}` : course.code;
        if (seenKeys.has(key)) return;
        seenKeys.add(key);
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
    if (selectedSchedule) renderSchedulePanel(selectedSchedule);
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
    let allSaved = [];
    const stored = localStorage.getItem('scheduleVisualizerSavedSchedules');
    if (stored) {
        allSaved = JSON.parse(stored);
    }
    allSaved.push(scheduleToSave);
    localStorage.setItem('scheduleVisualizerSavedSchedules', JSON.stringify(allSaved));
    alert(`Schedule "${name}" saved successfully!`);
    location.reload();
}

function useNewSchedule() {
    if (newScheduleCourses.length === 0) {
        alert('Add some courses first!');
        return;
    }
    localStorage.setItem('scheduleVisualizerCourses', JSON.stringify(newScheduleCourses));
    alert('Schedule set as current! Redirecting to main page...');
    window.location.href = 'index.html';
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
