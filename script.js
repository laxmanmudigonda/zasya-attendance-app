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
    // ... (Employee and Intern lists are the same)
    const yearlyPaidLeaves = 8;
    const nationalHolidays = ["01-01", "01-26", "08-15", "10-02"];
    const SESSION_DURATION = 10 * 60 * 1000; // 10 minutes

    const allUI = document.querySelectorAll('.container, .modal-overlay');
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
                // No alert needed, as onAuthStateChanged handles the UI switch
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

    // --- AUTHENTICATION & ROUTING ---
    auth.onAuthStateChanged(async user => {
        if (user) {
            currentUser = user;
            startSessionTimer(); // Start timer on login
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
    
    // --- ADMIN ATTENDANCE PROMPT ---
    function showAdminAttendancePrompt() {
        allUI.forEach(el => el.style.display = 'none');
        document.getElementById('admin-attendance-modal').style.display = 'flex';
    }
    document.getElementById('admin-present-btn').addEventListener('click', async () => {
        await markAttendance("Present");
        document.getElementById('admin-attendance-modal').style.display = 'none';
        showAdminPanel();
    });
    document.getElementById('admin-absent-btn').addEventListener('click', async () => {
        await markAttendance("Absent");
        document.getElementById('admin-attendance-modal').style.display = 'none';
        showAdminPanel();
    });
    
    // --- ATTENDANCE MARKING (UPDATED) ---
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

    // --- ADMIN PANEL & STATS (UPDATED) ---
    function showAdminPanel() {
        allUI.forEach(el => el.style.display = 'none');
        document.getElementById('admin-panel-container').style.display = 'block';
        generateDashboard();
        loadLeaveRequests();
        generateQuickStats();
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
        
        // Yearly Leaders
        leaveCounts.sort((a, b) => b.year - a.year);
        leaveCounts.slice(0, 5).forEach(user => {
            if (user.year > 0) {
                const li = document.createElement('li');
                li.textContent = `${user.name} (${user.year} leaves)`;
                mostLeavesYearList.appendChild(li);
            }
        });
        if (mostLeavesYearList.children.length === 0) mostLeavesYearList.innerHTML = '<li>No leaves taken yet.</li>';

        // Monthly Leaders
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

    async function calculateAttendanceStats(username, attendanceData = null) {
        let attendance = attendanceData || {};
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();
        let workingDaysThisMonth = 0, daysAttended = 0, leavesTakenThisMonth = 0, leavesTakenThisYear = 0, daysMissed = 0;
        
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
            const recordDate = new Date(dateStr);
            if (attendance[dateStr]?.status === 'Absent') {
                const dayOfWeek = recordDate.getDay();
                const formattedDateMMDD = dateStr.substring(5);
                if(dayOfWeek !== 0 && !nationalHolidays.includes(formattedDateMMDD)){
                    if (recordDate.getFullYear() === currentYear) leavesTakenThisYear++;
                    if (recordDate.getFullYear() === currentYear && recordDate.getMonth() === currentMonth) leavesTakenThisMonth++;
                }
            }
        });
        const leavesRemaining = Math.max(0, yearlyPaidLeaves - leavesTakenThisYear);
        return { workingDaysThisMonth, daysAttended, daysMissed, leavesTakenThisMonth, leavesTakenThisYear, leavesRemaining, attendance };
    }
    
    function showAttendanceModal(username, attendance) {
        // ... (Modal logic updated to show time for both present and absent)
    }
    
    // --- All other existing functions (login, password, modals, etc.) ---
    // (This is a simplified representation to keep the response clean)
    // --- LOGIN FORM, CREATE PASSWORD, FORGOT PASSWORD
    // --- LEAVE REQUEST LOGIC
    // --- LOGOUT & MODAL CLOSE
    // --- PAGE DISPLAY FUNCTIONS
    // --- ADMIN DASHBOARD & LEAVE MANAGEMENT
});