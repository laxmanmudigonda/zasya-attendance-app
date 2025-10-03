document.addEventListener('DOMContentLoaded', () => {

    const firebaseConfig = {
  apiKey: "AIzaSyBUA2TgF-R61y65hYkc1iGl98XkJjn92zs",
  authDomain: "zasya-attendance-app.firebaseapp.com",
  projectId: "zasya-attendance-app",
  storageBucket: "zasya-attendance-app.firebasestorage.app",
  messagingSenderId: "120093727111",
  appId: "1:120093727111:web:9d4f4be7039ffe3bf15b22",
  measurementId: "G-CCZ025JE5C"
};
    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();

    // --- USER LISTS & CONFIG ---
    const adminUser = { name: "Varaprasad Mudigonda", role: "CEO" };
    const validEmployees = ["Divyansh Kushwah", "Manish Nimkhede", "Nikhil Khiyani", "Nikhil Patil", "Sawari Maheswari", "Suhas Ambeti", "Laxman Mudigonda"];
    const validInterns = ["Yashweer Potelu", "Akshith Varma", "Hari krishna", "Keerthan Modem", "Mithil Pollipalli", "Aryan Mansuke", "Vaishak Kundhavan", "Anuj Arya"];
    const yearlyPaidLeaves = 8;
    const nationalHolidays = ["01-01", "01-26", "08-15", "10-02"];

    // --- GETTING HTML ELEMENTS ---
    const loginContainer = document.getElementById('login-container');
    const createPasswordContainer = document.getElementById('create-password-container');
    const attendanceContainer = document.getElementById('attendance-container');
    const adminPanelContainer = document.getElementById('admin-panel-container');
    const attendanceModal = document.getElementById('attendance-modal');
    const forgotPasswordModal = document.getElementById('forgot-password-modal');
    const leaveRequestModal = document.getElementById('leave-request-modal');
    const loginForm = document.getElementById('login-form');
    const createPasswordForm = document.getElementById('create-password-form');
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const leaveRequestForm = document.getElementById('leave-request-form');
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const presentButton = document.getElementById('present-btn');
    const absentButton = document.getElementById('absent-btn');
    const leaveRequestButton = document.getElementById('leave-request-btn');
    const logoutButton = document.getElementById('logout-btn');
    const adminLogoutButton = document.getElementById('admin-logout-btn');

    let currentUser = null; 
    let currentUsername = null; 

    // --- HELPER FUNCTIONS ---
    const getFormattedDate = (date) => date.toISOString().slice(0, 10);
    const nameToEmail = (name) => `${name.toLowerCase().replace(/\s+/g, '')}@zasya.online`;

    // --- AUTHENTICATION & ROUTING ---
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            db.collection('users').doc(user.uid).get().then(doc => {
                if (doc.exists) {
                    currentUsername = doc.data().name;
                    if (currentUsername === adminUser.name) showAdminPanel();
                    else showAttendancePage();
                } else { auth.signOut(); }
            });
        } else {
            currentUser = null;
            currentUsername = null;
            showLoginPage();
        }
    });

    // --- LOGIN, PASSWORD CREATION, FORGOT PASSWORD ---
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

    createPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const errorEl = document.getElementById('create-password-error');
        errorEl.textContent = '';
        if (newPassword.length < 6) { errorEl.textContent = 'Password must be at least 6 characters.'; return; }
        if (newPassword !== confirmPassword) { errorEl.textContent = 'Passwords do not match.'; return; }
        try {
            const userCredential = await auth.createUserWithEmailAndPassword(currentUsername.email, newPassword);
            await db.collection('users').doc(userCredential.user.uid).set({ name: currentUsername.name, email: currentUsername.email, role: currentUsername.role });
        } catch (error) { errorEl.textContent = error.message; }
    });
    
    forgotPasswordLink.addEventListener('click', (e) => {
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
    const handleLogout = () => auth.signOut();
    logoutButton.addEventListener('click', handleLogout);
    adminLogoutButton.addEventListener('click', handleLogout);

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

    const markAttendance = async (status) => {
        if (!currentUser) return;
        const today = new Date();
        const formattedDate = getFormattedDate(today);
        const userRef = db.collection('users').doc(currentUser.uid);
        try {
            await userRef.set({ attendance: { [formattedDate]: status } }, { merge: true });
            const statusMessage = document.getElementById('status-message');
            statusMessage.textContent = status === "Present" ? '✅ Attendance Marked: PRESENT.' : '❌ Marked as ABSENT/LEAVE.';
            statusMessage.style.color = status === "Present" ? 'green' : 'red';
        } catch (error) { console.error("Error writing attendance: ", error); }
    };
    presentButton.addEventListener('click', () => markAttendance("Present"));
    absentButton.addEventListener('click', () => markAttendance("Absent"));
    
    // --- PAGE DISPLAY & ADMIN FUNCTIONS ---
    function showLoginPage() {
        [attendanceContainer, createPasswordContainer, adminPanelContainer, attendanceModal, forgotPasswordModal, leaveRequestModal].forEach(c => c.style.display = 'none');
        loginContainer.style.display = 'block';
        loginForm.reset();
    }
    
    async function showCreatePasswordPage() {
        const usernameInput = document.getElementById('username').value;
        const allUsers = [{name: adminUser.name, role: adminUser.role}, ...validEmployees.map(n => ({name: n, role: 'Employee'})), ...validInterns.map(n => ({name: n, role: 'Intern'}))];
        const normalizedInput = usernameInput.toLowerCase().replace(/\s+/g, '');
        const validUser = allUsers.find(u => u.name.toLowerCase().replace(/\s+/g, '') === normalizedInput);
        if (!validUser) { document.getElementById('login-error').textContent = 'This user is not in the company list.'; return; }
        const userEmail = nameToEmail(validUser.name);
        const userCheck = await db.collection('users').where("email", "==", userEmail).get();
        if(!userCheck.empty){ document.getElementById('login-error').textContent = 'This user already has a password. Please log in.'; return; }
        currentUsername = {name: validUser.name, email: userEmail, role: validUser.role};
        [loginContainer, attendanceContainer, adminPanelContainer].forEach(c => c.style.display = 'none');
        createPasswordContainer.style.display = 'block';
        document.getElementById('new-user-name').textContent = currentUsername.name;
        document.getElementById('user-email-display').textContent = currentUsername.email;
        createPasswordForm.reset();
    }

    function showAttendancePage() {
        [loginContainer, createPasswordContainer, adminPanelContainer].forEach(c => c.style.display = 'none');
        attendanceContainer.style.display = 'block';
        document.getElementById('display-username').textContent = currentUsername;
        document.getElementById('status-message').textContent = '';
        const today = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        document.getElementById('current-date').textContent = today.toLocaleDateString('en-US', options);
    }
    
    function showAdminPanel() {
        [loginContainer, createPasswordContainer, attendanceContainer].forEach(c => c.style.display = 'none');
        adminPanelContainer.style.display = 'block';
        generateDashboard();
        loadLeaveRequests();
    }

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
            await userRef.set({ attendance: { [leaveDate]: 'Absent' } }, { merge: true });
            await leaveRequestRef.update({ status: 'approved' });
            generateDashboard();
        } else if (target.classList.contains('deny-btn')) {
            await leaveRequestRef.update({ status: 'denied' });
        }
    });

    async function generateDashboard() {
        const dashboardBody = document.getElementById('dashboard-body');
        dashboardBody.innerHTML = '<tr><td colspan="7">Loading dashboard...</td></tr>';
        const allUsers = [{ name: adminUser.name, role: adminUser.role }, ...validEmployees.map(n => ({ name: n, role: 'Employee' })), ...validInterns.map(n => ({ name: n, role: 'Intern' }))];
        let tableHTML = '';
        for (const user of allUsers) {
            const stats = await calculateAttendanceStats(user.name);
            const rowClass = user.role === 'CEO' ? ' class="ceo-row"' : '';
            const missedDaysCell = stats.daysMissed > 0 ? `<td class="missed-days-cell">${stats.daysMissed}</td>` : `<td>${stats.daysMissed}</td>`;
            tableHTML += `<tr data-username="${user.name}"${rowClass}>
                            <td>${user.name}</td><td>${user.role}</td><td>${stats.workingDaysThisMonth}</td><td>${stats.daysAttended}</td>
                            ${missedDaysCell}<td>${stats.leavesTakenThisYear}</td><td>${stats.leavesRemaining}</td>
                         </tr>`;
        }
        dashboardBody.innerHTML = tableHTML;
        dashboardBody.querySelectorAll('tr').forEach(row => {
            row.addEventListener('click', async () => {
                const username = row.dataset.username;
                if (!username) return;
                const stats = await calculateAttendanceStats(username);
                showAttendanceModal(username, stats.attendance);
            });
        });
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
                if (attendance[formattedDateYYYYMMDD] === 'Present') {
                    daysAttended++;
                } else if (!attendance[formattedDateYYYYMMDD]) {
                    daysMissed++;
                }
            }
        }
        Object.keys(attendance).forEach(dateStr => {
            if (new Date(dateStr).getFullYear() === currentYear && attendance[dateStr] === 'Absent') {
                const dayOfWeek = new Date(dateStr).getDay();
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
            if (date > today) {
                dayEl.classList.add('future');
            } else if (attendance[formattedDate] === 'Present') {
                dayEl.classList.add('present');
            } else if (attendance[formattedDate] === 'Absent') {
                dayEl.classList.add('absent');
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