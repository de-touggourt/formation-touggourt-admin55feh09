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
let trackingData = [];

window.onload = async function() {
    const isLoggedIn = sessionStorage.getItem("isLoggedIn");
    INSPECTOR_CENTER = sessionStorage.getItem("inspectorCenter");

    if (!isLoggedIn || !INSPECTOR_CENTER) {
        window.location.href = "index.html";
        return;
    }

    document.getElementById("centerTitle").innerText = `المركز: ${INSPECTOR_CENTER}`;

    if (firebase.auth) {
        firebase.auth().onAuthStateChanged(async (user) => {
            if (user) {
                await processTrackingData();
            } else {
                window.location.href = "index.html";
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
        let employees = {};
        
        empSnap.forEach(doc => {
            let data = doc.data();
            let key = String(data.id || doc.id).trim();
            employees[key] = { 
                empId: key, 
                name: data.name || '-', 
                rank: data.grade || '-', 
                specialty: data.maty || '-',
                workplace: data.place || data.workplace || '-',
                group: data.group || data.fawj || '-', // استخراج الفوج
                present: 0, 
                late: 0, 
                absent: 0 
            };
        });

        // 2. جلب سجلات الحضور
        let attDocs = [];

        try {
            const startId = `${centerClean}_`;
            const endId = `${centerClean}_\uf8ff`;
            const snapById = await db.collection('attendance_daily')
                .where(firebase.firestore.FieldPath.documentId(), '>=', startId)
                .where(firebase.firestore.FieldPath.documentId(), '<=', endId)
                .get();
            snapById.forEach(d => attDocs.push(d));
        } catch (e) {}

        try {
            const snapByCenter = await db.collection('attendance_daily').where("center", "==", centerClean).get();
            snapByCenter.forEach(d => {
                if (!attDocs.some(x => x.id === d.id)) attDocs.push(d);
            });
        } catch (e) {}

        if (attDocs.length === 0) {
            try {
                const allSnap = await db.collection('attendance_daily').get();
                allSnap.forEach(d => {
                    let dCenter = d.data().center ? String(d.data().center).trim() : "";
                    if (d.id.startsWith(centerClean + "_") || dCenter === centerClean) {
                        if (!attDocs.some(x => x.id === d.id)) attDocs.push(d);
                    }
                });
            } catch (e) {}
        }

        let sumP = 0, sumL = 0, sumA = 0;

        attDocs.forEach(doc => {
            const records = doc.data().records || {};
            if (Object.keys(records).length === 0) return;

            Object.keys(employees).forEach(empKey => {
                const emp = employees[empKey];
                let rec = records[empKey] || records[emp.empId];
                let status = rec ? rec.status : 'غائب';

                if (status === 'حاضر') { 
                    emp.present++; 
                    sumP++; 
                } else if (status === 'متأخر') { 
                    emp.late++; 
                    sumL++; 
                } else if (status === 'غائب' || status === 'غير محدد') { 
                    emp.absent++; 
                    sumA++; 
                }
            });
        });

        trackingData = Object.values(employees);
        
        populateFilters(); // تعبئة الفلاتر بالخيارات المتاحة
        filterTable();     // رسم الجدول مع الفلاتر

    } catch (error) { 
        console.error("Tracking Error:", error); 
        Swal.fire('خطأ', 'فشل في تحميل الإحصائيات: ' + (error.message || ''), 'error'); 
    }
}

// تعبئة القوائم المنسدلة بالفئات المتوفرة
function populateFilters() {
    let ranks = new Set(), specs = new Set(), groups = new Set();
    
    trackingData.forEach(item => {
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

    const filtered = trackingData.filter(item => {
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

// ================= نافذة تفريغ الحضور والغياب =================
async function openClearAttendanceModal() {
    Swal.fire({
        title: 'جاري جلب الأيام المسجلة...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    const centerClean = INSPECTOR_CENTER.trim();
    let recordedDays = new Set();

    try {
        const startId = `${centerClean}_`;
        const endId = `${centerClean}_\uf8ff`;
        const snapById = await db.collection('attendance_daily')
            .where(firebase.firestore.FieldPath.documentId(), '>=', startId)
            .where(firebase.firestore.FieldPath.documentId(), '<=', endId)
            .get();

        snapById.forEach(doc => {
            let parts = doc.id.split('_');
            let dateStr = parts[parts.length - 1];
            if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                recordedDays.add(dateStr);
            }
        });

        const snapByCenter = await db.collection('attendance_daily').where('center', '==', centerClean).get();
        snapByCenter.forEach(doc => {
            let parts = doc.id.split('_');
            let dateStr = parts[parts.length - 1];
            if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                recordedDays.add(dateStr);
            }
        });
    } catch(e) {}

    const daysList = Array.from(recordedDays).sort().reverse();

    let daysOptionsHtml = `<option value="all" style="font-weight:bold; color:#d90429;">⚠️ جميع الأيام المسجلة (حذف كلي شامل للأيام)</option>`;
    
    if (daysList.length > 0) {
        daysOptionsHtml += `<optgroup label="-- اختر يوماً محدداً --">`;
        daysList.forEach(day => {
            daysOptionsHtml += `<option value="${day}">يوم: ${day}</option>`;
        });
        daysOptionsHtml += `</optgroup>`;
    }

    Swal.fire({
        title: '<i class="fa-solid fa-trash-can" style="color:#d90429;"></i> تفريغ سجلات الحضور والغياب',
        html: `
            <div style="text-align:right; font-family:'Cairo'; font-size:14px; padding: 5px;">
                <p style="color:#555; margin-bottom:15px; font-size:13px; line-height:1.6;">
                    اختر اليوم المستهدف ثم حدد الحالة التي تريد تفريغها.
                </p>

                <div style="margin-bottom:15px;">
                    <label style="font-weight:bold; color:#102a43; display:block; margin-bottom:5px;">
                        <i class="fa-regular fa-calendar-days"></i> نطاق الأيام:
                    </label>
                    <select id="swalClearDay" class="swal2-select" style="width:100%; margin:0; font-family:'Cairo'; font-size:14px; padding:8px;">
                        ${daysOptionsHtml}
                    </select>
                </div>

                <div style="margin-bottom:15px;">
                    <label style="font-weight:bold; color:#102a43; display:block; margin-bottom:5px;">
                        <i class="fa-solid fa-filter"></i> الحالة المراد تفريغها:
                    </label>
                    <select id="swalClearStatus" class="swal2-select" style="width:100%; margin:0; font-family:'Cairo'; font-size:14px; padding:8px;">
                        <option value="all">الكل (حذف الأيام وسجلاتها بالكامل نهائياً)</option>
                        <option value="غائب">الغياب فقط (إعادة الغائبين إلى غير محدد)</option>
                        <option value="حاضر">الحضور فقط (إعادة الحاضرين إلى غير محدد)</option>
                        <option value="متأخر">التأخر فقط (إعادة المتأخرين إلى غير محدد)</option>
                    </select>
                </div>

                <div style="background:#fff3cd; border:1px solid #ffeeba; color:#856404; padding:10px; border-radius:8px; font-size:12.5px;">
                    <i class="fa-solid fa-triangle-exclamation"></i> عند اختيار "الكل"، سيتم حذف الأيام بالكامل نهائياً من قاعدة البيانات.
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'تأكيد الحذف',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#d90429',
        cancelButtonColor: '#34495e',
        preConfirm: () => {
            return {
                dayScope: document.getElementById('swalClearDay').value,
                statusType: document.getElementById('swalClearStatus').value
            };
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            const { dayScope, statusType } = result.value;
            await executeAttendanceClear(dayScope, statusType);
        }
    });
}

async function executeAttendanceClear(dayScope, statusType) {
    const centerClean = INSPECTOR_CENTER.trim();

    Swal.fire({
        title: 'جاري الحذف النهائي من قاعدة البيانات...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        let targetDocs = [];

        if (dayScope === "all") {
            const startId = `${centerClean}_`;
            const endId = `${centerClean}_\uf8ff`;
            const snapById = await db.collection('attendance_daily')
                .where(firebase.firestore.FieldPath.documentId(), '>=', startId)
                .where(firebase.firestore.FieldPath.documentId(), '<=', endId)
                .get();
            snapById.forEach(d => targetDocs.push(d));

            const snapByCenter = await db.collection('attendance_daily').where('center', '==', centerClean).get();
            snapByCenter.forEach(d => {
                if (!targetDocs.some(x => x.id === d.id)) targetDocs.push(d);
            });
        } else {
            const docId = `${centerClean}_${dayScope}`;
            const docSnap = await db.collection('attendance_daily').doc(docId).get();
            if (docSnap.exists) targetDocs.push(docSnap);
        }

        if (targetDocs.length === 0) {
            Swal.fire('تنبيه', 'لا توجد أيام مسجلة مطابقة للنطاق المحدد.', 'info');
            return;
        }

        let batch = db.batch();
        let opCount = 0;
        let batches = [];

        targetDocs.forEach(docSnap => {
            if (statusType === "all") {
                batch.delete(docSnap.ref);
                opCount++;
            } else {
                let records = docSnap.data().records || {};
                let modified = false;

                for (let empKey in records) {
                    if (records[empKey] && records[empKey].status === statusType) {
                        delete records[empKey];
                        modified = true;
                    }
                }

                if (modified) {
                    if (Object.keys(records).length === 0) {
                        batch.delete(docSnap.ref);
                    } else {
                        batch.update(docSnap.ref, { records: records });
                    }
                    opCount++;
                }
            }

            if (opCount >= 400) {
                batches.push(batch);
                batch = db.batch();
                opCount = 0;
            }
        });

        if (opCount > 0) batches.push(batch);
        for (let b of batches) await b.commit();

        await processTrackingData();

        Swal.fire({
            icon: 'success',
            title: 'تمت العملية بنجاح',
            text: statusType === "all" ? 'تم حذف الأيام وسجلاتها بالكامل نهائياً من قاعدة البيانات.' : 'تم تفريغ السجلات المحددة بنجاح.',
            confirmButtonColor: '#102a43'
        });

    } catch (error) {
        console.error(error);
        Swal.fire('خطأ', 'حدث مشكل أثناء العملية: ' + error.message, 'error');
    }
}