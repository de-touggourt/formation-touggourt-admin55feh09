// التحقق الأمني من الصلاحيات
if (typeof SecurityGuard !== 'undefined') {
    SecurityGuard.verifySession("INSPECTOR");
}
const firebaseConfig = {
  apiKey: "AIzaSyBNBrVpBK8p_WWNwNhSH-mZ6NXOyr2TLhI",
  authDomain: "voyage-touggourt-48755.firebaseapp.com",
  projectId: "voyage-touggourt-48755",
  storageBucket: "voyage-touggourt-48755.firebasestorage.app",
  messagingSenderId: "712694455348",
  appId: "1:712694455348:web:5b4e8df57347edf944fe61"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

let INSPECTOR_CENTER = sessionStorage.getItem("inspectorCenter");
let rawEmployees = {};
let rawAttendanceDocs = [];
let allRecordedDays = [];
let currentTrackingData = [];

window.onload = async function() {
    const isLoggedIn = sessionStorage.getItem("isLoggedIn");
    INSPECTOR_CENTER = sessionStorage.getItem("inspectorCenter");

    if (!isLoggedIn || !INSPECTOR_CENTER) {
        window.location.href = "/login";
        return;
    }

    document.getElementById("centerTitle").innerText = `المركز: ${INSPECTOR_CENTER}`;

    if (firebase.auth) {
        firebase.auth().onAuthStateChanged(async (user) => {
            if (user) {
                await processTrackingData();
            } else {
                window.location.href = "/login";
            }
        });
    } else {
        await processTrackingData();
    }
};

async function processTrackingData() {
    try {
        const centerClean = INSPECTOR_CENTER.trim();

        // 1. جلب بيانات الأساتذة
        const empSnap = await db.collection("employeescomnew").where("center", "==", centerClean).get();
        rawEmployees = {};
        
        empSnap.forEach(doc => {
            let data = doc.data();
            let key = String(data.id || doc.id).trim();
            rawEmployees[key] = { 
                empId: key, 
                name: data.name || '-', 
                rank: data.grade || '-', 
                specialty: data.maty || '-',
                workplace: data.place || data.workplace || '-',
                group: data.group || data.fawj || '-',
                present: 0, 
                late: 0, 
                absent: 0 
            };
        });

        // 2. جلب سجلات الحضور
        rawAttendanceDocs = [];

        try {
            const startId = `${centerClean}_`;
            const endId = `${centerClean}_\uf8ff`;
            const snapById = await db.collection('attendance_daily')
                .where(firebase.firestore.FieldPath.documentId(), '>=', startId)
                .where(firebase.firestore.FieldPath.documentId(), '<=', endId)
                .get();
            snapById.forEach(d => rawAttendanceDocs.push(d));
        } catch (e) {}

        try {
            const snapByCenter = await db.collection('attendance_daily').where("center", "==", centerClean).get();
            snapByCenter.forEach(d => {
                if (!rawAttendanceDocs.some(x => x.id === d.id)) rawAttendanceDocs.push(d);
            });
        } catch (e) {}

        if (rawAttendanceDocs.length === 0) {
            try {
                const allSnap = await db.collection('attendance_daily').get();
                allSnap.forEach(d => {
                    let dCenter = d.data().center ? String(d.data().center).trim() : "";
                    if (d.id.startsWith(centerClean + "_") || dCenter === centerClean) {
                        if (!rawAttendanceDocs.some(x => x.id === d.id)) rawAttendanceDocs.push(d);
                    }
                });
            } catch (e) {}
        }

        // استخراج قائمة الأيام المسجلة
        let daysSet = new Set();
        rawAttendanceDocs.forEach(d => {
            let parts = d.id.split('_');
            let dateStr = parts[parts.length - 1];
            if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                daysSet.add(dateStr);
            } else if (d.data() && d.data().date) {
                daysSet.add(d.data().date);
            }
        });
        allRecordedDays = Array.from(daysSet).filter(d => d && /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse();

        // ملء قائمة الأيام المنسدلة
        const daySel = document.getElementById("filterDay");
        if (daySel) {
            const curVal = daySel.value || "all";
            daySel.innerHTML = `<option value="all">📅 جميع الأيام المسجلة (${allRecordedDays.length} يوم)</option>`;
            allRecordedDays.forEach(day => {
                daySel.innerHTML += `<option value="${day}">يوم: ${day}</option>`;
            });
            if (curVal !== "all" && allRecordedDays.includes(curVal)) {
                daySel.value = curVal;
            } else {
                daySel.value = "all";
            }
        }

        // حساب البيانات وتعبئة الفلاتر
        applyDayFilterAndCalculate();
        populateFilters();
        filterTable();

    } catch (error) { 
        console.error("Tracking Error:", error); 
        Swal.fire('خطأ', 'فشل في تحميل الإحصائيات: ' + (error.message || ''), 'error'); 
    }
}

// دالة حساب الإحصائيات بناءً على اليوم المختار
function applyDayFilterAndCalculate() {
    const daySel = document.getElementById("filterDay");
    const selectedDay = daySel ? daySel.value : "all";

    // تصفية وثائق الحضور وفق اليوم المختار
    let targetDocs = rawAttendanceDocs;
    if (selectedDay !== "all") {
        targetDocs = rawAttendanceDocs.filter(d => {
            let parts = d.id.split('_');
            let dateStr = parts[parts.length - 1];
            return (dateStr === selectedDay) || (d.data() && d.data().date === selectedDay);
        });
    }

    const calculatedEmployees = [];
    const empKeys = Object.keys(rawEmployees);

    empKeys.forEach(empKey => {
        const emp = rawEmployees[empKey];
        let p = 0, l = 0, a = 0;
        let dayStatus = "-";

        if (selectedDay === "all") {
            // حساب تراكمي عبر جميع الأيام
            targetDocs.forEach(doc => {
                const records = doc.data().records || {};
                let rec = records[empKey] || records[emp.empId];
                let status = rec ? rec.status : 'غائب';

                if (status === 'حاضر') { p++; }
                else if (status === 'متأخر') { l++; }
                else if (status === 'غائب' || status === 'غير محدد') { a++; }
            });
        } else {
            // حساب ليوم واحد محدد
            if (targetDocs.length > 0) {
                const doc = targetDocs[0];
                const records = doc.data().records || {};
                let rec = records[empKey] || records[emp.empId];
                let status = rec ? rec.status : 'غائب';
                dayStatus = status;

                if (status === 'حاضر') { p = 1; }
                else if (status === 'متأخر') { l = 1; }
                else { a = 1; }
            } else {
                // لم يتم تسجيل هذا اليوم بعد
                a = 1;
                dayStatus = 'غائب';
            }
        }

        calculatedEmployees.push({
            ...emp,
            present: p,
            late: l,
            absent: a,
            dayStatus: dayStatus
        });
    });

    currentTrackingData = calculatedEmployees;
}

function onDayFilterChange() {
    applyDayFilterAndCalculate();
    filterTable();
}

// تعبئة القوائم المنسدلة بالفئات المتوفرة
function populateFilters() {
    let ranks = new Set(), specs = new Set(), groups = new Set();
    
    currentTrackingData.forEach(item => {
        if (item.rank && item.rank !== '-') ranks.add(item.rank);
        if (item.specialty && item.specialty !== '-') specs.add(item.specialty);
        if (item.group && item.group !== '-') groups.add(item.group);
    });

    const rankSel = document.getElementById("filterRank");
    const specSel = document.getElementById("filterSpec");
    const groupSel = document.getElementById("filterGroup");

    const curRank = rankSel.value;
    const curSpec = specSel.value;
    const curGroup = groupSel.value;

    rankSel.innerHTML = '<option value="الكل">كل الرتب</option>';
    Array.from(ranks).sort().forEach(r => rankSel.innerHTML += `<option value="${r}">${r}</option>`);
    if (ranks.has(curRank)) rankSel.value = curRank;

    specSel.innerHTML = '<option value="الكل">كل التخصصات</option>';
    Array.from(specs).sort().forEach(s => specSel.innerHTML += `<option value="${s}">${s}</option>`);
    if (specs.has(curSpec)) specSel.value = curSpec;

    groupSel.innerHTML = '<option value="الكل">كل الأفواج</option>';
    Array.from(groups).sort().forEach(g => groupSel.innerHTML += `<option value="${g}">${g}</option>`);
    if (groups.has(curGroup)) groupSel.value = curGroup;
}

function filterTable() {
    const term = document.getElementById('searchInput').value.toLowerCase().trim();
    const rankVal = document.getElementById('filterRank').value;
    const specVal = document.getElementById('filterSpec').value;
    const groupVal = document.getElementById('filterGroup').value;

    const filtered = currentTrackingData.filter(item => {
        const matchSearch = (item.name || "").toLowerCase().includes(term) || 
                            (item.workplace || "").toLowerCase().includes(term) ||
                            (item.empId || "").toLowerCase().includes(term);
        const matchRank = (rankVal === "الكل") || (item.rank === rankVal);
        const matchSpec = (specVal === "الكل") || (item.specialty === specVal);
        const matchGroup = (groupVal === "الكل") || (item.group === groupVal);

        return matchSearch && matchRank && matchSpec && matchGroup;
    });

    // تحديث إحصائيات البطاقات للنتائج المفلترة فقط
    let sumP = 0, sumL = 0, sumA = 0;
    filtered.forEach(item => {
        sumP += item.present;
        sumL += item.late;
        sumA += item.absent;
    });

    document.getElementById('t-total').innerText = filtered.length;
    document.getElementById('t-present').innerText = sumP;
    document.getElementById('t-late').innerText = sumL;
    document.getElementById('t-absent').innerText = sumA;

    renderTable(filtered);
}

function renderTable(data) {
    const tbody = document.getElementById("tableBody");
    tbody.innerHTML = "";

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 20px; font-weight:bold; color:#777;">لا توجد بيانات مطابقة للبحث أو الفلترة</td></tr>`;
        return;
    }

    data.forEach((item, index) => {
        tbody.innerHTML += `
            <tr>
                <td style="text-align: center;">${index + 1}</td>
                <td><b>${item.name || '-'}</b></td>
                <td>${item.rank || '-'}</td>
                <td>${item.specialty || '-'}</td>
                <td>${item.workplace || '-'}</td>
                <td style="text-align: center;"><span style="background: #f1f5f9; border: 1px solid #cbd5e1; color: #102a43; padding: 2px 8px; border-radius: 6px; font-weight: bold; font-size: 13px;">${item.group || '-'}</span></td>
                <td style="text-align: center;"><span class="badge b-green">${item.present}</span></td>
                <td style="text-align: center;"><span class="badge b-orange">${item.late}</span></td>
                <td style="text-align: center;"><span class="badge b-red">${item.absent}</span></td>
            </tr>
        `;
    });
}
