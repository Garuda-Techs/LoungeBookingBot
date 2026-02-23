// Telegram Web App initialization
let tg = window.Telegram?.WebApp;
let telegramUser = null;

// State
let currentDate = new Date();
let selectedDate = null;
let selectedTimeSlots = []; 
let selectedLevel = 9; // NEW: Track which floor is selected (9, 10, or 11)

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
    
    // --- 1. Corrected Level Switcher (Inside DOMContentLoaded) ---
    document.querySelectorAll('.level-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            // Update UI
            document.querySelectorAll('.level-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Update State
            selectedLevel = parseInt(this.dataset.level);
            
            // CRITICAL: Reset selections so old floor timings don't "ghost" back
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
    
    // Event listeners
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

// Render calendar
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
        
        if (selectedDate && 
            dateObj.getDate() === selectedDate.getDate() &&
            dateObj.getMonth() === selectedDate.getMonth() &&
            dateObj.getFullYear() === selectedDate.getFullYear()) {
            dayElement.classList.add('selected');
        }
        
        calendar.appendChild(dayElement);
    }
}

// 1. Updated selectDate
async function selectDate(date) {
    selectedDate = date;
    selectedTimeSlots = []; 
    
    renderCalendar();
    
    // Reveal the Date Info bar
    document.getElementById('selectedDateInfo').classList.remove('hidden');
    document.getElementById('selectedDate').textContent = formatDate(date);
    
    // Clear old buttons
    document.getElementById('timeSlots').innerHTML = ''; 
    
    // IMPORTANT: Call hideBookingForm to reset the bottom confirmation form...
    hideBookingForm(); 
    
    // ...BUT immediately reveal the timeSlotsSection again so the buttons can show!
    document.getElementById('timeSlotsSection').classList.remove('hidden'); 
    
    await loadTimeSlots(date);
}

// 2. Update loadTimeSlots to ensure visibility after data arrives
async function loadTimeSlots(date) {
    showLoading(true);
    try {
        const dateStr = formatDateForAPI(date);
        const response = await fetch(`/api/bookings/available/${dateStr}?level=${selectedLevel}`);
        
        if (!response.ok) throw new Error('Failed to load');
        
        const data = await response.json();
        displayTimeSlots(data.available, data.booked);
        
        // Final safety check to show the section
        document.getElementById('timeSlotsSection').classList.remove('hidden'); 
    } catch (error) {
        console.error('Error:', error);
        showToast('Failed to load slots', 'error');
    } finally {
        showLoading(false);
    }
}

// 2. Updated displayTimeSlots
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
    
    // FINAL SAFETY: Ensure the section is visible after buttons are built
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
    
    bookingDate.textContent = formatDate(selectedDate);
    bookingTime.textContent = selectedTimeSlots.join(', '); 
    
    bookingForm.classList.remove('hidden');
    bookingForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideBookingForm() {
    const bookingForm = document.getElementById('bookingForm');
    const bookingNotes = document.getElementById('bookingNotes');
    const bookingTime = document.getElementById('bookingTime');
    
    // 1. Hide the confirmation section
    bookingForm.classList.add('hidden');
    
    // 2. Clear the input and the stuck text labels
    bookingNotes.value = '';
    bookingTime.textContent = ''; // This clears the "02:00, 03:00" text
    
    // 3. Wipe the underlying state array
    selectedTimeSlots = [];
    
    // 4. Remove the yellow highlights from the time slot buttons
    const highlightedSlots = document.querySelectorAll('.time-slot.selected-slot');
    highlightedSlots.forEach(slot => {
        slot.classList.remove('selected-slot');
    });

    // 5. Hide the supporting sections to force a fresh start
    document.getElementById('selectedDateInfo').classList.add('hidden');
    document.getElementById('timeSlotsSection').classList.add('hidden');
    
    // 6. Deselect the calendar date
    const selectedCalendarDay = document.querySelector('.calendar-day.selected');
    if (selectedCalendarDay) {
        selectedCalendarDay.classList.remove('selected');
    }
}

// Confirm booking with Level support
async function confirmBooking() {
    if (!selectedDate || selectedTimeSlots.length === 0) {
        showToast('Please select a date and at least one time slot', 'error');
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
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                telegramUser: telegramUser,
                lounge_level: selectedLevel, // UPDATED: Send floor level
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
                message: `Your booking for Level ${selectedLevel} on ${formatDate(selectedDate)} has been confirmed.`,
                buttons: [{type: 'ok'}]
            });
        }
    } catch (error) {
        console.error('Error creating booking:', error);
        showToast(error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Load user's bookings
async function loadMyBookings() {
    if (!telegramUser) return;
    
    try {
        const response = await fetch(`/api/bookings/user/${telegramUser.id}`);
        
        if (!response.ok) {
            throw new Error('Failed to load bookings');
        }
        
        const bookings = await response.json();
        displayMyBookings(bookings);
    } catch (error) {
        console.error('Error loading bookings:', error);
    }
}

function displayMyBookings(bookings) {
    const myBookingsContainer = document.getElementById('myBookings');
    myBookingsContainer.innerHTML = '';
    
    if (bookings.length === 0) {
        myBookingsContainer.innerHTML = '<p class="empty-message">No bookings yet</p>';
        return;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const futureBookings = bookings.filter(booking => {
        const [year, month, day] = booking.date.split('-');
        const bookingDate = new Date(year, month - 1, day);
        return bookingDate >= today;
    });
    
    if (futureBookings.length === 0) {
        myBookingsContainer.innerHTML = '<p class="empty-message">No upcoming bookings</p>';
        return;
    }
    
    futureBookings.forEach(booking => {
        const card = document.createElement('div');
        card.className = 'booking-card';
        
        const header = document.createElement('div');
        header.className = 'booking-card-header';
        
        const [year, month, day] = booking.date.split('-');
        const displayDate = new Date(year, month - 1, day);
        
        const date = document.createElement('div');
        date.className = 'booking-card-date';
        // UPDATED: Show Level in the booking card
        date.textContent = `Level ${booking.lounge_level} - ${formatDate(displayDate)}`;
        
        const time = document.createElement('div');
        time.className = 'booking-card-time';
        time.textContent = booking.time_slot;
        
        header.appendChild(date);
        header.appendChild(time);
        card.appendChild(header);
        
        if (booking.notes) {
            const notes = document.createElement('div');
            notes.className = 'booking-card-notes';
            notes.textContent = booking.notes;
            card.appendChild(notes);
        }
        
        const actions = document.createElement('div');
        actions.className = 'booking-card-actions';
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-danger';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', () => cancelBooking(booking.id));
        
        actions.appendChild(cancelBtn);
        card.appendChild(actions);
        myBookingsContainer.appendChild(card);
    });
}

// Cancel booking
async function cancelBooking(bookingId) {
    if (!telegramUser) {
        showToast('User information not available', 'error');
        return;
    }
    
    if (!confirm('Are you sure you want to cancel this booking?')) {
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await fetch(`/api/bookings/${bookingId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                telegramId: telegramUser.id
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to cancel booking');
        }
        
        showToast('Booking cancelled successfully', 'success');
        
        await loadMyBookings();
        if (selectedDate) {
            await loadTimeSlots(selectedDate);
        }
    } catch (error) {
        console.error('Error cancelling booking:', error);
        showToast(error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Helpers
function formatDate(date) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

function formatDateForAPI(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function showLoading(show) {
    const loading = document.getElementById('loading');
    if (show) loading.classList.remove('hidden');
    else loading.classList.add('hidden');
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}