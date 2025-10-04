document.addEventListener('DOMContentLoaded', () => {

    // --- PASTE YOUR FIREBASE CONFIGURATION OBJECT HERE ---
    // For Firebase JS SDK v7.20.0 and later, measurementId is optional
    const firebaseConfig = {
    apiKey: "AIzaSyBUA2TgF-R61y65hYkc1iGl98XkJjn92zs",
    authDomain: "zasya-attendance-app.firebaseapp.com",
    projectId: "zasya-attendance-app",
    storageBucket: "zasya-attendance-app.firebasestorage.app",
    messagingSenderId: "120093727111",
    appId: "1:120093727111:web:9d4f4be7039ffe3bf15b22",
    measurementId: "G-CCZ025JE5C"
};

    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();

    const adminUser = { name: "Varaprasad Mudigonda", role: "CEO" };
    const validEmployees = ["Divyansh Kushwah", "Manish Nimkhede", "Nikhil Khiyani", "Nikhil Patil", "Sawari Maheswari", "Suhas Ambeti", "Laxman Mudigonda"];
    const validInterns = ["Yashweer Potelu", "Akshith Varma", "Hari krishna", "Keerthan Modem", "Mithil Pollipalli", "Aryan Mansuke", "Vaishak Kundhavan", "Anuj Arya"];
    const yearlyPaidLeaves = 8;
    const nationalHolidays = ["01-01", "01-26", "08-15", "10-02"];
    const SESSION_DURATION = 10 * 60 * 1000; // 10 minutes

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
    let sessionIntervalId = null;

    const getFormattedDate = (date) => date.toISOString().slice(0, 10);
    const nameToEmail = (name) => `${name.toLowerCase().replace(/\s+/g, '')}@zasya.online`;

    // --- SESSION TIMER LOGIC ---
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

    // --- PAGE DISPLAY FUNCTIONS (DEFINED EARLY TO PREVENT ERRORS) ---
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

    // --- AUTHENTICATION & ROUTING ---
    auth.onAuthStateChanged(async user => {
        if (user) {
            currentUser = user;
            startSessionTimer();
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
            } else { auth.signOut(); }
        } else {
            showLoginPage();
            clearInterval(sessionIntervalId);
        }
    });
    
    // --- ADMIN ATTENDANCE PROMPT BUTTONS ---
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
    
    // --- ATTENDANCE MARKING ---
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

    // --- ADMIN PANEL STATS ---
    async function generateQuickStats() {
        const onLeaveList = document.getElementById('on-leave-today-list');
        const onLeaveCount = document.getElementById('on-leave-count');
        const mostLeavesMonthList = document.getElementById('most-leaves-month-list');
        const mostLeavesYearList = document.getElementById('most-leaves-year-list');
        onLeaveList.innerHTML = '<li>Loading...</li>';
        mostLeavesMonthList.innerHTML = '<li>Loading...</li>';
        mostLeavesYearList.innerHTML = '<li>Loading...</li>';

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
        mostLeavesYearList.innerHTML = '';
        leaveCounts.slice(0, 5).forEach(user => {
            if (user.year > 0) {
                const li = document.createElement('li');
                li.textContent = `${user.name} (${user.year} leaves)`;
                mostLeavesYearList.appendChild(li);
            }
        });
        if (mostLeavesYearList.children.length === 0) mostLeavesYearList.innerHTML = '<li>No leaves taken yet.</li>';

        leaveCounts.sort((a, b) => b.month - a.month);
        mostLeavesMonthList.innerHTML = '';
        leaveCounts.slice(0, 5).forEach(user => {
            if (user.month > 0) {
                const li = document.createElement('li');
                li.textContent = `${user.name} (${user.month} leaves)`;
                mostLeavesMonthList.appendChild(li);
            }
        });
        if (mostLeavesMonthList.children.length === 0) mostLeavesMonthList.innerHTML = '<li>No leaves taken yet.</li>';
    }

    async function calculateAttendanceStats(username, attendanceData = null) {
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
                    if (recordDate.getMonth() === currentMonth) leavesTakenThisMonth++;
                }
            }
        });
        const leavesRemaining = Math.max(0, yearlyPaidLeaves - leavesTakenThisYear);
        return { workingDaysThisMonth, daysAttended, daysMissed, leavesTakenThisMonth, leavesTakenThisYear, leavesRemaining, attendance };
    }
    
    // --- All other functions (login, password, modals, etc.) ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        // ... (Full function code)
    });

    createPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        // ... (Full function code)
    });
    
    // ... all other functions and event listeners ...
});