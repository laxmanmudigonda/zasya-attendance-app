document.addEventListener('DOMContentLoaded', () => {

    // --- PASTE YOUR FIREBASE CONFIGURATION OBJECT HERE ---
    const firebaseConfig = {
      apiKey: "PASTE_YOUR_API_KEY_HERE",
      authDomain: "PASTE_YOUR_AUTH_DOMAIN_HERE",
      projectId: "PASTE_YOUR_PROJECT_ID_HERE",
      storageBucket: "PASTE_YOUR_STORAGE_BUCKET_HERE",
      messagingSenderId: "PASTE_YOUR_SENDER_ID_HERE",
      appId: "PASTE_YOUR_APP_ID_HERE"
    };

    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();

    const adminUser = { name: "Varaprasad Mudigonda", role: "CEO" };
    const validEmployees = ["Divyansh Kushwah", "Manish Nimkhede", "Nikhil Khiyani", "Nikhil Patil", "Sawari Maheswari", "Suhas Ambeti", "Laxman Mudigonda"];
    const validInterns = ["Yashweer Potelu", "Akshith Varma", "Hari krishna", "Keerthan Modem", "Mithil Pollipalli", "Aryan Mansuke", "Vaishak Kundhavan", "Anuj Arya"];
    const yearlyPaidLeaves = 8;
    const nationalHolidays = ["01-01", "01-26", "08-15", "10-02"];
    const SESSION_DURATION = 10 * 60 * 1000;

    const allUI = document.querySelectorAll('.container, .modal-overlay');
    const loginContainer = document.getElementById('login-container');
    const createPasswordContainer = document.getElementById('create-password-container');
    const attendanceContainer = document.getElementById('attendance-container');
    const adminPanelContainer = document.getElementById('admin-panel-container');
    const adminAttendanceModal = document.getElementById('admin-attendance-modal');
    const attendanceModal = document.getElementById('attendance-modal');
    const forgotPasswordModal = document.getElementById('forgot-password-modal');
    const leaveRequestModal = document.getElementById('leave-request-modal');
    const loginForm = document.getElementById('login-form');
    const createPasswordForm = document.getElementById('create-password-form');
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const leaveRequestForm = document.getElementById('leave-request-form');
    const timerDisplayUser = document.getElementById('session-timer-display-user');
    const timerDisplayAdmin = document.getElementById('session-timer-display-admin');

    let currentUser = null; 
    let currentUserName = null;
    let sessionIntervalId = null;

    const getFormattedDate = (date) => date.toISOString().slice(0, 10);
    const nameToEmail = (name) => `${name.toLowerCase().replace(/\s+/g, '')}@zasya.online`;

    function startSessionTimer() {
        clearInterval(sessionIntervalId);
        const endTime = Date.now() + SESSION_DURATION;
        sessionIntervalId = setInterval(() => {
            const remaining = endTime - Date.now();
            if (remaining <= 0) {
                clearInterval(sessionIntervalId);
                auth.signOut();
                return;
            }
            const minutes = Math.floor((remaining / 1000) / 60);
            const seconds = Math.floor((remaining / 1000) % 60);
            const timerText = `Time Left: ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            timerDisplayUser.textContent = timerText;
            timerDisplayAdmin.textContent = timerText;
        }, 1000);
    }
    const resetSessionTimer = () => { if (currentUser) startSessionTimer(); };
    ['click', 'keypress', 'scroll', 'mousemove'].forEach(event => document.addEventListener(event, resetSessionTimer));

    function showLoginPage() {
        allUI.forEach(el => el.style.display = 'none');
        loginContainer.style.display = 'block';
        loginForm.reset();
    }
    
    function showAttendancePage(name) {
        allUI.forEach(el => el.style.display = 'none');
        attendanceContainer.style.display = 'block';
        document.getElementById('display-username').textContent = name;
        document.getElementById('status-message').textContent = '';
        const today = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('current-date').textContent = today.toLocaleDateString('en-US', options);
    }

    function showAdminPanel() {
        allUI.forEach(el => el.style.display = 'none');
        adminPanelContainer.style.display = 'block';
        generateDashboard();
        loadLeaveRequests();
        generateQuickStats();
    }

    function showAdminAttendancePrompt() {
        allUI.forEach(el => el.style.display = 'none');
        adminAttendanceModal.style.display = 'flex';
    }
    
    auth.onAuthStateChanged(async user => {
        if (user) {
            currentUser = user;
            startSessionTimer();
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                currentUserName = userData.name;
                if (userData.name === adminUser.name) {
                    const today = getFormattedDate(new Date());
                    if (!userData.attendance || !userData.attendance[today]) {
                        showAdminAttendancePrompt();
                    } else {
                        showAdminPanel();
                    }
                } else {
                    showAttendancePage(userData.name);
                }
            } else { auth.signOut(); }
        } else {
            showLoginPage();
            clearInterval(sessionIntervalId);
        }
    });
    
    document.getElementById('admin-present-btn').addEventListener('click', async () => {
        await markAttendance("Present");
        adminAttendanceModal.style.display = 'none';
        showAdminPanel();
    });
    document.getElementById('admin-absent-btn').addEventListener('click', async () => {
        await markAttendance("Absent");
        adminAttendanceModal.style.display = 'none';
        showAdminPanel();
    });
    
    async function markAttendance(status) {
        if (!currentUser) return;
        const today = new Date();
        const formattedDate = getFormattedDate(today);
        const attendanceRecord = { 
            status: status,
            time: today.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) 
        };
        const userRef = db.collection('users').doc(currentUser.uid);
        try {
            await userRef.set({ attendance: { [formattedDate]: attendanceRecord } }, { merge: true });
            const statusMessage = document.getElementById('status-message');
            if (statusMessage) {
                statusMessage.textContent = status === "Present" ? `✅ Attendance Marked: PRESENT.` : `❌ Marked as ABSENT/LEAVE.`;
                statusMessage.className = 'status-message success';
            }
        } catch (error) { console.error("Error writing attendance: ", error); }
    }
    document.getElementById('present-btn').addEventListener('click', () => markAttendance("Present"));
    document.getElementById('absent-btn').addEventListener('click', () => markAttendance("Absent"));

    async function generateDashboard() {
        const dashboardBody = document.getElementById('dashboard-body');
        dashboardBody.innerHTML = `<tr><td colspan="7">Loading...</td></tr>`;

        const allUsers = [{ name: adminUser.name, role: adminUser.role }, ...validEmployees.map(n => ({ name: n, role: 'Employee' })), ...validInterns.map(n => ({ name: n, role: 'Intern' }))];
        const today = getFormattedDate(new Date());

        const allUserDataPromises = allUsers.map(async (user) => {
            const userEmail = nameToEmail(user.name);
            const userQuery = await db.collection('users').where("email", "==", userEmail).get();
            let attendance = {};
            if (!userQuery.empty) {
                attendance = userQuery.docs[0].data().attendance || {};
            }
            const stats = await calculateAttendanceStats(user.name, attendance);
            
            let todayStatusHtml = '<span class="status-unmarked">Unmarked</span>';
            const todayRecord = attendance[today];
            if (todayRecord) {
                todayStatusHtml = `<span class="status-${todayRecord.status.toLowerCase()}">${todayRecord.status} (${todayRecord.time})</span>`;
            }

            return { ...user, stats, todayStatusHtml };
        });

        const allUserData = await Promise.all(allUserDataPromises);
        let tableHTML = '';
        
        allUserData.forEach(userData => {
            const { name, role, stats, todayStatusHtml } = userData;
            const rowClass = role === 'CEO' ? ' class="ceo-row"' : '';
            const missedDaysCell = stats.daysMissed > 0 ? `<td class="missed-days-cell">${stats.daysMissed}</td>` : `<td>${stats.daysMissed}</td>`;
            tableHTML += `<tr data-username="${name}"${rowClass}>
                            <td>${name}</td>
                            <td>${role}</td>
                            <td>${todayStatusHtml}</td>
                            <td>${stats.daysAttended}</td>
                            ${missedDaysCell}
                            <td>${stats.leavesTakenThisYear}</td>
                            <td>${stats.leavesRemaining}</td>
                         </tr>`;
        });
        
        dashboardBody.innerHTML = tableHTML;
        dashboardBody.querySelectorAll('tr').forEach(row => {
            row.addEventListener('click', async () => {
                const username = row.dataset.username;
                if (!username) return;
                const userEmail = nameToEmail(username);
                const userQuery = await db.collection('users').where("email", "==", userEmail).get();
                let attendance = {};
                if (!userQuery.empty) {
                    attendance = userQuery.docs[0].data().attendance || {};
                }
                showAttendanceModal(username, attendance);
            });
        });
    }

    async function generateQuickStats() {
        const onLeaveList = document.getElementById('on-leave-today-list');
        const onLeaveCount = document.getElementById('on-leave-count');
        const mostLeavesMonthList = document.getElementById('most-leaves-month-list');
        const mostLeavesYearList = document.getElementById('most-leaves-year-list');
        onLeaveList.innerHTML = '<li>Loading...</li>';
        mostLeavesMonthList.innerHTML = '';
        mostLeavesYearList.innerHTML = '';

        const allUsersSnapshot = await db.collection('users').get();
        let allUsersData = [];
        allUsersSnapshot.forEach(doc => allUsersData.push({ id: doc.id, ...doc.data() }));

        const today = getFormattedDate(new Date());
        const onLeaveToday = allUsersData.filter(user => user.attendance && user.attendance[today] && user.attendance[today].status === 'Absent');
        
        onLeaveCount.textContent = onLeaveToday.length;
        onLeaveList.innerHTML = onLeaveToday.length > 0 ? onLeaveToday.map(user => `<li>${user.name}</li>`).join('') : '<li>None</li>';

        const leaveCounts = await Promise.all(allUsersData.map(async (user) => {
            const stats = await calculateAttendanceStats(user.name, user.attendance);
            return { name: user.name, month: stats.leavesTakenThisMonth, year: stats.leavesTakenThisYear };
        }));
        
        leaveCounts.sort((a, b) => b.year - a.year);
        leaveCounts.slice(0, 5).forEach(user => {
            if (user.year > 0) {
                const li = document.createElement('li');
                li.textContent = `${user.name} (${user.year} leaves)`;
                mostLeavesYearList.appendChild(li);
            }
        });
        if (mostLeavesYearList.children.length === 0) mostLeavesYearList.innerHTML = '<li>No leaves taken yet.</li>';

        leaveCounts.sort((a, b) => b.month - a.month);
        leaveCounts.slice(0, 5).forEach(user => {
            if (user.month > 0) {
                const li = document.createElement('li');
                li.textContent = `${user.name} (${user.month} leaves)`;
                mostLeavesMonthList.appendChild(li);
            }
        });
        if (mostLeavesMonthList.children.length === 0) mostLeavesMonthList.innerHTML = '<li>No leaves taken yet.</li>';
    }

    async function calculateAttendanceStats(username, attendanceData) {
        let attendance = attendanceData || {};
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();
        let workingDaysThisMonth = 0, daysAttended = 0, leavesTakenThisMonth = 0, leavesTakenThisYear = 0, daysMissed = 0;
        
        for (let day = 1; day <= today.getDate(); day++) {
            const date = new Date(currentYear, currentMonth, day);
            if (date.getDay() !== 0 && !nationalHolidays.includes(`${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)) {
                workingDaysThisMonth++;
                const formattedDate = getFormattedDate(date);
                if (attendance[formattedDate]?.status === 'Present') daysAttended++;
                else if (!attendance[formattedDate]) daysMissed++;
            }
        }
        
        Object.keys(attendance).forEach(dateStr => {
            const recordDate = new Date(dateStr);
            if (attendance[dateStr]?.status === 'Absent') {
                if(recordDate.getDay() !== 0 && !nationalHolidays.includes(dateStr.substring(5))){
                    if (recordDate.getFullYear() === currentYear) leavesTakenThisYear++;
                    if (recordDate.getFullYear() === currentYear && recordDate.getMonth() === currentMonth) leavesTakenThisMonth++;
                }
            }
        });
        const leavesRemaining = Math.max(0, yearlyPaidLeaves - leavesTakenThisYear);
        return { workingDaysThisMonth, daysAttended, daysMissed, leavesTakenThisMonth, leavesTakenThisYear, leavesRemaining, attendance };
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
            const record = attendance[formattedDate];
            if (date > today) { dayEl.classList.add('future'); } 
            else if (record?.status === 'Present') {
                dayEl.classList.add('present');
                if (record.time) { dayEl.innerHTML += `<span class="attendance-time">${record.time}</span>`; }
            } else if (record?.status === 'Absent') {
                dayEl.classList.add('absent');
                if (record.time) { dayEl.innerHTML += `<span class="attendance-time">${record.time}</span>`; }
            } else if (dayOfWeek === 0 || nationalHolidays.includes(formattedDateMMDD)) {
                dayEl.classList.add('holiday');
            } else { 
                dayEl.classList.add('unmarked');
            }
            calendarGrid.appendChild(dayEl);
        }
        attendanceModal.style.display = 'flex';
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const usernameInput = document.getElementById('username').value;
        const passwordInput = document.getElementById('password').value;
        const loginError = document.getElementById('login-error');
        loginError.textContent = '';
        if (!passwordInput) { showCreatePasswordPage(); return; }
        const email = usernameInput.includes('@') ? usernameInput : nameToEmail(usernameInput);
        try { await auth.signInWithEmailAndPassword(email, passwordInput); }
        catch (error) { loginError.textContent = 'Incorrect password or user does not exist.'; }
    });

    async function showCreatePasswordPage() {
        const usernameInput = document.getElementById('username').value;
        const allUsers = [{name: adminUser.name, role: adminUser.role}, ...validEmployees.map(n => ({name: n, role: 'Employee'})), ...validInterns.map(n => ({name: n, role: 'Intern'}))];
        const normalizedInput = usernameInput.toLowerCase().replace(/\s+/g, '');
        const validUser = allUsers.find(u => u.name.toLowerCase().replace(/\s+/g, '') === normalizedInput);
        
        if (!validUser) {
             document.getElementById('login-error').textContent = 'This user is not in the company list.';
             return;
        }
        
        const userEmail = nameToEmail(validUser.name);
        const userCheck = await db.collection('users').where("email", "==", userEmail).get();
        if(!userCheck.empty){
             document.getElementById('login-error').textContent = 'This user already has a password. Please log in.';
             return;
        }

        currentUserName = validUser.name;
        
        allUI.forEach(el => el.style.display = 'none');
        createPasswordContainer.style.display = 'block';
        document.getElementById('new-user-name').textContent = validUser.name;
        document.getElementById('user-email-display').textContent = userEmail;
        createPasswordForm.reset();
    }

    createPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const errorEl = document.getElementById('create-password-error');
        errorEl.textContent = '';
        if (newPassword.length < 6) { errorEl.textContent = 'Password must be at least 6 characters.'; return; }
        if (newPassword !== confirmPassword) { errorEl.textContent = 'Passwords do not match.'; return; }
        try {
            const userEmail = document.getElementById('user-email-display').textContent;
            const userName = document.getElementById('new-user-name').textContent;
            const userRole = validEmployees.includes(userName) ? 'Employee' : (validInterns.includes(userName) ? 'Intern' : 'CEO');
            const userCredential = await auth.createUserWithEmailAndPassword(userEmail, newPassword);
            await db.collection('users').doc(userCredential.user.uid).set({ name: userName, email: userEmail, role: userRole });
        } catch (error) { errorEl.textContent = error.message; }
    });
    
    document.getElementById('forgot-password-link').addEventListener('click', (e) => {
        e.preventDefault();
        forgotPasswordModal.style.display = 'flex';
        document.getElementById('reset-message').textContent = '';
        forgotPasswordForm.reset();
    });

    forgotPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('reset-email').value;
        const messageEl = document.getElementById('reset-message');
        try {
            await auth.sendPasswordResetEmail(email);
            messageEl.textContent = 'Success! Check your email for a reset link.';
            messageEl.className = 'reset-message success';
        } catch (error) {
            messageEl.textContent = 'Error: Could not send email. Check the address.';
            messageEl.className = 'reset-message error';
        }
    });

    document.getElementById('leave-request-btn').addEventListener('click', () => {
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
        if (!leaveDate) { messageEl.textContent = 'Please select a date.'; messageEl.className = 'reset-message error'; return; }
        try {
            await db.collection('leave-requests').add({ userId: currentUser.uid, userName: currentUserName, date: leaveDate, reason: leaveReason || 'Not specified', status: 'pending' });
            messageEl.textContent = 'Leave request submitted successfully!';
            messageEl.className = 'reset-message success';
            setTimeout(() => { leaveRequestModal.style.display = 'none'; }, 2000);
        } catch (error) {
            messageEl.textContent = 'Failed to submit request.';
            messageEl.className = 'reset-message error';
        }
    });

    const handleLogout = () => auth.signOut();
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.getElementById('admin-logout-btn').addEventListener('click', handleLogout);

    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal-overlay').style.display = 'none';
        });
    });
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            e.target.style.display = 'none';
        }
    });

    async function loadLeaveRequests() {
        const requestsBody = document.getElementById('leave-requests-body');
        db.collection('leave-requests').where('status', '==', 'pending').onSnapshot(snapshot => {
            if (snapshot.empty) {
                requestsBody.innerHTML = '<tr><td colspan="4">No pending leave requests.</td></tr>';
                return;
            }
            requestsBody.innerHTML = '';
            snapshot.forEach(doc => {
                const request = doc.data();
                const row = document.createElement('tr');
                row.innerHTML = `<td>${request.date}</td><td>${request.userName}</td><td>${request.reason}</td>
                                 <td>
                                     <button class="action-btn approve-btn" data-id="${doc.id}" data-user-id="${request.userId}" data-date="${request.date}">Approve</button>
                                     <button class="action-btn deny-btn" data-id="${doc.id}">Deny</button>
                                 </td>`;
                requestsBody.appendChild(row);
            });
        });
    }

    document.getElementById('leave-requests-table').addEventListener('click', async (e) => {
        const target = e.target;
        const requestId = target.dataset.id;
        if (!requestId) return;
        const leaveRequestRef = db.collection('leave-requests').doc(requestId);
        if (target.classList.contains('approve-btn')) {
            const userId = target.dataset.userId;
            const leaveDate = target.dataset.date;
            const userRef = db.collection('users').doc(userId);
            const attendanceRecord = {
                status: 'Absent',
                time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
            };
            await userRef.set({ attendance: { [leaveDate]: attendanceRecord } }, { merge: true });
            await leaveRequestRef.update({ status: 'approved' });
            generateDashboard();
            generateQuickStats();
        } else if (target.classList.contains('deny-btn')) {
            await leaveRequestRef.update({ status: 'denied' });
        }
    });
});