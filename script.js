document.addEventListener('DOMContentLoaded', () => {

    // --- PASTE YOUR FIREBASE CONFIGURATION OBJECT HERE ---
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
    const SESSION_TIMEOUT = 10 * 60 * 1000;

    // --- GETTING HTML ELEMENTS ---
    const allUI = document.querySelectorAll('.container, .modal-overlay');
    const loginContainer = document.getElementById('login-container');
    const createPasswordContainer = document.getElementById('create-password-container');
    const attendanceContainer = document.getElementById('attendance-container');
    const adminPanelContainer = document.getElementById('admin-panel-container');
    const attendanceModal = document.getElementById('attendance-modal');
    const forgotPasswordModal = document.getElementById('forgot-password-modal');
    const leaveRequestModal = document.getElementById('leave-request-modal');
    const adminAttendanceModal = document.getElementById('admin-attendance-modal');

    const loginForm = document.getElementById('login-form');
    const createPasswordForm = document.getElementById('create-password-form');
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const leaveRequestForm = document.getElementById('leave-request-form');

    let currentUser = null;
    let sessionTimeoutId = null;

    // --- HELPER FUNCTIONS ---
    const getFormattedDate = (date) => date.toISOString().slice(0, 10);
    const nameToEmail = (name) => `${name.toLowerCase().replace(/\s+/g, '')}@zasya.online`;

    // --- SESSION TIMEOUT LOGIC ---
    function resetSessionTimeout() {
        clearTimeout(sessionTimeoutId);
        sessionTimeoutId = setTimeout(() => {
            alert("Your session has expired due to inactivity. Please log in again.");
            auth.signOut();
        }, SESSION_TIMEOUT);
    }
    ['click', 'keypress', 'scroll', 'mousemove'].forEach(event => document.addEventListener(event, resetSessionTimeout));

    // --- AUTHENTICATION & ROUTING ---
    auth.onAuthStateChanged(async user => {
        if (user) {
            currentUser = user;
            resetSessionTimeout();
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
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
            } else {
                auth.signOut();
            }
        } else {
            showLoginPage();
            clearTimeout(sessionTimeoutId);
        }
    });

    // --- ADMIN ATTENDANCE PROMPT ---
    function showAdminAttendancePrompt() {
        allUI.forEach(el => el.style.display = 'none');
        adminAttendanceModal.style.display = 'flex';
    }
    document.getElementById('admin-present-btn').addEventListener('click', async () => {
        await markAttendance("Present", adminUser.name);
        adminAttendanceModal.style.display = 'none';
        showAdminPanel();
    });
    document.getElementById('admin-absent-btn').addEventListener('click', async () => {
        await markAttendance("Absent", adminUser.name);
        adminAttendanceModal.style.display = 'none';
        showAdminPanel();
    });

    // --- ATTENDANCE MARKING ---
    async function markAttendance(status, forUserName = null) {
        let userToMarkRef;
        let currentUserNameForStatus = document.getElementById('display-username').textContent;

        if (forUserName) {
            const userQuery = await db.collection('users').where('name', '==', forUserName).get();
            if (!userQuery.empty) {
                userToMarkRef = userQuery.docs[0].ref;
                currentUserNameForStatus = forUserName;
            }
        } else if (currentUser) {
            userToMarkRef = db.collection('users').doc(currentUser.uid);
        }

        if (!userToMarkRef) return;

        const today = new Date();
        const formattedDate = getFormattedDate(today);
        const attendanceRecord = { status: status };

        if (status === "Present") {
            attendanceRecord.time = today.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        }

        try {
            await userToMarkRef.set({ attendance: { [formattedDate]: attendanceRecord } }, { merge: true });
            const statusMessage = document.getElementById('status-message');
            if (statusMessage) {
                statusMessage.textContent = status === "Present" ? `✅ Attendance Marked: PRESENT.` : `❌ Marked as ABSENT/LEAVE.`;
                statusMessage.className = 'status-message success';
            }
        } catch (error) {
            console.error("Error writing attendance: ", error);
        }
    }
    document.getElementById('present-btn').addEventListener('click', () => markAttendance("Present"));
    document.getElementById('absent-btn').addEventListener('click', () => markAttendance("Absent"));

    // --- ADMIN PANEL & STATS ---
    function showAdminPanel() {
        allUI.forEach(el => el.style.display = 'none');
        document.getElementById('admin-panel-container').style.display = 'block';
        generateDashboard();
        loadLeaveRequests();
        generateQuickStats();
    }

    async function generateQuickStats() {
        const onLeaveList = document.getElementById('on-leave-today-list');
        const mostLeavesList = document.getElementById('most-leaves-list');
        onLeaveList.innerHTML = '<li>Loading...</li>';
        mostLeavesList.innerHTML = '';

        const allUsersSnapshot = await db.collection('users').get();
        let allUsersData = [];
        allUsersSnapshot.forEach(doc => allUsersData.push({ id: doc.id, ...doc.data() }));

        const today = getFormattedDate(new Date());
        const onLeaveToday = allUsersData.filter(user => user.attendance && user.attendance[today] && user.attendance[today].status === 'Absent');

        onLeaveList.innerHTML = onLeaveToday.length > 0 ? onLeaveToday.map(user => `<li>${user.name}</li>`).join('') : '<li>None</li>';

        const leaveCounts = await Promise.all(allUsersData.map(async (user) => {
            const stats = await calculateAttendanceStats(user.name, user.attendance);
            return { name: user.name, count: stats.leavesTakenThisYear };
        }));

        leaveCounts.sort((a, b) => b.count - a.count).slice(0, 5).forEach(user => {
            if (user.count > 0) {
                const li = document.createElement('li');
                li.textContent = `${user.name} (${user.count} leaves)`;
                mostLeavesList.appendChild(li);
            }
        });
        if (mostLeavesList.children.length === 0) {
            mostLeavesList.innerHTML = '<li>No leaves taken yet.</li>';
        }
    }

    async function calculateAttendanceStats(username, attendanceData = null) {
        let attendance = attendanceData;
        if (!attendance) {
            const userEmail = nameToEmail(username);
            const userQuery = await db.collection('users').where("email", "==", userEmail).get();
            if (!userQuery.empty) {
                attendance = userQuery.docs[0].data().attendance || {};
            }
        }
        attendance = attendance || {};

        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();
        let workingDaysThisMonth = 0, daysAttended = 0, leavesTakenThisYear = 0, daysMissed = 0;

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
            if (new Date(dateStr).getFullYear() === currentYear && attendance[dateStr]?.status === 'Absent') {
                const dayOfWeek = new Date(dateStr).getDay();
                const formattedDateMMDD = dateStr.substring(5);
                if (dayOfWeek !== 0 && !nationalHolidays.includes(formattedDateMMDD)) {
                    leavesTakenThisYear++;
                }
            }
        });
        const leavesRemaining = Math.max(0, yearlyPaidLeaves - leavesTakenThisYear);
        return { workingDaysThisMonth, daysAttended, daysMissed, leavesTakenThisYear, leavesRemaining, attendance };
    }
    
    // --- LOGIN AND PASSWORD FORMS ---
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
            const userCredential = await auth.createUserWithEmailAndPassword(document.getElementById('user-email-display').textContent, newPassword);
            const userName = document.getElementById('new-user-name').textContent;
            const userRole = validEmployees.includes(userName) ? 'Employee' : (validInterns.includes(userName) ? 'Intern' : 'CEO');
            await db.collection('users').doc(userCredential.user.uid).set({ name: userName, email: document.getElementById('user-email-display').textContent, role: userRole });
        } catch (error) { errorEl.textContent = error.message; }
    });

    // --- LEAVE & FORGOT PASSWORD MODALS ---
    const forgotPasswordLink = document.getElementById('forgot-password-link');
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
            messageEl.className = 'reset-message success';
        } catch (error) {
            messageEl.textContent = 'Error: Could not send email. Check the address.';
            messageEl.className = 'reset-message error';
        }
    });

    const leaveRequestButton = document.getElementById('leave-request-btn');
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
        if (!leaveDate) { messageEl.textContent = 'Please select a date.'; messageEl.className = 'reset-message error'; return; }
        try {
            await db.collection('leave-requests').add({ userId: currentUser.uid, userName: document.getElementById('display-username').textContent, date: leaveDate, reason: leaveReason || 'Not specified', status: 'pending' });
            messageEl.textContent = 'Leave request submitted successfully!';
            messageEl.className = 'reset-message success';
            setTimeout(() => { leaveRequestModal.style.display = 'none'; }, 2000);
        } catch (error) {
            messageEl.textContent = 'Failed to submit request.';
            messageEl.className = 'reset-message error';
        }
    });

    // --- All other functions ---
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
    const showLoginPage = () => { allUI.forEach(el => el.style.display = 'none'); loginContainer.style.display = 'block'; loginForm.reset(); };
    async function showCreatePasswordPage() { /* Full function code from previous turns */ }
    const showAttendancePage = (name) => { allUI.forEach(el => el.style.display = 'none'); document.getElementById('attendance-container').style.display = 'block'; document.getElementById('display-username').textContent = name; /*...*/ };
    async function generateDashboard() { /* Full function code from previous turns */ }
    async function loadLeaveRequests() { /* Full function code from previous turns */ }
    document.getElementById('leave-requests-table').addEventListener('click', async (e) => { /* Full function code from previous turns */ });
    function showAttendanceModal(username, attendance) { /* Full function code from previous turns */ }
});