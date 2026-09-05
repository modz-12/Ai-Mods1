// app.js
// ملاحظة: يجب أن يتم تحميل هذا الملف بعد السكربت النمطي في index.html
// جميع الدوال من Firebase متاحة عبر window.FirebaseAuth و window.Firestore

document.addEventListener('DOMContentLoaded', () => {
    // استخراج الدوال
    const { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } = window.FirebaseAuth;
    const { doc, getDoc, setDoc, updateDoc, collection, addDoc, query, where, orderBy, limit, getDocs, increment, serverTimestamp } = window.Firestore;
    const auth = window.auth;
    const db = window.db;

    // ─── شاشة التحميل ───
    const loadingScreen = document.getElementById('loadingScreen');
    const loadingBarFill = document.getElementById('loadingBarFill');
    const loadingPercentage = document.getElementById('loadingPercentage');
    const loadingStatus = document.getElementById('loadingStatus');
    let progress = 0;

    const loadingInterval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 100) {
            progress = 100;
            clearInterval(loadingInterval);
            setTimeout(() => {
                loadingScreen.classList.add('hidden');
                checkAuthState();
            }, 500);
        }
        loadingBarFill.style.width = `${progress}%`;
        loadingPercentage.textContent = `${Math.floor(progress)}%`;
        if (progress < 30) loadingStatus.textContent = 'جارٍ تحميل الموارد...';
        else if (progress < 60) loadingStatus.textContent = 'جارٍ الاتصال بالخادم...';
        else if (progress < 90) loadingStatus.textContent = 'جارٍ تجهيز الواجهة...';
        else loadingStatus.textContent = 'اكتمل التحميل!';
    }, 300);

    // ─── المصادقة ───
    const authScreen = document.getElementById('authScreen');
    const mainApp = document.getElementById('mainApp');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loginError = document.getElementById('loginError');
    const registerError = document.getElementById('registerError');
    const authTabs = document.querySelectorAll('.auth-tab');

    // تبديل التبويبات
    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            authTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const target = tab.dataset.tab;
            if (target === 'login') {
                loginForm.classList.add('active');
                registerForm.classList.remove('active');
            } else {
                registerForm.classList.add('active');
                loginForm.classList.remove('active');
            }
        });
    });

    // تسجيل الدخول
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.textContent = '';
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            loginError.textContent = error.message;
        }
    });

    // إنشاء حساب
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        registerError.textContent = '';
        const username = document.getElementById('registerUsername').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            await setDoc(doc(db, 'users', user.uid), {
                username,
                email,
                xp: 0,
                bonusPoints: 0,
                visits: 0,
                clicks: 0,
                tasksDone: 0,
                streak: 0,
                lastLogin: null,
                joinDate: serverTimestamp(),
                isBanned: false,
                isOwner: false,
                achievements: [],
            });
            // إضافة سجل نشاط
            await addDoc(collection(db, 'users', user.uid, 'activityLog'), {
                type: 'register',
                message: 'تم إنشاء الحساب',
                timestamp: serverTimestamp()
            });
        } catch (error) {
            registerError.textContent = error.message;
        }
    });

    // ─── التحقق من حالة المصادقة ───
    let currentUser = null;
    let currentUserData = null;
    let currentUserDocRef = null;

    function checkAuthState() {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUser = user;
                currentUserDocRef = doc(db, 'users', user.uid);
                authScreen.classList.add('hidden');
                mainApp.classList.remove('hidden');
                await loadUserData();
                setupUserUI();
                loadAllData();
                setupEventListeners();
                await updateVisitCount();
                checkDailyReward();
                checkAchievements();
            } else {
                currentUser = null;
                currentUserData = null;
                authScreen.classList.remove('hidden');
                mainApp.classList.add('hidden');
            }
        });
    }

    async function loadUserData() {
        try {
            const docSnap = await getDoc(currentUserDocRef);
            if (docSnap.exists()) {
                currentUserData = docSnap.data();
                await updateDoc(currentUserDocRef, {
                    lastLogin: serverTimestamp(),
                    visits: increment(1)
                });
                // تحديث البيانات محليًا بعد الزيادة
                currentUserData.visits = (currentUserData.visits || 0) + 1;
                await addActivity('login', 'تسجيل دخول');
                await updateStreak();
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    async function updateStreak() {
        const today = new Date().toDateString();
        const lastLogin = currentUserData.lastLogin ? currentUserData.lastLogin.toDate().toDateString() : null;
        if (lastLogin === today) return;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toDateString();
        if (lastLogin === yesterdayStr) {
            await updateDoc(currentUserDocRef, { streak: increment(1) });
            currentUserData.streak = (currentUserData.streak || 0) + 1;
        } else {
            await updateDoc(currentUserDocRef, { streak: 1 });
            currentUserData.streak = 1;
        }
    }

    async function updateVisitCount() {
        const statsRef = doc(db, 'stats', 'global');
        await setDoc(statsRef, {
            totalVisits: increment(1),
            dailyVisits: increment(1)
        }, { merge: true });
    }

    async function addActivity(type, message) {
        try {
            await addDoc(collection(db, 'users', currentUser.uid, 'activityLog'), {
                type,
                message,
                timestamp: serverTimestamp()
            });
        } catch (e) {}
    }

    // ─── إعداد واجهة المستخدم ───
    function setupUserUI() {
        document.getElementById('navUsername').textContent = currentUserData.username || 'مستخدم';
        document.getElementById('userAvatar').textContent = (currentUserData.username || 'م')[0].toUpperCase();
        document.getElementById('profileAvatar').textContent = (currentUserData.username || 'م')[0].toUpperCase();
        document.getElementById('profileUsername').textContent = currentUserData.username || 'مستخدم';
        document.getElementById('profileEmail').textContent = currentUserData.email || '';
        document.getElementById('joinDate').textContent = currentUserData.joinDate ? currentUserData.joinDate.toDate().toLocaleDateString('ar-EG') : '-';
        document.getElementById('lastLogin').textContent = currentUserData.lastLogin ? currentUserData.lastLogin.toDate().toLocaleString('ar-EG') : '-';
        document.getElementById('profileVisits').textContent = currentUserData.visits || 0;
    }

    function updateLevelUI() {
        const xp = currentUserData.xp || 0;
        const level = Math.floor(xp / 100) + 1;
        const xpForCurrentLevel = (level - 1) * 100;
        const xpForNextLevel = level * 100;
        const progress = ((xp - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel)) * 100;
        
        document.getElementById('displayLevel').textContent = `LEVEL ${level}`;
        document.getElementById('navLevel').textContent = `Lv.${level}`;
        document.getElementById('profileLevelBadge').textContent = `Lv.${level}`;
        document.getElementById('currentXP').textContent = xp - xpForCurrentLevel;
        document.getElementById('xpNeeded').textContent = xpForNextLevel - xpForCurrentLevel;
        document.getElementById('levelProgressFill').style.width = `${progress}%`;
        document.getElementById('totalXP').textContent = xp;
        document.getElementById('bonusPoints').textContent = currentUserData.bonusPoints || 0;
        document.getElementById('profilePointsBadge').textContent = `${currentUserData.bonusPoints || 0} نقطة`;
        document.getElementById('streakCount').textContent = currentUserData.streak || 0;
        document.getElementById('visitCount').textContent = currentUserData.visits || 0;
        document.getElementById('clickCount').textContent = currentUserData.clicks || 0;
        document.getElementById('tasksDone').textContent = currentUserData.tasksDone || 0;
        
        updateUserRank();
    }

    async function updateUserRank() {
        try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, orderBy('xp', 'desc'));
            const snapshot = await getDocs(q);
            let rank = 0;
            snapshot.forEach((docSnap, index) => {
                if (docSnap.id === currentUser.uid) {
                    rank = index + 1;
                }
            });
            document.getElementById('userRank').textContent = rank || '-';
        } catch (e) {}
    }

    // ─── تحميل البيانات ───
    async function loadAllData() {
        await Promise.all([
            loadTasks(),
            loadAchievements(),
            loadLeaderboard(),
            loadUserActivity(),
            loadOwnerPanelData(),
            loadUserAchievements(),
            loadActivityChart()
        ]);
        updateLevelUI();
    }

    // ─── المهام ───
    let tasks = [];
    async function loadTasks() {
        const tasksGrid = document.getElementById('tasksGrid');
        tasksGrid.innerHTML = '';
        try {
            const tasksRef = collection(db, 'tasks');
            const q = query(tasksRef, where('active', '==', true));
            const snapshot = await getDocs(q);
            tasks = [];
            snapshot.forEach(docSnap => {
                tasks.push({ id: docSnap.id, ...docSnap.data() });
            });
            
            // التحقق من المهام المكتملة
            const completedRef = collection(db, 'users', currentUser.uid, 'completedTasks');
            const completedSnapshot = await getDocs(completedRef);
            const completedTasks = new Set();
            completedSnapshot.forEach(docSnap => completedTasks.add(docSnap.data().taskId));
            
            tasks.forEach(task => {
                const isCompleted = completedTasks.has(task.id);
                const card = document.createElement('div');
                card.className = `task-card ${isCompleted ? 'task-completed' : ''}`;
                card.innerHTML = `
                    <h3>${task.title}</h3>
                    <p>${task.description}</p>
                    <span class="task-xp-badge">+${task.xp} XP</span>
                    <div class="task-actions">
                        ${!isCompleted ? `<button class="btn-primary btn-small complete-task-btn" data-task-id="${task.id}">أكمل المهمة</button>` : '<span style="color:var(--success)">✔ تم الإكمال</span>'}
                    </div>
                `;
                tasksGrid.appendChild(card);
            });
            
            document.querySelectorAll('.complete-task-btn').forEach(btn => {
                btn.addEventListener('click', completeTask);
            });
            
            if (tasks.length === 0) {
                tasksGrid.innerHTML = '<p class="empty-message">لا توجد مهام متاحة حالياً</p>';
            }
        } catch (error) {
            console.error('Error loading tasks:', error);
        }
    }

    async function completeTask(e) {
        const taskId = e.target.dataset.taskId;
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;
        
        try {
            const completedRef = collection(db, 'users', currentUser.uid, 'completedTasks');
            const q = query(completedRef, where('taskId', '==', taskId));
            const completedSnapshot = await getDocs(q);
            if (completedSnapshot.size >= (task.maxCompletions || 1)) {
                showNotification('لقد أكملت هذه المهمة بالحد الأقصى');
                return;
            }
            
            await addDoc(completedRef, {
                taskId,
                completedAt: serverTimestamp()
            });
            
            await updateDoc(currentUserDocRef, {
                xp: increment(task.xp),
                tasksDone: increment(1)
            });
            
            await addActivity('task_complete', `أكملت مهمة: ${task.title} (+${task.xp} XP)`);
            
            currentUserData.xp = (currentUserData.xp || 0) + task.xp;
            currentUserData.tasksDone = (currentUserData.tasksDone || 0) + 1;
            
            showNotification(`+${task.xp} XP! أحسنت`);
            await loadTasks();
            updateLevelUI();
            checkAchievements();
        } catch (error) {
            console.error('Error completing task:', error);
        }
    }

    // ─── الإنجازات ───
    const achievementsList = [
        { id: 'first100', name: 'أول 100 XP', description: 'اجمع 100 XP', icon: '🥉', condition: (data) => data.xp >= 100 },
        { id: 'first500', name: 'أول 500 XP', description: 'اجمع 500 XP', icon: '🥈', condition: (data) => data.xp >= 500 },
        { id: 'first1000', name: 'أول 1000 XP', description: 'اجمع 1000 XP', icon: '🥇', condition: (data) => data.xp >= 1000 },
        { id: 'streak7', name: 'أسبوع كامل', description: 'سجل الدخول 7 أيام متتالية', icon: '🔥', condition: (data) => data.streak >= 7 },
        { id: 'tasks10', name: 'منفذ المهام', description: 'أكمل 10 مهام', icon: '⚡', condition: (data) => data.tasksDone >= 10 },
        { id: 'level10', name: 'المستوى 10', description: 'وصل إلى المستوى 10', icon: '👑', condition: (data) => Math.floor(data.xp/100)+1 >= 10 },
        { id: 'level50', name: 'المستوى 50', description: 'وصل إلى المستوى 50', icon: '💎', condition: (data) => Math.floor(data.xp/100)+1 >= 50 },
        { id: 'visits20', name: 'زائر متكرر', description: 'قم بزيارة الموقع 20 مرة', icon: '📅', condition: (data) => data.visits >= 20 },
    ];

    function loadAchievements() {
        const grid = document.getElementById('achievementsGrid');
        grid.innerHTML = '';
        const userAchievements = currentUserData.achievements || [];
        
        achievementsList.forEach(ach => {
            const unlocked = userAchievements.includes(ach.id);
            const card = document.createElement('div');
            card.className = `achievement-card ${unlocked ? 'unlocked' : 'locked'}`;
            card.innerHTML = `
                <div class="achievement-icon">${ach.icon}</div>
                <h3>${ach.name}</h3>
                <p>${ach.description}</p>
                <p style="margin-top:8px;">${unlocked ? '✅ مكتسب' : '🔒 لم يكتسب بعد'}</p>
            `;
            grid.appendChild(card);
        });
    }

    async function checkAchievements() {
        const data = currentUserData;
        const unlocked = data.achievements || [];
        let newAchievements = [];
        
        achievementsList.forEach(ach => {
            if (!unlocked.includes(ach.id) && ach.condition(data)) {
                newAchievements.push(ach.id);
            }
        });
        
        if (newAchievements.length > 0) {
            const updatedAchievements = [...unlocked, ...newAchievements];
            await updateDoc(currentUserDocRef, {
                achievements: updatedAchievements
            });
            currentUserData.achievements = updatedAchievements;
            loadAchievements();
            loadUserAchievements();
            newAchievements.forEach(id => {
                const ach = achievementsList.find(a => a.id === id);
                showNotification(`🏆 إنجاز جديد: ${ach.name}`);
                addActivity('achievement', `حصل على إنجاز: ${ach.name}`);
            });
        }
    }

    function loadUserAchievements() {
        const container = document.getElementById('profileAchievements');
        if (!container) return;
        container.innerHTML = '';
        const userAch = currentUserData.achievements || [];
        if (userAch.length === 0) {
            container.innerHTML = '<p class="empty-message">لا توجد إنجازات بعد</p>';
            return;
        }
        userAch.forEach(id => {
            const ach = achievementsList.find(a => a.id === id);
            if (ach) {
                const badge = document.createElement('span');
                badge.className = 'badge-level';
                badge.style.margin = '3px';
                badge.textContent = `${ach.icon} ${ach.name}`;
                container.appendChild(badge);
            }
        });
    }

    // ─── المتصدرين ───
    async function loadLeaderboard() {
        const tbody = document.getElementById('leaderboardBody');
        tbody.innerHTML = '';
        try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, orderBy('xp', 'desc'), limit(50));
            const snapshot = await getDocs(q);
            let rank = 0;
            snapshot.forEach(docSnap => {
                rank++;
                const user = docSnap.data();
                const level = Math.floor(user.xp/100)+1;
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>#${rank}</td>
                    <td>${user.username}</td>
                    <td>Lv.${level}</td>
                    <td>${user.xp}</td>
                    <td>${user.tasksDone || 0}</td>
                    <td>${user.bonusPoints || 0}</td>
                `;
                tbody.appendChild(row);
            });
        } catch (e) {}
    }

    // ─── سجل نشاط المستخدم ───
    async function loadUserActivity() {
        const activityList = document.getElementById('userActivityLog');
        activityList.innerHTML = '';
        try {
            const activityRef = collection(db, 'users', currentUser.uid, 'activityLog');
            const q = query(activityRef, orderBy('timestamp', 'desc'), limit(20));
            const snapshot = await getDocs(q);
            if (snapshot.empty) {
                activityList.innerHTML = '<p class="empty-message">لا توجد أنشطة بعد</p>';
                return;
            }
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                const item = document.createElement('div');
                item.className = 'activity-item';
                const date = data.timestamp ? data.timestamp.toDate().toLocaleString('ar-EG') : '';
                item.innerHTML = `<span>${data.message}</span><span style="font-size:0.75rem;color:var(--text-muted)">${date}</span>`;
                activityList.appendChild(item);
            });
        } catch (e) {}
    }

    // ─── رسم بياني بسيط ───
    function loadActivityChart() {
        const chart = document.getElementById('activityChart');
        if (!chart) return;
        chart.innerHTML = '';
        const days = ['أمس', 'قبل يومين', '3 أيام', '4 أيام', '5 أيام', '6 أيام', '7 أيام'];
        for (let i = 0; i < 7; i++) {
            const bar = document.createElement('div');
            bar.className = 'chart-bar';
            const height = Math.floor(Math.random() * 80) + 20;
            bar.style.height = `${height}px`;
            bar.title = `${days[i]}: ${height} نشاط`;
            chart.appendChild(bar);
        }
    }

    // ─── لوحة المالك ───
    let isOwner = false;
    async function loadOwnerPanelData() {
        if (currentUser.email === 'admin@modz.wep') {
            isOwner = true;
            document.querySelectorAll('.nav-tab-owner').forEach(el => el.classList.remove('hidden'));
            await loadOwnerStats();
            await loadOwnerTasks();
            await loadOwnerLogs();
            await loadTimeStats('daily');
        }
    }

    async function loadOwnerStats() {
        try {
            const usersRef = collection(db, 'users');
            const snapshot = await getDocs(usersRef);
            let totalUsers = 0;
            let activeUsers = 0;
            let totalXP = 0;
            let totalClicks = 0;
            
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                totalUsers++;
                if (data.lastLogin) {
                    const lastLogin = data.lastLogin.toDate();
                    const daysSince = (Date.now() - lastLogin.getTime()) / (1000*60*60*24);
                    if (daysSince < 7) activeUsers++;
                }
                totalXP += data.xp || 0;
                totalClicks += data.clicks || 0;
            });
            
            document.getElementById('oTotalUsers').textContent = totalUsers;
            document.getElementById('oActiveUsers').textContent = activeUsers;
            document.getElementById('oTotalXP').textContent = totalXP;
            document.getElementById('oTotalClicks').textContent = totalClicks;
            
            const statsDoc = await getDoc(doc(db, 'stats', 'global'));
            if (statsDoc.exists()) {
                document.getElementById('oTotalVisits').textContent = statsDoc.data().totalVisits || 0;
                document.getElementById('oDailyVisits').textContent = statsDoc.data().dailyVisits || 0;
            }
        } catch (e) {}
    }

    async function loadOwnerTasks() {
        const container = document.getElementById('ownerTasksList');
        container.innerHTML = '';
        try {
            const tasksRef = collection(db, 'tasks');
            const snapshot = await getDocs(tasksRef);
            snapshot.forEach(docSnap => {
                const task = docSnap.data();
                const item = document.createElement('div');
                item.className = 'owner-task-item';
                item.innerHTML = `
                    <div class="task-info">
                        <h4>${task.title}</h4>
                        <p>${task.description} | XP: ${task.xp} | مرات: ${task.maxCompletions || 1}</p>
                    </div>
                    <div class="owner-task-actions">
                        <button class="btn-small btn-edit" onclick="window.editTask('${docSnap.id}')">تعديل</button>
                        <button class="btn-small btn-ban" onclick="window.deleteTask('${docSnap.id}')">حذف</button>
                    </div>
                `;
                container.appendChild(item);
            });
        } catch (e) {}
    }

    async function loadOwnerLogs() {
        const container = document.getElementById('ownerLogsList');
        container.innerHTML = '';
        try {
            const logsRef = collection(db, 'ownerLogs');
            const q = query(logsRef, orderBy('timestamp', 'desc'), limit(30));
            const snapshot = await getDocs(q);
            snapshot.forEach(docSnap => {
                const log = docSnap.data();
                const item = document.createElement('div');
                item.className = 'log-item';
                item.textContent = `${log.message} - ${log.timestamp?.toDate().toLocaleString('ar-EG') || ''}`;
                container.appendChild(item);
            });
        } catch (e) {}
    }

    async function loadTimeStats(period) {
        const container = document.getElementById('timeStatsContent');
        container.innerHTML = '<p>جاري تحميل الإحصائيات...</p>';
        const periods = {
            daily: 'آخر 24 ساعة',
            weekly: 'آخر 7 أيام',
            monthly: 'آخر 30 يوم'
        };
        container.innerHTML = `
            <div style="display:flex;gap:20px;flex-wrap:wrap;margin-top:15px;">
                <div class="mini-stat"><span>${periods[period]}</span><strong>${Math.floor(Math.random()*200)}</strong> زيارة</div>
                <div class="mini-stat"><span>مستخدمون جدد</span><strong>${Math.floor(Math.random()*50)}</strong></div>
                <div class="mini-stat"><span>مهام منجزة</span><strong>${Math.floor(Math.random()*100)}</strong></div>
            </div>
        `;
    }

    // ─── إنشاء مهمة (مالك) ───
    async function createTask() {
        const title = document.getElementById('newTaskTitle').value;
        const description = document.getElementById('newTaskDesc').value;
        const xp = parseInt(document.getElementById('newTaskXP').value);
        const maxCompletions = parseInt(document.getElementById('newTaskMax').value);
        const expiry = document.getElementById('newTaskExpiry').value;
        
        if (!title || !xp) {
            showNotification('يرجى ملء الحقول المطلوبة');
            return;
        }
        
        try {
            await addDoc(collection(db, 'tasks'), {
                title,
                description,
                xp,
                maxCompletions,
                active: true,
                createdAt: serverTimestamp(),
                expiry: expiry ? new Date(expiry) : null
            });
            await addDoc(collection(db, 'ownerLogs'), {
                message: `إنشاء مهمة: ${title}`,
                timestamp: serverTimestamp()
            });
            document.getElementById('newTaskTitle').value = '';
            document.getElementById('newTaskDesc').value = '';
            document.getElementById('newTaskXP').value = '';
            document.getElementById('newTaskMax').value = '1';
            document.getElementById('newTaskExpiry').value = '';
            showNotification('تم إنشاء المهمة بنجاح');
            await loadOwnerTasks();
        } catch (e) {
            console.error(e);
        }
    }

    // ─── البحث عن مستخدم ───
    async function searchUser() {
        const searchTerm = document.getElementById('userSearchInput').value.toLowerCase();
        const resultsContainer = document.getElementById('userSearchResults');
        resultsContainer.innerHTML = '';
        if (!searchTerm) return;
        
        try {
            const usersRef = collection(db, 'users');
            const snapshot = await getDocs(usersRef);
            snapshot.forEach(docSnap => {
                const data = docSnap.data();
                if (data.username.toLowerCase().includes(searchTerm) || data.email.toLowerCase().includes(searchTerm)) {
                    const item = document.createElement('div');
                    item.className = 'user-search-result-item';
                    item.innerHTML = `
                        <div class="user-info">
                            <h4>${data.username} ${data.isBanned ? '(موقوف)' : ''}</h4>
                            <p>${data.email} | XP: ${data.xp} | نقاط: ${data.bonusPoints}</p>
                        </div>
                        <div class="user-actions">
                            <button class="btn-small btn-edit" onclick="window.editUserPoints('${docSnap.id}')">تعديل النقاط</button>
                            ${data.isBanned ? 
                                `<button class="btn-small btn-unban" onclick="window.toggleBan('${docSnap.id}', false)">إلغاء الإيقاف</button>` : 
                                `<button class="btn-small btn-ban" onclick="window.toggleBan('${docSnap.id}', true)">إيقاف</button>`}
                        </div>
                    `;
                    resultsContainer.appendChild(item);
                }
            });
        } catch (e) {}
    }

    // ─── تحويل XP ───
    function setupConvertButtons() {
        const convertBtn = document.getElementById('convertBtn');
        const convertBtnPage = document.getElementById('convertBtnPage');
        const convertAmount = document.getElementById('convertAmount');
        const convertAmountPage = document.getElementById('convertAmountPage');
        
        const handleConvert = async (inputElement, resultElement) => {
            const amount = parseInt(inputElement.value);
            if (!amount || amount < 100) {
                resultElement.textContent = 'الحد الأدنى للتحويل 100 XP';
                return;
            }
            if (amount > currentUserData.xp) {
                resultElement.textContent = 'XP غير كافٍ';
                return;
            }
            const bonus = Math.floor(amount / 100) * 10;
            try {
                await updateDoc(currentUserDocRef, {
                    xp: increment(-amount),
                    bonusPoints: increment(bonus)
                });
                currentUserData.xp -= amount;
                currentUserData.bonusPoints = (currentUserData.bonusPoints || 0) + bonus;
                resultElement.textContent = `تم تحويل ${amount} XP إلى ${bonus} نقطة`;
                inputElement.value = '';
                updateLevelUI();
                await addActivity('convert', `حوّل ${amount} XP إلى ${bonus} نقطة`);
                showNotification(`تم التحويل بنجاح!`);
            } catch (e) {
                console.error(e);
            }
        };
        
        convertBtn.addEventListener('click', () => handleConvert(convertAmount, document.getElementById('convertResult')));
        convertBtnPage.addEventListener('click', () => handleConvert(convertAmountPage, document.getElementById('convertResultPage')));
    }

    // ─── مكافأة يومية ───
    function checkDailyReward() {
        const lastReward = localStorage.getItem('lastDailyReward');
        const today = new Date().toDateString();
        const rewardBtn = document.getElementById('dailyRewardBtn');
        if (lastReward === today) {
            rewardBtn.textContent = 'تم استلام مكافأة اليوم ✔';
            rewardBtn.disabled = true;
        } else {
            rewardBtn.textContent = '🎁 مكافأة اليوم (+50 XP)';
            rewardBtn.disabled = false;
        }
    }

    async function claimDailyReward() {
        const lastReward = localStorage.getItem('lastDailyReward');
        const today = new Date().toDateString();
        if (lastReward === today) {
            showNotification('لقد استلمت مكافأة اليوم بالفعل');
            return;
        }
        try {
            await updateDoc(currentUserDocRef, {
                xp: increment(50)
            });
            currentUserData.xp = (currentUserData.xp || 0) + 50;
            localStorage.setItem('lastDailyReward', today);
            document.getElementById('dailyRewardBtn').textContent = 'تم استلام مكافأة اليوم ✔';
            document.getElementById('dailyRewardBtn').disabled = true;
            showNotification('+50 XP! مكافأة يومية');
            updateLevelUI();
            await addActivity('daily_reward', 'استلم مكافأة يومية (+50 XP)');
        } catch (e) {
            console.error(e);
        }
    }

    // ─── إعداد مستمعي الأحداث ───
    function setupEventListeners() {
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const sectionId = tab.dataset.section;
                document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(sectionId).classList.add('active');
            });
        });
        
        document.getElementById('logoutBtn').addEventListener('click', () => {
            signOut(auth);
        });
        
        document.getElementById('createTaskBtn').addEventListener('click', createTask);
        document.getElementById('searchUserBtn').addEventListener('click', searchUser);
        setupConvertButtons();
        document.getElementById('dailyRewardBtn').addEventListener('click', claimDailyReward);
        
        document.querySelectorAll('.time-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.time-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                loadTimeStats(tab.dataset.period);
            });
        });
    }

    // ─── إشعار ───
    function showNotification(message) {
        const notification = document.getElementById('notification');
        const text = document.getElementById('notificationText');
        text.textContent = message;
        notification.classList.remove('hidden');
        setTimeout(() => {
            notification.classList.add('hidden');
        }, 3000);
    }

    // ─── وظائف عامة (تحتاج للوصول من HTML) ───
    window.editTask = (id) => {
        showNotification('وظيفة التعديل قيد التطوير');
    };
    window.deleteTask = async (id) => {
        if (confirm('هل أنت متأكد من حذف هذه المهمة؟')) {
            await deleteDoc(doc(db, 'tasks', id));
            await addDoc(collection(db, 'ownerLogs'), {
                message: `حذف مهمة: ${id}`,
                timestamp: serverTimestamp()
            });
            showNotification('تم حذف المهمة');
            await loadOwnerTasks();
        }
    };
    window.editUserPoints = async (userId) => {
        const newXP = prompt('أدخل XP الجديد:');
        if (newXP !== null) {
            await updateDoc(doc(db, 'users', userId), { xp: parseInt(newXP) });
            await addDoc(collection(db, 'ownerLogs'), {
                message: `تعديل XP للمستخدم ${userId} إلى ${newXP}`,
                timestamp: serverTimestamp()
            });
            showNotification('تم تعديل XP');
            searchUser();
        }
    };
    window.toggleBan = async (userId, ban) => {
        await updateDoc(doc(db, 'users', userId), { isBanned: ban });
        await addDoc(collection(db, 'ownerLogs'), {
            message: `${ban ? 'إيقاف' : 'إلغاء إيقاف'} المستخدم ${userId}`,
            timestamp: serverTimestamp()
        });
        showNotification(ban ? 'تم إيقاف المستخدم' : 'تم إلغاء الإيقاف');
        searchUser();
    };
});