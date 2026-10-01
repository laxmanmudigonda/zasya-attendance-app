document.addEventListener('DOMContentLoaded', () => {

    const loginError = document.getElementById('login-error');
    if (typeof firebase === 'undefined') {
        loginError.textContent = 'The application could not load Firebase. Check your internet connection and reload the page.';
        return;
    }

    if (!window.APP_CONFIG) {
        loginError.textContent = 'The application configuration is missing. Contact the administrator.';
        return;
    }

    const { firebase: firebaseConfig, company, sessionDurationMinutes } = window.APP_CONFIG;

    // Initialize Firebase
    let auth;
    let db;
    try {
        firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();
    } catch (error) {
        console.error('Firebase initialization failed:', error);
        loginError.textContent = 'The attendance service could not start. Please reload the page or contact the administrator.';
        return;
    }

    // --- USER LISTS & CONFIG ---
    const adminUser = company.admin;
    const validEmployees = company.employees;
    const validInterns = company.interns;
    const yearlyPaidLeaves = company.yearlyPaidLeaves;
    const nationalHolidays = company.nationalHolidays;

    // --- GETTING HTML ELEMENTS ---
    const loginContainer = document.getElementById('login-container');
    const createPasswordContainer = document.getElementById('create-password-container');
    const attendanceContainer = document.getElementById('attendance-container');
    const ceoAttendanceContainer = document.getElementById('ceo-attendance-container');
    const adminPanelContainer = document.getElementById('admin-panel-container');
    const attendanceModal = document.getElementById('attendance-modal');
    const forgotPasswordModal = document.getElementById('forgot-password-modal');
    const leaveRequestModal = document.getElementById('leave-request-modal');
    const loginForm = document.getElementById('login-form');
    const createPasswordForm = document.getElementById('create-password-form');
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const leaveRequestForm = document.getElementById('leave-request-form');
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const backToLoginButton = document.getElementById('back-to-login-btn');
    const presentButton = document.getElementById('present-btn');
    const absentButton = document.getElementById('absent-btn');
    const ceoPresentButton = document.getElementById('ceo-present-btn');
    const ceoAbsentButton = document.getElementById('ceo-absent-btn');
    const leaveRequestButton = document.getElementById('leave-request-btn');
    const logoutButton = document.getElementById('logout-btn');
    const ceoLogoutButton = document.getElementById('ceo-logout-btn');
    const adminLogoutButton = document.getElementById('admin-logout-btn');

    let currentUser = null; 
    let currentUsername = null; 
    let isCreatingAccount = false;
    let unsubscribeLeaveRequests = null;

    // --- SESSION TIMEOUT (FIXED) ---
    let sessionTimerInterval;
    let timeLeft;

    const stopSessionTimer = () => {
        clearInterval(sessionTimerInterval);
    };

    const startSessionTimer = () => {
        stopSessionTimer(); // Ensure no multiple timers are running
        timeLeft = sessionDurationMinutes * 60; // Reset time to full duration

        sessionTimerInterval = setInterval(() => {
            timeLeft--; // Decrement time every second

            // Update the display on both possible timer elements
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            document.getElementById('session-timer-user').textContent = formattedTime;
            document.getElementById('session-timer-admin').textContent = formattedTime;

            // Check if time has run out
            if (timeLeft <= 0) {
                stopSessionTimer();
                alert('Your session has expired. You will be logged out.');
                handleLogout();
            }
        }, 1000);
    };

    const resetSessionTimer = () => {
        // On user activity, just reset the countdown time to the maximum.
        // The existing interval will pick this up and continue counting down from the new value.
        timeLeft = sessionDurationMinutes * 60; 
    };

    // Add activity listeners that call the lightweight reset function
    window.addEventListener('mousemove', resetSessionTimer);
    window.addEventListener('mousedown', resetSessionTimer);
    window.addEventListener('keypress', resetSessionTimer);


    // --- HELPER FUNCTIONS ---
    const getFormattedDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    const parseLocalDate = (dateString) => {
        const [year, month, day] = dateString.split('-').map(Number);
        return new Date(year, month - 1, day);
    };
    const nameToEmail = (name) => `${name.trim().toLowerCase().replace(/\s+/g, '')}@${company.emailDomain}`;
    const isAdminUser = (user, name) => user.email === nameToEmail(adminUser.name) && name === adminUser.name;

    const showServiceError = (message) => {
        showLoginPage();
        loginError.textContent = message;
    };

    const routeAuthenticatedUser = async (user) => {
        currentUser = user;
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (!userDoc.exists) {
            throw new Error('Your account exists, but its employee profile is missing. Please contact the administrator.');
        }

        currentUsername = userDoc.data().name;
        if (isAdminUser(user, currentUsername)) {
            const today = getFormattedDate(new Date());
            const attendanceToday = userDoc.data().attendance?.[today];
            attendanceToday ? showAdminPanel() : showCeoAttendancePage();
        } else {
            showAttendancePage();
        }
    };

    // --- AUTHENTICATION & ROUTING ---
    auth.onAuthStateChanged(async user => {
        if (isCreatingAccount) return;
        if (user) {
            try {
                await routeAuthenticatedUser(user);
            } catch (error) {
                console.error('Could not load the signed-in user:', error);
                currentUser = null;
                currentUsername = null;
                await auth.signOut();
                showServiceError(error.message || 'Could not load your profile. Please try again.');
            }
        } else {
            currentUser = null;
            currentUsername = null;
            showLoginPage();
        }
    });

    // --- LOGIN, PASSWORD CREATION, FORGOT PASSWORD ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const usernameInput = document.getElementById('username').value.trim();
        const passwordInput = document.getElementById('password').value;
        loginError.textContent = '';
        if (!passwordInput) { showCreatePasswordPage(); return; }
        const email = usernameInput.includes('@') ? usernameInput : nameToEmail(usernameInput);
        try { await auth.signInWithEmailAndPassword(email, passwordInput); }
        catch (error) {
            console.error('Login failed:', error);
            loginError.textContent = error.code === 'auth/network-request-failed'
                ? 'Unable to reach the attendance service. Check your internet connection.'
                : 'Incorrect password or user does not exist.';
        }
    });

    createPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const errorEl = document.getElementById('create-password-error');
        errorEl.textContent = '';
        if (newPassword.length < 6) { errorEl.textContent = 'Password must be at least 6 characters.'; return; }
        if (newPassword !== confirmPassword) { errorEl.textContent = 'Passwords do not match.'; return; }
        isCreatingAccount = true;
        try {
            const userCredential = await auth.createUserWithEmailAndPassword(currentUsername.email, newPassword);
            await db.collection('users').doc(userCredential.user.uid).set({ name: currentUsername.name, email: currentUsername.email, role: currentUsername.role });
            isCreatingAccount = false;
            await routeAuthenticatedUser(userCredential.user);
        } catch (error) {
            isCreatingAccount = false;
            console.error('Account creation failed:', error);
            if (error.code === 'auth/email-already-in-use') {
                errorEl.textContent = 'This user already has a password. Return to login or use Forgot Password.';
            } else if (error.code === 'permission-denied') {
                errorEl.textContent = 'The account was created, but the employee profile could not be saved. Contact the administrator.';
            } else {
                errorEl.textContent = error.message || 'Could not create the account. Please try again.';
            }
        }
    });
    
    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        forgotPasswordModal.style.display = 'flex';
        document.getElementById('reset-message').textContent = '';
        forgotPasswordForm.reset();
    });

    backToLoginButton.addEventListener('click', showLoginPage);

    forgotPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('reset-email').value;
        const messageEl = document.getElementById('reset-message');
        try {
            await auth.sendPasswordResetEmail(email);
            messageEl.textContent = 'Success! Check your email for a reset link.';
            messageEl.style.color = 'green';
        } catch (error) {
            messageEl.textContent = 'Error: Could not send email. Check the address.';
            messageEl.style.color = 'red';
        }
    });
    
    // --- LEAVE REQUEST LOGIC ---
    leaveRequestButton.addEventListener('click', () => {
        leaveRequestModal.style.display = 'flex';
        leaveRequestForm.reset();
        document.getElementById('leave-request-message').textContent = '';
        document.getElementById('leave-date').min = getFormattedDate(new Date());
    });

    leaveRequestForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const leaveDate = document.getElementById('leave-date').value;
        const leaveReason = document.getElementById('leave-reason').value;
        const messageEl = document.getElementById('leave-request-message');
        if (!leaveDate) { messageEl.textContent = 'Please select a date.'; messageEl.style.color = 'red'; return; }
        try {
            await db.collection('leave-requests').add({
                userId: currentUser.uid,
                userName: currentUsername,
                date: leaveDate,
                reason: leaveReason || 'Not specified',
                status: 'pending'
            });
            messageEl.textContent = 'Leave request submitted successfully!';
            messageEl.style.color = 'green';
            setTimeout(() => { leaveRequestModal.style.display = 'none'; }, 2000);
        } catch (error) {
            messageEl.textContent = 'Failed to submit request.';
            messageEl.style.color = 'red';
        }
    });

    // --- ATTENDANCE & MODAL/LOGOUT ---
    const handleLogout = () => {
        stopSessionTimer();
        auth.signOut();
    };
    logoutButton.addEventListener('click', handleLogout);
    adminLogoutButton.addEventListener('click', handleLogout);
    ceoLogoutButton.addEventListener('click', handleLogout);

    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal-overlay').style.display = 'none';
        });
    });
    window.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal-overlay')) {
            event.target.style.display = 'none';
        }
    });

    const markAttendance = async (status, elementId) => {
        if (!currentUser) return;
        const today = new Date();
        const formattedDate = getFormattedDate(today);
        const formattedTime = today.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

        const attendanceData = {
            status: status,
            time: formattedTime
        };

        const userRef = db.collection('users').doc(currentUser.uid);
        try {
            await userRef.update({ [`attendance.${formattedDate}`]: attendanceData });
            const statusMessage = document.getElementById(elementId);
            statusMessage.textContent = status === "Present" 
                ? `✅ Attendance Marked: PRESENT at ${formattedTime}.` 
                : `❌ Marked as ABSENT/LEAVE at ${formattedTime}.`;
            statusMessage.style.color = status === "Present" ? 'green' : 'red';
            
            // If CEO marks attendance, proceed to admin panel
            if (isAdminUser(currentUser, currentUsername)) {
                setTimeout(showAdminPanel, 1500);
            }

        } catch (error) {
            console.error('Error writing attendance:', error);
            const statusMessage = document.getElementById(elementId);
            statusMessage.textContent = 'Attendance could not be saved. Check your connection and try again.';
            statusMessage.style.color = 'red';
        }
    };

    presentButton.addEventListener('click', () => markAttendance("Present", 'status-message'));
    absentButton.addEventListener('click', () => markAttendance("Absent", 'status-message'));
    ceoPresentButton.addEventListener('click', () => markAttendance("Present", 'ceo-status-message'));
    ceoAbsentButton.addEventListener('click', () => markAttendance("Absent", 'ceo-status-message'));
    
    // --- PAGE DISPLAY & ADMIN FUNCTIONS ---
    function showLoginPage() {
        [attendanceContainer, createPasswordContainer, adminPanelContainer, ceoAttendanceContainer, attendanceModal, forgotPasswordModal, leaveRequestModal].forEach(c => c.style.display = 'none');
        loginContainer.style.display = 'block';
        loginForm.reset();
        if (unsubscribeLeaveRequests) {
            unsubscribeLeaveRequests();
            unsubscribeLeaveRequests = null;
        }
        stopSessionTimer(); // Make sure timer is stopped on logout
    }
    
    function showCreatePasswordPage() {
        const usernameInput = document.getElementById('username').value.trim();
        const allUsers = [{name: adminUser.name, role: adminUser.role}, ...validEmployees.map(n => ({name: n, role: 'Employee'})), ...validInterns.map(n => ({name: n, role: 'Intern'}))];
        const normalizedInput = usernameInput.toLowerCase().replace(/\s+/g, '');
        const validUser = allUsers.find(u => u.name.toLowerCase().replace(/\s+/g, '') === normalizedInput);
        if (!validUser) { document.getElementById('login-error').textContent = 'This user is not in the company list.'; return; }
        const userEmail = nameToEmail(validUser.name);
        currentUsername = {name: validUser.name, email: userEmail, role: validUser.role};
        [loginContainer, attendanceContainer, adminPanelContainer, ceoAttendanceContainer].forEach(c => c.style.display = 'none');
        createPasswordContainer.style.display = 'block';
        document.getElementById('new-user-name').textContent = currentUsername.name;
        document.getElementById('user-email-display').textContent = currentUsername.email;
        createPasswordForm.reset();
    }

    function showAttendancePage() {
        [loginContainer, createPasswordContainer, adminPanelContainer, ceoAttendanceContainer].forEach(c => c.style.display = 'none');
        attendanceContainer.style.display = 'block';
        document.getElementById('display-username').textContent = currentUsername;
        document.getElementById('status-message').textContent = '';
        const today = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('current-date').textContent = today.toLocaleDateString('en-US', options);
        startSessionTimer(); // Start the timer when the user page is shown
    }

    function showCeoAttendancePage() {
        [loginContainer, createPasswordContainer, adminPanelContainer, attendanceContainer].forEach(c => c.style.display = 'none');
        ceoAttendanceContainer.style.display = 'block';
        document.getElementById('ceo-status-message').textContent = '';
        const today = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('ceo-current-date').textContent = today.toLocaleDateString('en-US', options);
    }
    
    function showAdminPanel() {
        [loginContainer, createPasswordContainer, attendanceContainer, ceoAttendanceContainer].forEach(c => c.style.display = 'none');
        adminPanelContainer.style.display = 'block';
        generateDashboard();
        loadLeaveRequests();
        startSessionTimer(); // Start the timer when the admin page is shown
    }

    async function loadLeaveRequests() {
        const requestsBody = document.getElementById('leave-requests-body');
        if (unsubscribeLeaveRequests) unsubscribeLeaveRequests();
        unsubscribeLeaveRequests = db.collection('leave-requests').where('status', '==', 'pending').onSnapshot(snapshot => {
            if (snapshot.empty) {
                requestsBody.innerHTML = '<tr><td colspan="4">No pending leave requests.</td></tr>';
                return;
            }
            requestsBody.innerHTML = '';
            snapshot.forEach(doc => {
                const request = doc.data();
                const row = document.createElement('tr');
                [request.date, request.userName, request.reason].forEach(value => {
                    const cell = document.createElement('td');
                    cell.textContent = value || '';
                    row.appendChild(cell);
                });
                const actions = document.createElement('td');
                const approveButton = document.createElement('button');
                approveButton.className = 'action-btn approve-btn';
                approveButton.dataset.id = doc.id;
                approveButton.dataset.userId = request.userId;
                approveButton.dataset.date = request.date;
                approveButton.textContent = 'Approve';
                const denyButton = document.createElement('button');
                denyButton.className = 'action-btn deny-btn';
                denyButton.dataset.id = doc.id;
                denyButton.textContent = 'Deny';
                actions.append(approveButton, denyButton);
                row.appendChild(actions);
                requestsBody.appendChild(row);
            });
        }, error => {
            console.error('Could not load leave requests:', error);
            requestsBody.innerHTML = '<tr><td colspan="4">Could not load leave requests.</td></tr>';
        });
    }

    document.getElementById('leave-requests-table').addEventListener('click', async (e) => {
        const target = e.target;
        const requestId = target.dataset.id;
        if (!requestId) return;
        const leaveRequestRef = db.collection('leave-requests').doc(requestId);
        target.disabled = true;
        try {
            if (target.classList.contains('approve-btn')) {
                const userId = target.dataset.userId;
                const leaveDate = target.dataset.date;
                const batch = db.batch();
                batch.update(db.collection('users').doc(userId), { [`attendance.${leaveDate}`]: { status: 'Absent', time: 'Approved' } });
                batch.update(leaveRequestRef, { status: 'approved' });
                await batch.commit();
                generateDashboard();
            } else if (target.classList.contains('deny-btn')) {
                await leaveRequestRef.update({ status: 'denied' });
            }
        } catch (error) {
            console.error('Could not process leave request:', error);
            target.disabled = false;
            alert('The leave request could not be updated. Please try again.');
        }
    });

    async function generateDashboard() {
        const dashboardBody = document.getElementById('dashboard-body');
        dashboardBody.innerHTML = '<tr><td colspan="8">Loading dashboard...</td></tr>';
        const allUsers = [{ name: adminUser.name, role: adminUser.role }, ...validEmployees.map(n => ({ name: n, role: 'Employee' })), ...validInterns.map(n => ({ name: n, role: 'Intern' }))];
        try {
            const usersWithStats = await Promise.all(allUsers.map(async user => ({
                ...user,
                stats: await calculateAttendanceStats(user.name)
            })));
            const todayFormatted = getFormattedDate(new Date());
            let onLeaveTodayCount = 0;

            const tableHTML = usersWithStats.map(user => {
                const { stats } = user;
                if (stats.attendance[todayFormatted]?.status === 'Absent') onLeaveTodayCount++;
                const todaysRecord = stats.attendance[todayFormatted];
                const punchInTime = todaysRecord?.status === 'Present' ? todaysRecord.time : '---';
                const rowClass = user.role === 'CEO' ? ' class="ceo-row"' : '';
                const missedDaysCell = stats.daysMissed > 0 ? `<td class="missed-days-cell">${stats.daysMissed}</td>` : `<td>${stats.daysMissed}</td>`;
                return `<tr data-username="${user.name}"${rowClass}>
                            <td>${user.name}</td>
                            <td>${user.role}</td>
                            <td>${stats.workingDaysThisMonth}</td>
                            <td>${stats.daysAttended}</td>
                            <td>${punchInTime}</td>
                            ${missedDaysCell}
                            <td>${stats.leavesTakenThisYear}</td>
                            <td>${stats.leavesRemaining}</td>
                        </tr>`;
            }).join('');

            dashboardBody.innerHTML = tableHTML;
            document.getElementById('daily-leave-count').textContent = onLeaveTodayCount;
            dashboardBody.querySelectorAll('tr').forEach(row => {
                row.addEventListener('click', async () => {
                    const username = row.dataset.username;
                    if (!username) return;
                    const stats = await calculateAttendanceStats(username);
                    showAttendanceModal(username, stats.attendance);
                });
            });
        } catch (error) {
            console.error('Could not generate dashboard:', error);
            dashboardBody.innerHTML = '<tr><td colspan="8">Could not load the dashboard. Check Firestore access and try again.</td></tr>';
        }
    }

    async function calculateAttendanceStats(username) {
        const userEmail = nameToEmail(username);
        const userQuery = await db.collection('users').where("email", "==", userEmail).get();
        let attendance = {};
        if(!userQuery.empty) { attendance = userQuery.docs[0].data().attendance || {}; }
        
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();
        let workingDaysThisMonth = 0, daysAttended = 0, leavesTakenThisYear = 0, daysMissed = 0;

        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        for (let day = 1; day <= today.getDate(); day++) {
            const date = new Date(currentYear, currentMonth, day);
            const dayOfWeek = date.getDay();
            const formattedDateMMDD = `${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            
            if (dayOfWeek !== 0 && !nationalHolidays.includes(formattedDateMMDD)) {
                workingDaysThisMonth++;
                const formattedDateYYYYMMDD = getFormattedDate(date);
                if (attendance[formattedDateYYYYMMDD]?.status === 'Present') {
                    daysAttended++;
                } else if (!attendance[formattedDateYYYYMMDD]) {
                    daysMissed++;
                }
            }
        }

        Object.keys(attendance).forEach(dateStr => {
            const recordDate = parseLocalDate(dateStr);
            if (recordDate.getFullYear() === currentYear && attendance[dateStr]?.status === 'Absent') {
                const dayOfWeek = recordDate.getDay();
                const formattedDateMMDD = dateStr.substring(5);
                if(dayOfWeek !== 0 && !nationalHolidays.includes(formattedDateMMDD)){
                    leavesTakenThisYear++;
                }
            }
        });

        const leavesRemaining = Math.max(0, yearlyPaidLeaves - leavesTakenThisYear);
        return { workingDaysThisMonth, daysAttended, daysMissed, leavesTakenThisYear, leavesRemaining, attendance };
    }

    function showAttendanceModal(username, attendance) {
        const today = new Date();
        const month = today.getMonth();
        const year = today.getFullYear();
        document.getElementById('modal-title').textContent = `${username} - ${today.toLocaleString('default', { month: 'long', year: 'numeric' })}`;
        const calendarGrid = document.getElementById('modal-calendar');
        calendarGrid.innerHTML = '';
        ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day day-name';
            dayEl.textContent = day;
            calendarGrid.appendChild(dayEl);
        });

        const firstDayOfMonth = new Date(year, month, 1).getDay();
        for (let i = 0; i < firstDayOfMonth; i++) { calendarGrid.appendChild(document.createElement('div')); }
        
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const formattedDate = getFormattedDate(date);
            const dayOfWeek = date.getDay();
            const formattedDateMMDD = `${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day';
            dayEl.textContent = day;
            
            const attendanceRecord = attendance[formattedDate];
            if (date > today) {
                dayEl.classList.add('future');
            } else if (attendanceRecord?.status === 'Present') {
                dayEl.classList.add('present');
                dayEl.title = `Marked at: ${attendanceRecord.time}`;
            } else if (attendanceRecord?.status === 'Absent') {
                dayEl.classList.add('absent');
                if (attendanceRecord.time !== 'Approved') {
                    dayEl.title = `Marked at: ${attendanceRecord.time}`;
                } else {
                    dayEl.title = `Leave Approved`;
                }
            } else if (dayOfWeek === 0 || nationalHolidays.includes(formattedDateMMDD)) {
                dayEl.classList.add('holiday');
            } else { 
                dayEl.classList.add('unmarked');
            }
            calendarGrid.appendChild(dayEl);
        }
        attendanceModal.style.display = 'flex';
    }
});
