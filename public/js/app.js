// Telegram Web App initialization
let tg = window.Telegram?.WebApp;
let telegramUser = null;

// State
let currentDate = new Date();
let selectedDate = null;
let selectedTimeSlots = []; 
let selectedLevel = 9; // Default floor

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize Telegram Web App
    if (tg) {
        tg.ready();
        tg.expand();
        
        // Get Telegram user info
        telegramUser = tg.initDataUnsafe?.user;
        
        if (telegramUser) {
            displayUserInfo();
        }
    } else {
        // Fallback for testing without Telegram
        telegramUser = {
            id: 'test_user',
            first_name: 'Gabriel',
            last_name: 'Wan',
            username: 'gabrielwan'
        };
        displayUserInfo();
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
        });
    });

    // Initialize calendar
    renderCalendar();
    
    // Load user's bookings
    await loadMyBookings();
    
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
            dayElement.addEventListener('click', () => selectDate(dateObj));
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
        displayTimeSlots(data.available, data.booked);
        
        document.getElementById('timeSlotsSection').classList.remove('hidden'); 
    } catch (error) {
        console.error('Error:', error);
        showToast('Failed to load slots', 'error');
    } finally {
        showLoading(false);
    }
}

function displayTimeSlots(available, booked) {
    const timeSlotsSection = document.getElementById('timeSlotsSection');
    const timeSlotsContainer = document.getElementById('timeSlots');
    
    timeSlotsContainer.innerHTML = '';
    const allSlots = [...available, ...booked].sort();
    
    if (allSlots.length === 0) {
        timeSlotsContainer.innerHTML = '<p class="empty-message">No time slots available</p>';
        return;
    }
    
    const now = new Date();
    const isToday = selectedDate && 
                    selectedDate.getDate() === now.getDate() &&
                    selectedDate.getMonth() === now.getMonth() &&
                    selectedDate.getFullYear() === now.getFullYear();
    const currentHour = now.getHours();

    allSlots.forEach(slot => {
        const slotElement = document.createElement('div');
        slotElement.className = 'time-slot';
        slotElement.textContent = slot;
        const slotHour = parseInt(slot.split(':')[0], 10);
        
        if (booked.includes(slot)) {
            slotElement.classList.add('booked');
        } else if (isToday && slotHour <= currentHour) {
            slotElement.classList.add('disabled'); 
        } else {
            slotElement.addEventListener('click', function() {
                selectTimeSlot(slot, this); 
            });
        }
        timeSlotsContainer.appendChild(slotElement);
    });
    
    timeSlotsSection.classList.remove('hidden');
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
    
    if (confirmLevel) {
        confirmLevel.textContent = selectedLevel;
    }
    
    bookingDate.textContent = formatDate(selectedDate);
    bookingTime.textContent = selectedTimeSlots.join(', '); 
    
    bookingForm.classList.remove('hidden');
    bookingForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideBookingForm() {
    const bookingForm = document.getElementById('bookingForm');
    const bookingNotes = document.getElementById('bookingNotes');
    
    bookingForm.classList.add('hidden');
    bookingNotes.value = '';
    selectedTimeSlots = [];
    
    document.querySelectorAll('.time-slot.selected-slot').forEach(slot => {
        slot.classList.remove('selected-slot');
    });
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
        const response = await fetch(`/api/bookings/user/${telegramUser.id}`);
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
            selectedDate ? loadTimeSlots(selectedDate) : Promise.resolve()
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

// Helpers
function formatDate(date) {
    return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateForAPI(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
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