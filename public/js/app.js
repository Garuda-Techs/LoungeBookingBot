// Telegram Web App initialization
let tg = window.Telegram?.WebApp;
let telegramUser = null;

// State
let currentDate = new Date();
let selectedDate = null;
let selectedTimeSlot = null;

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
            first_name: 'Test',
            last_name: 'User',
            username: 'testuser'
        };
        displayUserInfo();
    }
    
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
    
    // Clear previous calendar
    calendar.innerHTML = '';
    
    // Set month/year header
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    monthYear.textContent = `${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    
    // Add day headers
    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayHeaders.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'calendar-day header';
        dayHeader.textContent = day;
        calendar.appendChild(dayHeader);
    });
    
    // Get first day of month and number of days
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const numDays = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    // Get today's date for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day other-month';
        calendar.appendChild(emptyDay);
    }
    
    // Add days of the month
    for (let day = 1; day <= numDays; day++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = day;
        
        const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        dateObj.setHours(0, 0, 0, 0);
        
        // Disable past dates
        if (dateObj < today) {
            dayElement.classList.add('disabled');
        } else {
            dayElement.addEventListener('click', () => selectDate(dateObj));
        }
        
        // Highlight selected date
        if (selectedDate && 
            dateObj.getDate() === selectedDate.getDate() &&
            dateObj.getMonth() === selectedDate.getMonth() &&
            dateObj.getFullYear() === selectedDate.getFullYear()) {
            dayElement.classList.add('selected');
        }
        
        calendar.appendChild(dayElement);
    }
}

// Select a date
async function selectDate(date) {
    selectedDate = date;
    selectedTimeSlot = null;
    
    renderCalendar();
    
    // Show selected date
    const selectedDateInfo = document.getElementById('selectedDateInfo');
    const selectedDateSpan = document.getElementById('selectedDate');
    selectedDateSpan.textContent = formatDate(date);
    selectedDateInfo.classList.remove('hidden');
    
    // Load available time slots
    await loadTimeSlots(date);
    
    // Hide booking form if showing
    hideBookingForm();
}

// Load time slots for a date
async function loadTimeSlots(date) {
    showLoading(true);
    
    try {
        const dateStr = formatDateForAPI(date);
        const response = await fetch(`/api/bookings/available/${dateStr}`);
        
        if (!response.ok) {
            throw new Error('Failed to load time slots');
        }
        
        const data = await response.json();
        displayTimeSlots(data.available, data.booked);
    } catch (error) {
        console.error('Error loading time slots:', error);
        showToast('Failed to load time slots', 'error');
    } finally {
        showLoading(false);
    }
}

// Display time slots
function displayTimeSlots(available, booked) {
    const timeSlotsSection = document.getElementById('timeSlotsSection');
    const timeSlotsContainer = document.getElementById('timeSlots');
    
    timeSlotsContainer.innerHTML = '';
    
    // Combine available and booked slots
    const allSlots = [...available, ...booked].sort();
    
    if (allSlots.length === 0) {
        timeSlotsContainer.innerHTML = '<p class="empty-message">No time slots available</p>';
    } else {
        allSlots.forEach(slot => {
            const slotElement = document.createElement('div');
            slotElement.className = 'time-slot';
            slotElement.textContent = slot;
            
            if (booked.includes(slot)) {
                slotElement.classList.add('booked');
                slotElement.title = 'Already booked';
            } else {
                slotElement.addEventListener('click', () => selectTimeSlot(slot));
            }
            
            timeSlotsContainer.appendChild(slotElement);
        });
    }
    
    timeSlotsSection.classList.remove('hidden');
}

// Select a time slot
function selectTimeSlot(timeSlot) {
    selectedTimeSlot = timeSlot;
    showBookingForm();
}

// Show booking form
function showBookingForm() {
    const bookingForm = document.getElementById('bookingForm');
    const bookingDate = document.getElementById('bookingDate');
    const bookingTime = document.getElementById('bookingTime');
    
    bookingDate.textContent = formatDate(selectedDate);
    bookingTime.textContent = selectedTimeSlot;
    
    bookingForm.classList.remove('hidden');
    bookingForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Hide booking form
function hideBookingForm() {
    const bookingForm = document.getElementById('bookingForm');
    const bookingNotes = document.getElementById('bookingNotes');
    
    bookingForm.classList.add('hidden');
    bookingNotes.value = '';
}

// Confirm booking
async function confirmBooking() {
    if (!selectedDate || !selectedTimeSlot) {
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
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                telegramUser: telegramUser,
                date: formatDateForAPI(selectedDate),
                timeSlot: selectedTimeSlot,
                notes: notes
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create booking');
        }
        
        showToast('Booking confirmed successfully!', 'success');
        hideBookingForm();
        
        // Reload time slots and bookings
        await loadTimeSlots(selectedDate);
        await loadMyBookings();
        
        // Notify Telegram
        if (tg) {
            tg.showPopup({
                title: 'Booking Confirmed',
                message: `Your booking for ${formatDate(selectedDate)} at ${selectedTimeSlot} has been confirmed.`,
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

// Display user's bookings
function displayMyBookings(bookings) {
    const myBookingsContainer = document.getElementById('myBookings');
    
    myBookingsContainer.innerHTML = '';
    
    if (bookings.length === 0) {
        myBookingsContainer.innerHTML = '<p class="empty-message">No bookings yet</p>';
        return;
    }
    
    // Filter future bookings and sort
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const futureBookings = bookings.filter(booking => {
        // Manually split the date to ensure it works on iPhones/Safari
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
        
        // Ensure display formatting also uses the iOS safe date
        const [year, month, day] = booking.date.split('-');
        const displayDate = new Date(year, month - 1, day);
        
        const date = document.createElement('div');
        date.className = 'booking-card-date';
        date.textContent = formatDate(displayDate);
        
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

// Display time slots
function displayTimeSlots(available, booked) {
    const timeSlotsSection = document.getElementById('timeSlotsSection');
    const timeSlotsContainer = document.getElementById('timeSlots');
    
    timeSlotsContainer.innerHTML = '';
    
    // Combine available and booked slots from the backend
    const allSlots = [...available, ...booked].sort();
    
    if (allSlots.length === 0) {
        timeSlotsContainer.innerHTML = '<p class="empty-message">No time slots available</p>';
        return;
    }
    
    // Check if the selected date is today
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
        
        // Extract the hour as a number (e.g., "09:00" becomes 9)
        const slotHour = parseInt(slot.split(':')[0], 10);
        
        if (booked.includes(slot)) {
            // Rule 1: It's already booked
            slotElement.classList.add('booked');
            slotElement.title = 'Already booked';
        } else if (isToday && slotHour <= currentHour) {
            // Rule 2: It's today, and the time has already passed
            // (Uses the same 'disabled' class you use for past calendar days)
            slotElement.classList.add('disabled'); 
            slotElement.title = 'Time has passed';
        } else {
            // Rule 3: It's available!
            slotElement.addEventListener('click', () => selectTimeSlot(slot));
        }
        
        timeSlotsContainer.appendChild(slotElement);
    });
    
    timeSlotsSection.classList.remove('hidden');
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
        
        // Reload bookings and time slots if date is selected
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

// Helper functions
function formatDate(date) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

function formatDateForAPI(date) {
    const year = date.getFullYear();
    // getMonth() is 0-indexed, so add 1. padStart ensures it's always 2 digits.
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

function showLoading(show) {
    const loading = document.getElementById('loading');
    if (show) {
        loading.classList.remove('hidden');
    } else {
        loading.classList.add('hidden');
    }
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}
