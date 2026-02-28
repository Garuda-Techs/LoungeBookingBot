// Telegram Web App initialization
let tg = window.Telegram?.WebApp;
let telegramUser = null;

const ALL_TIME_SLOTS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

// State
let currentDate = new Date();
let selectedDate = null;
let selectedTimeSlots = []; 
let selectedLevel = 9; // Default floor
let isUserAdmin = false; 

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Telegram Web App
    // Check if the user data actually exists inside Telegram
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
        tg.ready();
        tg.expand();
        
        // Get Telegram user info
        telegramUser = tg.initDataUnsafe.user;
        
        displayUserInfo();
        try {
            const safeId = String(telegramUser.id).split('.')[0];
            const adminRes = await fetch(`/api/bookings/is-admin/${safeId}`);
            if (adminRes.ok) {
                const adminData = await adminRes.json();
                isUserAdmin = adminData.isAdmin;
            }
        } catch (err) {
            console.error('Failed to check admin status', err);
        }
    } else {
        // Fallback for testing on Desktop/Chrome without Telegram
        console.log("Running in local browser mode!");
        telegramUser = {
            id: '1949513693', // Replaced with your real ID so you get Admin powers locally!
            first_name: 'Gabriel',
            last_name: 'Wan',
            username: 'gabrielwan'
        };
        displayUserInfo();
        
        // Still check admin status for the local fallback user
        try {
            const adminRes = await fetch(`/api/bookings/is-admin/${telegramUser.id}`);
            if (adminRes.ok) {
                const adminData = await adminRes.json();
                isUserAdmin = adminData.isAdmin;
            }
        } catch (err) {
            console.error('Failed to check local admin status', err);
        }
    }
    
    // --- 1. Level Switcher Logic ---
    document.querySelectorAll('.level-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            // Update UI Active State
            document.querySelectorAll('.level-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Update State
            selectedLevel = parseInt(this.dataset.level);

            // SYNC UI: Immediately update the confirmation text floor
            const confirmLevel = document.getElementById('confirmLevel');
            if (confirmLevel) {
                confirmLevel.textContent = selectedLevel; 
            }
            
            // Reset selections to avoid "ghost" bookings from other floors
            selectedTimeSlots = []; 
            hideBookingForm(); 

            // Refresh timings for the new floor if a date is already active
            if (selectedDate) {
                loadTimeSlots(selectedDate);
            }

            // Update the horizontal scrolling list for the new floor
            loadUpcomingBookings(selectedLevel);
        });
    });

    // Initialize calendar
    renderCalendar();
    
    // Load user's bookings
    await loadMyBookings();

    // Load the upcoming bookings for the default floor (Level 9)
    await loadUpcomingBookings(selectedLevel);
    
    // Global Event listeners
    document.getElementById('prevMonth').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });
    
    document.getElementById('nextMonth').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });
    
    document.getElementById('cancelBooking').addEventListener('click', () => {
        hideBookingForm();
    });
    
    document.getElementById('confirmBooking').addEventListener('click', confirmBooking);
});

// Display user information
function displayUserInfo() {
    const userInfo = document.getElementById('userInfo');
    const userName = document.getElementById('userName');
    
    if (telegramUser) {
        const name = telegramUser.first_name + (telegramUser.last_name ? ' ' + telegramUser.last_name : '');
        userName.textContent = name;
        userInfo.classList.remove('hidden');
    }
}

function renderCalendar() {
    const calendar = document.getElementById('calendar');
    const monthYear = document.getElementById('currentMonth');
    
    calendar.innerHTML = '';
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    monthYear.textContent = `${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    
    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayHeaders.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'calendar-day header';
        dayHeader.textContent = day;
        calendar.appendChild(dayHeader);
    });
    
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const numDays = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < startingDayOfWeek; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day other-month';
        calendar.appendChild(emptyDay);
    }
    
    for (let day = 1; day <= numDays; day++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = day;
        
        const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        dateObj.setHours(0, 0, 0, 0);
        
        if (dateObj < today) {
            dayElement.classList.add('disabled');
        } else {
            dayElement.onclick = () => selectDate(dateObj);
        }
        
        if (selectedDate && dateObj.getTime() === selectedDate.getTime()) {
            dayElement.classList.add('selected');
        }
        
        calendar.appendChild(dayElement);
    }
}

async function selectDate(date) {
    selectedDate = new Date(date);
    selectedDate.setHours(0, 0, 0, 0); 
    selectedTimeSlots = []; 
    
    hideBookingForm(); 
    renderCalendar();
    
    document.getElementById('selectedDateInfo').classList.remove('hidden');
    document.getElementById('selectedDate').textContent = formatDate(date);
    document.getElementById('timeSlots').innerHTML = '<p class="empty-message">Loading timings...</p>'; 
    document.getElementById('timeSlotsSection').classList.remove('hidden'); 
    
    await loadTimeSlots(date);
}

async function loadTimeSlots(date) {
    showLoading(true);
    try {
        const dateStr = formatDateForAPI(date);
        const response = await fetch(`/api/bookings/available/${dateStr}?level=${selectedLevel}`);
        
        if (!response.ok) throw new Error('Failed to load');
        
        const data = await response.json();
        
        // Pass the new 'bookedDetails' instead of just 'data.booked'
        displayTimeSlots(data.available, data.bookedDetails); 
        
        document.getElementById('timeSlotsSection').classList.remove('hidden'); 
    } catch (error) {
        console.error('Error:', error);
        showToast('Failed to load slots', 'error');
    } finally {
        showLoading(false);
    }
}

function displayTimeSlots(available, bookedDetails) {
    const timeSlotsContainer = document.getElementById('timeSlots');
    timeSlotsContainer.innerHTML = '';

    const bookedMap = new Map();
    if (bookedDetails && Array.isArray(bookedDetails)) {
        bookedDetails.forEach(booking => bookedMap.set(booking.time_slot, booking));
    }

    const now = new Date();
    const isToday = selectedDate &&
        selectedDate.toDateString() === now.toDateString();

    ALL_TIME_SLOTS.forEach(slot => {
        const slotElement = document.createElement('div');
        slotElement.className = 'time-slot';
        slotElement.textContent = slot;

        // convert slot string to a time for comparison
        const [h] = slot.split(':').map(Number);
        const slotTime = new Date(selectedDate);
        slotTime.setHours(h, 0, 0, 0);

        const isPastSlot = isToday && slotTime <= now;

        if (bookedMap.has(slot)) {
            const detail = bookedMap.get(slot);
            slotElement.classList.add('booked');
            slotElement.onclick = () => {
                const fullName = [detail.first_name, detail.last_name].filter(Boolean).join(' ');
                const handleRaw = detail.telegram_username;
                
                // Create a clickable link if they have a handle
                const handleLink = handleRaw 
                    ? `<a href="https://t.me/${handleRaw}" target="_blank" class="tg-link">@${handleRaw}</a>` 
                    : '';
                
                // Format exactly as: @handle (name)
                const displayNameHTML = handleLink && fullName
                    ? `${handleLink} (${fullName})`
                    : handleLink || fullName || 'Unknown user';

                const note = detail.notes || 'No notes';
                
                showInfoModal(displayNameHTML, note, slot, detail.id);
            };

        } else if (isPastSlot) {
            // grey out past time slots
            slotElement.classList.add('disabled');
        } else {
            slotElement.onclick = function() {
                selectTimeSlot(slot, this);
            };
        }

        timeSlotsContainer.appendChild(slotElement);
    });
}

function selectTimeSlot(timeSlot, element) {
    const index = selectedTimeSlots.indexOf(timeSlot);
    
    if (index > -1) {
        selectedTimeSlots.splice(index, 1);
        element.classList.remove('selected-slot');
    } else {
        selectedTimeSlots.push(timeSlot);
        element.classList.add('selected-slot');
    }
    
    selectedTimeSlots.sort();
    
    if (selectedTimeSlots.length > 0) {
        showBookingForm();
    } else {
        hideBookingForm();
    }
}

function showBookingForm() {
    const bookingForm = document.getElementById('bookingForm');
    const bookingDate = document.getElementById('bookingDate');
    const bookingTime = document.getElementById('bookingTime');
    const confirmLevel = document.getElementById('confirmLevel'); 
    const bookingNotes = document.getElementById('bookingNotes');

    bookingNotes.disabled = false; // ensure it’s editable again
    bookingNotes.value = ''; // reset safely each time

    if (confirmLevel) confirmLevel.textContent = selectedLevel;
    bookingDate.textContent = formatDate(selectedDate);
    bookingTime.textContent = selectedTimeSlots.join(', '); 
   
    bookingForm.classList.remove('hidden');
    bookingForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideBookingForm() {
    const bookingForm = document.getElementById('bookingForm');
    const bookingNotes = document.getElementById('bookingNotes');

    bookingForm.classList.add('hidden');
    bookingNotes.disabled = false; // re-enable if Telegram input froze
    bookingNotes.value = ''; // always clear

    selectedTimeSlots = [];
    document.querySelectorAll('.time-slot.selected-slot').forEach(slot => slot.classList.remove('selected-slot'));
}

async function confirmBooking() {
    if (!selectedDate || selectedTimeSlots.length === 0) {
        showToast('Please select a date and time slot', 'error');
        return;
    }
    
    if (!telegramUser) {
        showToast('User information not available', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        const notes = document.getElementById('bookingNotes').value;
        const response = await fetch('/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                telegramUser: telegramUser,
                lounge_level: selectedLevel,
                date: formatDateForAPI(selectedDate),
                timeSlots: selectedTimeSlots,
                notes: notes
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create booking');
        }
        
        showToast(`Level ${selectedLevel} booking confirmed!`, 'success');
        
        selectedTimeSlots = [];
        hideBookingForm();
        
        await loadTimeSlots(selectedDate);
        await loadMyBookings();
        // Refresh the upcoming list so the new booking appears
        await loadUpcomingBookings(selectedLevel);
        
        if (tg) {
            tg.showPopup({
                title: 'Booking Confirmed',
                message: `Confirmed for Level ${selectedLevel} on ${formatDate(selectedDate)}.`,
                buttons: [{type: 'ok'}]
            });
        }
    } catch (error) {
        console.error('Error:', error);
        showToast(error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function loadMyBookings() {
    if (!telegramUser) return;
    try {
        const safeId = String(telegramUser.id).split('.')[0];
        const response = await fetch(`/api/bookings/user/${safeId}`);
        if (!response.ok) throw new Error('Failed to load');
        const bookings = await response.json();
        displayMyBookings(bookings);
    } catch (error) {
        console.error('Error:', error);
    }
}

function displayMyBookings(bookings) {
    const container = document.getElementById('myBookings');
    container.innerHTML = '';
    
    if (bookings.length === 0) {
        container.innerHTML = '<p class="empty-message">No bookings yet</p>';
        return;
    }
    
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const futureBookings = bookings.filter(b => {
        const [y, m, d] = b.date.split('-');
        return new Date(y, m-1, d) >= today;
    });
    
    if (futureBookings.length === 0) {
        container.innerHTML = '<p class="empty-message">No upcoming bookings</p>';
        return;
    }
    
    futureBookings.forEach(booking => {
        const card = document.createElement('div');
        card.className = 'booking-card';
        
        card.setAttribute('data-booking-id', booking.id);

        const header = document.createElement('div');
        header.className = 'booking-card-header';
        
        const [y, m, d] = booking.date.split('-');
        const dateStr = formatDate(new Date(y, m-1, d));
        
        const dateEl = document.createElement('div');
        dateEl.className = 'booking-card-date';
        dateEl.textContent = `Level ${booking.lounge_level} - ${dateStr}`;
        
        const timeEl = document.createElement('div');
        timeEl.className = 'booking-card-time';
        timeEl.textContent = booking.time_slot;
        
        header.appendChild(dateEl);
        header.appendChild(timeEl);
        card.appendChild(header);
        
        if (booking.notes) {
            const notesEl = document.createElement('div');
            notesEl.className = 'booking-card-notes';
            notesEl.textContent = booking.notes;
            card.appendChild(notesEl);
        }
        
        const actions = document.createElement('div');
        actions.className = 'booking-card-actions';
        const delBtn = document.createElement('button');
        delBtn.className = 'btn btn-danger';
        delBtn.textContent = 'Cancel';
        // Renamed function call to avoid conflict
        delBtn.addEventListener('click', () => handleDeleteBooking(booking.id));
        
        actions.appendChild(delBtn);
        card.appendChild(actions);
        container.appendChild(card);
    });
}

async function handleDeleteBooking(bookingId) {
    if (!confirm('Are you sure you want to cancel this booking?')) return;

    // 1. OPTIMISTIC UI: Dim the card instantly
    const card = document.querySelector(`[data-booking-id="${bookingId}"]`);
    if (card) {
        card.style.opacity = '0.3';
        card.style.pointerEvents = 'none'; // Stop double-clicks that cause lag
    }

    try {
        const response = await fetch(`/api/bookings/${bookingId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ telegramId: telegramUser.id })
        });
        
        if (!response.ok) throw new Error('Delete failed');
        
        showToast('Booking cancelled!', 'success');

        // 2. PARALLEL REFRESH: Refresh everything at once instead of one-by-one
        Promise.all([
            loadMyBookings(),
            selectedDate ? loadTimeSlots(selectedDate) : Promise.resolve(),
            loadUpcomingBookings(selectedLevel) // <--- ADD THIS LINE!
        ]);

    } catch (error) {
        // ROLLBACK: If it fails, bring the card back
        if (card) {
            card.style.opacity = '1';
            card.style.pointerEvents = 'auto';
        }
        showToast(error.message, 'error');
    }
}

// --- Upcoming Bookings Logic ---
async function loadUpcomingBookings(level) {
    const container = document.getElementById('upcoming-container');
    const title = document.getElementById('upcoming-title');
    
    if (!container || !title) return;

    title.innerText = `Upcoming on Level ${level}`;
    container.innerHTML = `<p class="empty-state">Loading schedule...</p>`;

    try {
        const response = await fetch(`/api/bookings/upcoming/${level}`);
        if (!response.ok) throw new Error('Failed to load upcoming bookings');
        
        const rawBookings = await response.json();

        if (rawBookings.length === 0) {
            container.innerHTML = `<p class="empty-state">No upcoming bookings. Be the first!</p>`;
            return;
        }

        // --- THE MAGIC: Group Consecutive Bookings ---
        const groupedBookings = [];
        
        // Helper to add 1 hour to a time string (e.g., "12:00" -> "13:00")
        const getEndTime = (timeStr) => {
            const hour = parseInt(timeStr.split(':')[0]);
            return `${String(hour + 1).padStart(2, '0')}:00`;
        };

        // Start the first group
        let currentGroup = { 
            ...rawBookings[0], 
            end_time: getEndTime(rawBookings[0].time_slot) 
        };

        for (let i = 1; i < rawBookings.length; i++) {
            const nextBooking = rawBookings[i];
            
            // Extract the hour numbers for comparison
            const currentEndHour = parseInt(currentGroup.end_time.split(':')[0]);
            const nextStartHour = parseInt(nextBooking.time_slot.split(':')[0]);

            // Check if they should be merged
            const isSameUser = currentGroup.telegram_username === nextBooking.telegram_username 
                            && currentGroup.first_name === nextBooking.first_name;
            const isSameDate = currentGroup.date === nextBooking.date;
            const isConsecutive = currentEndHour === nextStartHour;

            if (isSameUser && isSameDate && isConsecutive) {
                // Extend the current group's end time
                currentGroup.end_time = getEndTime(nextBooking.time_slot);
            } else {
                // Save the current group and start a new one
                groupedBookings.push(currentGroup);
                currentGroup = { 
                    ...nextBooking, 
                    end_time: getEndTime(nextBooking.time_slot) 
                };
            }
        }
        // Don't forget to push the very last group!
        groupedBookings.push(currentGroup);


        // --- DRAW THE CARDS ---
        container.innerHTML = ''; 
        groupedBookings.forEach(booking => {
            const card = document.createElement('div');
            card.className = 'upcoming-card';
            
            const [y, m, d] = booking.date.split('-');
            const dateObj = new Date(y, m - 1, d);
            const dateString = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            const displayName = booking.first_name || booking.telegram_username || 'User';

            // Now we display start_time AND end_time!
            card.innerHTML = `
                <div class="upcoming-date">${dateString}</div>
                <div class="upcoming-time">${booking.time_slot} - ${booking.end_time}</div>
                <div class="upcoming-user">👤 ${displayName}</div>
            `;
            container.appendChild(card);
        });

    } catch (error) {
        console.error("Failed to load upcoming bookings", error);
        container.innerHTML = `<p class="empty-state">Error loading schedule.</p>`;
    }
}

// Helpers
function formatDate(date) {
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateForAPI(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function showLoading(show) {
    const el = document.getElementById('loading');
    if (show) el.classList.remove('hidden'); else el.classList.add('hidden');
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

// --- Modal Logic ---
function showInfoModal(displayNameHTML, note, time, bookingId) {
    document.getElementById('infoModalTitle').textContent = `Reserved at ${time}`;
    document.getElementById('infoModalUser').innerHTML = displayNameHTML; 
    document.getElementById('infoModalNote').textContent = note;
    
    const infoModal = document.getElementById('infoModal');

    // Remove the old existing button if there is one
    const existingBtn = document.getElementById('adminDeleteBtn');
    if (existingBtn) existingBtn.remove();

    // Use our new global variable instead of a hardcoded array!
    if (isUserAdmin && bookingId) {
        const modalContent = document.querySelector('.modal-content');
        const adminBtn = document.createElement('button');
        adminBtn.id = 'adminDeleteBtn';
        adminBtn.className = 'btn btn-danger';
        adminBtn.style.marginTop = '15px';
        adminBtn.style.width = '100%';
        adminBtn.textContent = 'Admin: Cancel This Booking';
        
        adminBtn.onclick = () => {
            handleDeleteBooking(bookingId);
            infoModal.classList.add('hidden');
        };
        
        modalContent.appendChild(adminBtn);
    }

    infoModal.classList.remove('hidden');
}

// BULLETPROOF LISTENERS: Only attach if the elements exist
const closeBtn = document.getElementById('closeInfoModal');
const infoModal = document.getElementById('infoModal');

if (closeBtn && infoModal) {
    closeBtn.addEventListener('click', () => {
        infoModal.classList.add('hidden');
    });

    infoModal.addEventListener('click', (e) => {
        if(e.target.id === 'infoModal') {
            infoModal.classList.add('hidden');
        }
    });
}