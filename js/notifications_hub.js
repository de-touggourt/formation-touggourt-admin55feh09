/**
 * =========================================================================
 * منظومة إدارة ونشر الإشعارات والتنبيهات
 * فضاء التكوين البيداغوجي - مديرية التربية لولاية توقرت
 * =========================================================================
 */

// 1. فحص الصلاحيات
if (typeof SecurityGuard !== 'undefined') {
    SecurityGuard.verifySession("INSPECTOR");
}

// 2. إعدادات Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBNBrVpBK8p_WWNwNhSH-mZ6NXOyr2TLhI",
  authDomain: "voyage-touggourt-48755.firebaseapp.com",
  projectId: "voyage-touggourt-48755",
  storageBucket: "voyage-touggourt-48755.firebasestorage.app",
  messagingSenderId: "712694455348",
  appId: "1:712694455348:web:5b4e8df57347edf944fe61",
  measurementId: "G-TTJT4LQ65L"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_eNgM1R-fILJq00iye9-3eeFCFjKBkMcej4VOq53gG5gshOsulAH7b-X0_JkHHrkyJw/exec";

// 3. المتغيرات العامة
let currentEntity = {
    role: 'INSPECTOR',
    name: '',
    center: '',
    id: ''
};
let SITE_SETTINGS = null;
let allNotifications = [];
let selectedImageFile = null;
let selectedTraineeData = null;

window.onload = function() {
    initIdentity();
    loadSiteSettings();
};

function initIdentity() {
    const empId = sessionStorage.getItem("userEmpId");
    const role = sessionStorage.getItem("userRole");
    const inspectorCenter = sessionStorage.getItem("inspectorCenter");
    const userName = sessionStorage.getItem("userName") || "";

    if (empId === "ADMIN_ACCESS" || role === "ADMIN") {
        currentEntity = {
            role: 'ADMIN',
            name: userName || 'مدير النظام',
            center: 'مديرية التربية لولاية توقرت',
            id: 'ADMIN_ACCESS'
        };
        document.getElementById("userEntityName").innerText = "الإدارة المركزية (المديرية)";
        document.getElementById("notifSenderDisplay").value = "مديرية التربية لولاية توقرت";
    } else {
        currentEntity = {
            role: 'INSPECTOR',
            name: userName || 'مشرف المركز',
            center: inspectorCenter || 'مركز التكوين',
            id: empId
        };
        document.getElementById("userEntityName").innerText = `مركز: ${currentEntity.center}`;
        document.getElementById("notifSenderDisplay").value = `مركز: ${currentEntity.center}`;
    }
}

function returnToDashboard() {
    if (currentEntity.role === "ADMIN") {
        window.location.href = "/admin-panel";
    } else {
        window.location.href = "/inspector";
    }
}

// 4. تحميل إعدادات الموقع وبناء خيارات الاستهداف
function loadSiteSettings() {
    db.collection("site_settings").doc("main").onSnapshot((doc) => {
        if (doc.exists) {
            SITE_SETTINGS = doc.data();
        }
        setupAudienceOptions();
        listenToNotifications();
    }, (err) => {
        console.warn("تعذر جلب الإعدادات:", err);
        setupAudienceOptions();
        listenToNotifications();
    });
}

// 4. تحميل إعدادات الموقع وبناء خيارات الاستهداف
let selectedTraineesMap = {}; // تخزين الأساتذة المحددين: { [id]: { id, name, grade, center } }
let cachedTraineesList = [];

function setupAudienceOptions() {
    const sel = document.getElementById("targetAudience");
    if (!sel) return;
    sel.innerHTML = "";

    if (currentEntity.role === "ADMIN") {
        sel.innerHTML = `
            <option value="all_trainees">👥 كافة الأساتذة المتكونين (تعميم ولائي)</option>
            <option value="center_trainees">🏫 متكونو مركز تكوين محدد</option>
            <option value="level_trainees">🎓 متكونو طور تعليمي محدد (ابتدائي / متوسط / ثانوي)</option>
            <option value="specific_trainees">🎯 أستاذ أو مجموعة أساتذة محددين (استدعاء/إشعار مخصص)</option>
            <option value="all_centers">📢 كافة مراكز التكوين (توجيه ولائي للمشرفين)</option>
            <option value="single_center">🏫 مركز تكوين محدد (خاص بالمشرفين)</option>
        `;
    } else {
        sel.innerHTML = `
            <option value="center_trainees">👥 كافة الأساتذة المتكونين بمركزك (${currentEntity.center})</option>
            <option value="level_trainees">🎓 متكونو طور تعليمي محدد بمركزك</option>
            <option value="specific_trainees">🎯 أستاذ أو مجموعة أساتذة محددين بمركزك (استدعاء/إشعار)</option>
        `;
    }

    handleAudienceChange();
}

window.handleAudienceChange = function() {
    const val = document.getElementById("targetAudience").value;
    const group = document.getElementById("extraAudienceGroup");
    const centers = (SITE_SETTINGS && SITE_SETTINGS.UI_NAMES && SITE_SETTINGS.UI_NAMES.centers) ? SITE_SETTINGS.UI_NAMES.centers : {};

    if (val === "center_trainees" || val === "single_center") {
        if (currentEntity.role === "ADMIN") {
            let opts = '';
            for (let cId in centers) {
                opts += `<option value="${centers[cId]}">${centers[cId]}</option>`;
            }
            group.style.display = "flex";
            group.innerHTML = `
                <label>اختر المركز المستهدف:</label>
                <select id="extraTargetCenter" class="form-control">${opts}</select>
            `;
        } else {
            group.style.display = "none";
        }
    } else if (val === "level_trainees") {
        group.style.display = "flex";
        let centerSelectHtml = '';
        if (currentEntity.role === "ADMIN") {
            let cOpts = '<option value="ALL">كافة المراكز</option>';
            for (let cId in centers) {
                cOpts += `<option value="${centers[cId]}">${centers[cId]}</option>`;
            }
            centerSelectHtml = `
                <label style="margin-top:8px;">في المركز:</label>
                <select id="extraTargetCenter" class="form-control">${cOpts}</select>
            `;
        }

        group.innerHTML = `
            <label>اختر الطور المستهدف:</label>
            <select id="extraTargetLevel" class="form-control">
                <option value="primary">الطور الابتدائي</option>
                <option value="middle">الطور المتوسط</option>
                <option value="secondary">الطور الثانوي</option>
            </select>
            ${centerSelectHtml}
        `;
    } else if (val === "specific_trainees" || val === "single_trainee") {
        group.style.display = "flex";
        group.innerHTML = `
            <label>تحديد المتكونين المستهدفين (فردي أو مجموعة):</label>
            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
                <button type="button" class="btn-browse-trainees" onclick="openTraineesSelectorModal()">
                    <i class="fa-solid fa-list-check"></i> تصفح واختيار من قائمة المتكونين
                </button>
                <span id="selectedCountBadge" style="background:#e0f2fe; color:#0369a1; padding:6px 12px; border-radius:10px; font-size:12px; font-weight:800; display:flex; align-items:center;">
                    تم تحديد: ${Object.keys(selectedTraineesMap).length} متكون
                </span>
            </div>
            <div style="display:flex; gap:8px;">
                <input type="text" id="traineeSearchQuery" class="form-control" placeholder="أو أدخل رقم التعريف (16 رقم) أو الاسم للإضافة السريعة..." onkeydown="if(event.key==='Enter') searchTraineeForNotification()">
                <button type="button" class="btn-dispatch" style="margin:0; padding:0 18px; font-size:13px;" onclick="searchTraineeForNotification()">
                    <i class="fa-solid fa-plus"></i> إضافة
                </button>
            </div>
            <div id="selectedTraineesChipsContainer" class="trainee-chips-wrapper" style="${Object.keys(selectedTraineesMap).length > 0 ? 'display:flex;' : 'display:none;'}"></div>
        `;
        renderSelectedTraineesChips();
    } else {
        group.style.display = "none";
        group.innerHTML = "";
    }
};

// 5. نافذة استعراض وتحديد المتكونين (Single & Multi-Select)
window.openTraineesSelectorModal = async function() {
    Swal.fire({
        title: 'جاري تحميل قائمة الأساتذة المتكونين...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        if (cachedTraineesList.length === 0) {
            let snap;
            if (currentEntity.role === "INSPECTOR" && currentEntity.center) {
                snap = await db.collection("employeescomnew").where("center", "==", currentEntity.center).get();
            } else {
                snap = await db.collection("employeescomnew").get();
            }

            cachedTraineesList = [];
            snap.forEach(doc => {
                const d = doc.data();
                cachedTraineesList.push({
                    docId: doc.id,
                    id: d.id || doc.id,
                    name: d.name || 'بدون اسم',
                    grade: d.grade || d.rank || '-',
                    center: d.center || '-',
                    specialty: d.maty || d.specialty || '-'
                });
            });
        }

        renderTraineesSelectorModalUI();
    } catch(err) {
        console.error("خطأ جلب المتكونين:", err);
        Swal.fire('خطأ', 'تعذر جلب قائمة المتكونين من قاعدة البيانات.', 'error');
    }
};

function renderTraineesSelectorModalUI() {
    const modalHtml = `
        <div style="text-align:right; direction:rtl; font-family:'Cairo';">
            <div style="display:flex; gap:10px; margin-bottom:12px; align-items:center;">
                <div style="flex:1; position:relative;">
                    <input type="text" id="modalTraineeSearch" class="form-control" placeholder="بحث بالاسم أو رقم التعريف أو الرتبة..." oninput="filterModalTraineesTable()" style="padding-right:32px;">
                    <i class="fa-solid fa-magnifying-glass" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); color:#94a3b8;"></i>
                </div>
                <button type="button" class="btn-browse-trainees" onclick="toggleSelectAllModalTrainees()" id="btnToggleAll">
                    <i class="fa-solid fa-check-double"></i> تحديد الكل
                </button>
            </div>

            <div style="max-height:380px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:10px;">
                <table style="width:100%; border-collapse:collapse; font-size:13px; text-align:right;">
                    <thead style="background:#f1f5f9; position:sticky; top:0; z-index:2;">
                        <tr>
                            <th style="padding:10px 12px; width:45px; text-align:center;">اختيار</th>
                            <th style="padding:10px 12px;">اسم الأستاذ المتربص</th>
                            <th style="padding:10px 12px;">رقم التعريف</th>
                            <th style="padding:10px 12px;">الرتبة / التخصص</th>
                            <th style="padding:10px 12px;">المركز</th>
                        </tr>
                    </thead>
                    <tbody id="modalTraineesTbody">
                        <!-- تملأ بالأساتذة -->
                    </tbody>
                </table>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:15px; padding-top:10px; border-top:1px solid #e2e8f0;">
                <span id="modalSelectedCounter" style="font-weight:800; color:#0FBA50; font-size:14px;">
                    المحددون حالياً: ${Object.keys(selectedTraineesMap).length} أستاذ
                </span>
                <button type="button" class="btn-dispatch" style="margin:0; padding:8px 24px;" onclick="confirmModalTraineesSelection()">
                    <i class="fa-solid fa-check"></i> اعتماد التحديد
                </button>
            </div>
        </div>
    `;

    Swal.fire({
        title: '<div style="font-family:\'Cairo\'; font-size:18px; font-weight:800;"><i class="fa-solid fa-users" style="color:#0FBA50;"></i> اختيار الأساتذة المتكونين المستهدفين</div>',
        html: modalHtml,
        width: '850px',
        showConfirmButton: false,
        showCloseButton: true,
        didOpen: () => {
            filterModalTraineesTable();
        }
    });
}

window.filterModalTraineesTable = function() {
    const q = (document.getElementById("modalTraineeSearch")?.value || "").trim().toLowerCase();
    const tbody = document.getElementById("modalTraineesTbody");
    if (!tbody) return;

    const filtered = cachedTraineesList.filter(t => {
        if (!q) return true;
        return (t.name || "").toLowerCase().includes(q) ||
               String(t.id || "").includes(q) ||
               (t.grade || "").toLowerCase().includes(q) ||
               (t.center || "").toLowerCase().includes(q) ||
               (t.specialty || "").toLowerCase().includes(q);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:25px; color:#94a3b8;">لا توجد نتائج مطابقة</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(t => {
        const isChecked = !!selectedTraineesMap[t.id];
        return `
            <tr style="border-bottom:1px solid #f1f5f9; background:${isChecked ? '#f0fdf4' : '#fff'};">
                <td style="text-align:center; padding:8px 12px;">
                    <input type="checkbox" style="width:17px; height:17px; cursor:pointer; accent-color:#0FBA50;" ${isChecked ? 'checked' : ''} onchange="toggleTraineeCheck('${t.id}')">
                </td>
                <td style="padding:8px 12px; font-weight:700; color:#1e293b;">${escapeHtml(t.name)}</td>
                <td style="padding:8px 12px; font-family:monospace; color:#64748b; font-weight:700;">${escapeHtml(t.id)}</td>
                <td style="padding:8px 12px; color:#475569;">${escapeHtml(t.grade)} ${t.specialty !== '-' ? '('+escapeHtml(t.specialty)+')' : ''}</td>
                <td style="padding:8px 12px; color:#0369a1; font-weight:600;">${escapeHtml(t.center)}</td>
            </tr>
        `;
    }).join('');
};

window.toggleTraineeCheck = function(id) {
    const trainee = cachedTraineesList.find(t => t.id === id);
    if (!trainee) return;

    if (selectedTraineesMap[id]) {
        delete selectedTraineesMap[id];
    } else {
        selectedTraineesMap[id] = trainee;
    }

    const counter = document.getElementById("modalSelectedCounter");
    if (counter) counter.innerText = `المحددون حالياً: ${Object.keys(selectedTraineesMap).length} أستاذ`;
    filterModalTraineesTable();
};

window.toggleSelectAllModalTrainees = function() {
    const q = (document.getElementById("modalTraineeSearch")?.value || "").trim().toLowerCase();
    const filtered = cachedTraineesList.filter(t => {
        if (!q) return true;
        return (t.name || "").toLowerCase().includes(q) || String(t.id || "").includes(q);
    });

    const allSelected = filtered.every(t => !!selectedTraineesMap[t.id]);

    filtered.forEach(t => {
        if (allSelected) {
            delete selectedTraineesMap[t.id];
        } else {
            selectedTraineesMap[t.id] = t;
        }
    });

    const counter = document.getElementById("modalSelectedCounter");
    if (counter) counter.innerText = `المحددون حالياً: ${Object.keys(selectedTraineesMap).length} أستاذ`;
    filterModalTraineesTable();
};

window.confirmModalTraineesSelection = function() {
    Swal.close();
    renderSelectedTraineesChips();
    const countBadge = document.getElementById("selectedCountBadge");
    if (countBadge) countBadge.innerText = `تم تحديد: ${Object.keys(selectedTraineesMap).length} متكون`;
};

window.renderSelectedTraineesChips = function() {
    const container = document.getElementById("selectedTraineesChipsContainer");
    if (!container) return;

    const list = Object.values(selectedTraineesMap);
    if (list.length === 0) {
        container.style.display = "none";
        container.innerHTML = "";
        return;
    }

    container.style.display = "flex";
    container.innerHTML = list.map(t => `
        <div class="trainee-chip-item">
            <span><i class="fa-solid fa-user-check"></i> ${escapeHtml(t.name)} (${t.id})</span>
            <button type="button" class="trainee-chip-remove" onclick="removeSelectedTraineeChip('${t.id}')" title="إزالة">
                <i class="fa-solid fa-circle-xmark"></i>
            </button>
        </div>
    `).join('');
};

window.removeSelectedTraineeChip = function(id) {
    delete selectedTraineesMap[id];
    renderSelectedTraineesChips();
    const countBadge = document.getElementById("selectedCountBadge");
    if (countBadge) countBadge.innerText = `تم تحديد: ${Object.keys(selectedTraineesMap).length} متكون`;
};

// البحث السريع وإضافة أستاذ فردي
window.searchTraineeForNotification = async function() {
    const q = (document.getElementById("traineeSearchQuery")?.value || "").trim();
    if (!q) return;

    try {
        let foundTrainee = null;
        const docSnap = await db.collection("employeescomnew").doc(q).get();
        if (docSnap.exists) {
            foundTrainee = { docId: docSnap.id, ...docSnap.data() };
        } else {
            let querySnap = await db.collection("employeescomnew").where("id", "==", q).get();
            if (querySnap.empty) {
                querySnap = await db.collection("employeescomnew").where("name", "==", q).get();
            }
            if (!querySnap.empty) {
                foundTrainee = { docId: querySnap.docs[0].id, ...querySnap.docs[0].data() };
            }
        }

        if (!foundTrainee) {
            return Swal.fire('غير موجود', 'لم يتم العثور على أي أستاذ بهذا المعرف أو الاسم.', 'warning');
        }

        if (currentEntity.role === "INSPECTOR" && foundTrainee.center !== currentEntity.center) {
            return Swal.fire('صلاحية مقيدة', `هذا الأستاذ مسجل بمركز آخر (${foundTrainee.center}). بصفتك مشرفاً، يمكنك إشعار أساتذة مركزك فقط.`, 'error');
        }

        const tId = foundTrainee.id || foundTrainee.docId;
        selectedTraineesMap[tId] = {
            docId: foundTrainee.docId,
            id: tId,
            name: foundTrainee.name || 'أستاذ',
            grade: foundTrainee.grade || foundTrainee.rank || '-',
            center: foundTrainee.center || '-'
        };

        renderSelectedTraineesChips();
        const countBadge = document.getElementById("selectedCountBadge");
        if (countBadge) countBadge.innerText = `تم تحديد: ${Object.keys(selectedTraineesMap).length} متكون`;
        document.getElementById("traineeSearchQuery").value = "";

        Swal.fire({
            icon: 'success',
            title: 'تمت الإضافة بنجاح',
            text: `تمت إضافة الأستاذ ${foundTrainee.name} إلى قائمة المستهدفين للإشعار.`,
            timer: 1500,
            showConfirmButton: false
        });

    } catch (err) {
        console.error("خطأ البحث عن المتكون:", err);
        Swal.fire('خطأ', 'حدث خطأ أثناء البحث في قاعدة البيانات.', 'error');
    }
};

// 6. اختيار ومعاينة الصورة
window.handleImageSelect = function(files) {
    if (!files || files.length === 0) return;
    const file = files[0];
    selectedImageFile = file;

    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById("imagePreview").src = e.target.result;
        document.getElementById("imagePreviewContainer").style.display = "block";
    };
    reader.readAsDataURL(file);
};

window.removeSelectedImage = function() {
    selectedImageFile = null;
    document.getElementById("imagePreview").src = "";
    document.getElementById("imagePreviewContainer").style.display = "none";
    document.getElementById("notifImageInput").value = "";
};

// 7. نشر الإشعار وحفظه في Firestore
window.submitNotification = async function() {
    const audience = document.getElementById("targetAudience").value;
    const priority = document.getElementById("notifPriority").value || "normal";
    const title = (document.getElementById("notifTitle")?.value || "").trim();
    const content = (document.getElementById("notifContent")?.value || "").trim();

    if (!title) {
        return Swal.fire('تنبيه', 'يرجى كتابة عنوان الإشعار.', 'warning');
    }
    if (!content) {
        return Swal.fire('تنبيه', 'يرجى كتابة نص الإشعار وتفاصيله.', 'warning');
    }

    let targetCenter = "";
    let targetLevel = "";
    let targetTraineeId = "";
    let targetTraineeName = "";
    let targetTraineeIds = [];
    let targetTraineeNames = [];

    if (audience === "center_trainees" || audience === "single_center") {
        targetCenter = currentEntity.role === "ADMIN" ? (document.getElementById("extraTargetCenter")?.value || "") : currentEntity.center;
    } else if (audience === "level_trainees") {
        targetLevel = document.getElementById("extraTargetLevel")?.value || "primary";
        targetCenter = currentEntity.role === "ADMIN" ? (document.getElementById("extraTargetCenter")?.value || "ALL") : currentEntity.center;
    } else if (audience === "specific_trainees" || audience === "single_trainee") {
        const traineesList = Object.values(selectedTraineesMap);
        if (traineesList.length === 0) {
            return Swal.fire('تنبيه', 'يرجى تحديد أستاذ واحد على الأقل من القائمة أو عبر البحث.', 'warning');
        }
        targetTraineeIds = traineesList.map(t => String(t.id || t.docId || ''));
        targetTraineeNames = traineesList.map(t => String(t.name || ''));
        targetTraineeId = targetTraineeIds[0] || '';
        targetTraineeName = targetTraineeNames[0] || '';
        targetCenter = traineesList[0].center || '';
    }

    const btn = document.getElementById("btnDispatchNotif");
    btn.disabled = true;

    Swal.fire({
        title: 'جاري نشر الإشعار...',
        html: `
            <div style="text-align:center; padding:15px;">
                <div class="spinner" style="margin:0 auto 15px auto;"></div>
                <p id="notifStatusTxt" style="color:#0FBA50; font-weight:bold; font-size:14px; margin:0;">
                    ${selectedImageFile ? 'جاري رفع الصورة المرفقة إلى Google Drive...' : 'جاري تسجيل وتعميم الإشعار...'}
                </p>
            </div>
        `,
        allowOutsideClick: false,
        showConfirmButton: false
    });

    try {
        let uploadedImageUrl = "";
        let uploadedImageFileId = "";

        // رفع الصورة المرفقة إلى Google Drive
        if (selectedImageFile) {
            try {
                const base64 = await readFileAsBase64(selectedImageFile);
                const targetFolderId = (SITE_SETTINGS && SITE_SETTINGS.DRIVE_SETTINGS && SITE_SETTINGS.DRIVE_SETTINGS.rootFolderId) ? SITE_SETTINGS.DRIVE_SETTINGS.rootFolderId : "13USbQnFLbCiI-fxvDc1pNjg0EEDSZ90t";
                const fileName = `notif_${Date.now()}_${selectedImageFile.name}`;

                const formData = new FormData();
                formData.append('action', 'upload');
                formData.append('name', fileName);
                formData.append('mime', selectedImageFile.type || 'image/jpeg');
                formData.append('data', base64);
                formData.append('folderId', targetFolderId);

                const res = await fetch(APPS_SCRIPT_URL, { method: 'POST', body: formData });
                const d = await res.json();

                let genuineImgId = d.id || '';
                let genuineImgUrl = d.url || '';

                // إذا لم يرجع السكربت الـ id مباشرة، نقوم بالاستعلام عن الملفات في المجلد
                if (!genuineImgId) {
                    try {
                        const listRes = await fetch(`${APPS_SCRIPT_URL}?action=list&folderId=${targetFolderId}`);
                        const listData = await listRes.json();
                        const filesList = Array.isArray(listData) ? listData : (Array.isArray(listData?.files) ? listData.files : []);
                        if (filesList.length > 0) {
                            const matched = filesList.find(f => f.name === fileName) || filesList[0];
                            if (matched && matched.id) {
                                genuineImgId = matched.id;
                                genuineImgUrl = matched.url || `https://drive.google.com/file/d/${matched.id}/view?usp=drivesdk`;
                            }
                        }
                    } catch(listErr) {
                        console.warn("تعذر جلب معرّف الصورة من درايف:", listErr);
                    }
                }

                if (genuineImgId) {
                    uploadedImageFileId = genuineImgId;
                    uploadedImageUrl = `https://drive.google.com/thumbnail?id=${genuineImgId}&sz=w1200`;
                } else if (genuineImgUrl) {
                    uploadedImageUrl = genuineImgUrl;
                }
            } catch(imgErr) {
                console.warn("تعذر رفع الصورة لدرايف، سيتم النشر بدونها:", imgErr);
            }
        }

        // بناء كائن الإشعار بطريقة آمنة تماماً بدون أي undefined
        const notificationDoc = {
            title: String(title),
            content: String(content),
            imageUrl: String(uploadedImageUrl || ""),
            imageFileId: String(uploadedImageFileId || ""),
            priority: String(priority || "normal"),
            targetAudience: String(audience || "all_trainees"),
            targetCenter: String(targetCenter || ""),
            targetLevel: String(targetLevel || ""),
            targetTraineeId: String(targetTraineeId || ""),
            targetTraineeName: String(targetTraineeName || ""),
            targetTraineeIds: targetTraineeIds || [],
            targetTraineeNames: targetTraineeNames || [],
            senderRole: String(currentEntity.role || "INSPECTOR"),
            senderName: String(currentEntity.name || ""),
            senderCenter: String(currentEntity.center || ""),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdAtFormatted: new Date().toLocaleString('ar-DZ', { dateStyle: 'medium', timeStyle: 'short' }),
            readBy: []
        };

        await db.collection("notifications").add(notificationDoc);

        Swal.fire({
            icon: 'success',
            title: 'تم نشر الإشعار بنجاح!',
            text: 'تم تعميم وتوجيه الإشعار للفئة المحددة فورياً.',
            confirmButtonColor: '#0FBA50'
        });

        // تصفير الحقول
        document.getElementById("notifTitle").value = "";
        document.getElementById("notifContent").value = "";
        selectedTraineesMap = {};
        removeSelectedImage();
        handleAudienceChange();

    } catch (e) {
        console.error("خطأ نشر الإشعار:", e);
        Swal.fire('خطأ في النشر', `تعذر حفظ الإشعار: ${e.message || e}`, 'error');
    } finally {
        btn.disabled = false;
    }
};

// 8. الاستماع اللحظي لسجل الإشعارات
function listenToNotifications() {
    const loader = document.getElementById("loader");

    db.collection("notifications").orderBy("createdAt", "desc").onSnapshot((snapshot) => {
        if (loader) loader.style.display = "none";

        allNotifications = [];
        snapshot.forEach((doc) => {
            allNotifications.push({ id: doc.id, ...doc.data() });
        });

        filterNotificationsFeed();
    }, (err) => {
        if (loader) loader.style.display = "none";
        console.error("خطأ قراءة الإشعارات:", err);
    });
}

// تصفية وبحث الإشعارات المنشورة في لوحة التحكم
window.filterNotificationsFeed = function() {
    const q = (document.getElementById("feedFilterSearch")?.value || "").trim().toLowerCase();
    const aud = document.getElementById("feedFilterAudience")?.value || "ALL";
    const dateVal = document.getElementById("feedFilterDate")?.value || "";
    const btnClearDate = document.getElementById("btnClearFeedDate");
    
    if (btnClearDate) {
        btnClearDate.style.display = dateVal ? "inline-flex" : "none";
    }

    let list = allNotifications;

    // قيود مشرف المركز
    if (currentEntity.role === "INSPECTOR") {
        list = list.filter(n => 
            n.senderCenter === currentEntity.center ||
            n.targetCenter === currentEntity.center ||
            n.targetAudience === "all_centers"
        );
    }

    // فلترة البحث النصي
    if (q) {
        list = list.filter(n => {
            const title = (n.title || "").toLowerCase();
            const content = (n.content || "").toLowerCase();
            const sender = (n.senderCenter || n.senderName || "").toLowerCase();
            const center = (n.targetCenter || "").toLowerCase();
            const trainee = (n.targetTraineeName || n.targetTraineeId || "").toLowerCase();
            return title.includes(q) || content.includes(q) || sender.includes(q) || center.includes(q) || trainee.includes(q);
        });
    }

    // فلترة الفئة المستهدفة
    if (aud !== "ALL") {
        if (aud === "centers") {
            list = list.filter(n => n.targetAudience === "all_centers" || n.targetAudience === "single_center");
        } else if (aud === "specific_trainees") {
            list = list.filter(n => n.targetAudience === "specific_trainees" || n.targetAudience === "single_trainee");
        } else if (aud === "urgent") {
            list = list.filter(n => n.priority === "urgent" || n.priority === "summon");
        } else {
            list = list.filter(n => n.targetAudience === aud);
        }
    }

    // فلترة بالتاريخ المحدد
    if (dateVal) {
        list = list.filter(n => {
            if (n.createdAt && typeof n.createdAt.toDate === 'function') {
                const d = n.createdAt.toDate();
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}` === dateVal;
            } else if (n.createdAtFormatted) {
                return n.createdAtFormatted.includes(dateVal);
            }
            return false;
        });
    }

    renderNotificationsFeed(list);
};

window.clearFeedDateFilter = function() {
    const dInput = document.getElementById("feedFilterDate");
    if (dInput) dInput.value = "";
    filterNotificationsFeed();
};

function renderNotificationsFeed(list) {
    const container = document.getElementById("notificationsFeed");
    const countBadge = document.getElementById("historyCountBadge");
    if (!container) return;

    if (countBadge) countBadge.innerText = `${list.length} إشعار`;

    if (list.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:40px 15px; color:#94a3b8;">
                <i class="fa-regular fa-bell-slash" style="font-size:35px; margin-bottom:10px;"></i>
                <p style="font-size:14px; font-weight:700; margin:0;">لا توجد أي إشعارات مطابقة لمعايير البحث.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = list.map(n => {
        let audBadge = '<span class="badge-aud">الجميع</span>';
        if (n.targetAudience === "all_trainees") audBadge = '<span class="badge-aud"><i class="fa-solid fa-users"></i> كافة المتكونين</span>';
        else if (n.targetAudience === "center_trainees") audBadge = `<span class="badge-aud"><i class="fa-solid fa-school"></i> ${n.targetCenter || 'مركز محدد'}</span>`;
        else if (n.targetAudience === "level_trainees") audBadge = `<span class="badge-aud"><i class="fa-solid fa-layer-group"></i> طور: ${n.targetLevel}</span>`;
        else if (n.targetAudience === "single_trainee" || n.targetAudience === "specific_trainees") {
            const count = (n.targetTraineeIds && n.targetTraineeIds.length) ? n.targetTraineeIds.length : 1;
            const label = count > 1 ? `مخصص (${count} أساتذة)` : `فردي: ${n.targetTraineeName || n.targetTraineeId}`;
            audBadge = `<span class="badge-aud" style="background:#fef3c7; color:#b45309;"><i class="fa-solid fa-user-tag"></i> ${label}</span>`;
        }
        else if (n.targetAudience === "all_centers") audBadge = '<span class="badge-aud" style="background:#e0f2fe; color:#0284c7;"><i class="fa-solid fa-bullhorn"></i> كافة المراكز</span>';
        else if (n.targetAudience === "single_center") audBadge = `<span class="badge-aud"><i class="fa-solid fa-school"></i> مركز: ${n.targetCenter}</span>`;

        let prioBadge = '<span class="badge-prio prio-normal">عادي</span>';
        if (n.priority === 'urgent') prioBadge = '<span class="badge-prio prio-urgent"><i class="fa-solid fa-triangle-exclamation"></i> عاجل</span>';
        else if (n.priority === 'summon') prioBadge = '<span class="badge-prio prio-summon"><i class="fa-solid fa-envelope-open-text"></i> استدعاء رسمي</span>';

        const hasImg = n.imageUrl && n.imageUrl.trim() !== '';
        let fId = n.imageFileId || '';
        if (!fId && hasImg) {
            if (n.imageUrl.includes('id=')) fId = n.imageUrl.split('id=')[1].split('&')[0];
            else if (n.imageUrl.includes('/d/')) fId = n.imageUrl.split('/d/')[1].split(/[=/]/)[0];
        }

        const thumbSrc = fId ? `https://drive.google.com/thumbnail?id=${fId}&sz=w300` : (n.imageUrl || '');
        const fallbackSrc = fId ? `https://lh3.googleusercontent.com/d/${fId}=s400` : '';

        const imgThumb = hasImg ? `
            <div class="feed-img-thumb" onclick="previewImageZoom('${n.imageUrl}', '${fId}')" title="تكبير الصورة">
                <img src="${thumbSrc}" alt="الصورة المرفقة" referrerpolicy="no-referrer" onerror="if(!this.dataset.retried && '${fallbackSrc}'){this.dataset.retried=1; this.src='${fallbackSrc}';}">
            </div>
        ` : `
            <div class="feed-img-thumb" style="cursor:default;">
                <i class="fa-solid fa-bell"></i>
            </div>
        `;

        const canDelete = currentEntity.role === "ADMIN" || n.senderCenter === currentEntity.center;

        return `
            <div class="feed-item">
                ${imgThumb}
                <div class="feed-body">
                    <div class="feed-top">
                        <div class="feed-title">${escapeHtml(n.title || 'إشعار')}</div>
                        <div class="feed-badges">
                            ${prioBadge}
                            ${audBadge}
                        </div>
                    </div>
                    <div class="feed-text">${escapeHtml(n.content || '')}</div>
                    <div class="feed-footer">
                        <span><i class="fa-solid fa-building-flag"></i> ${escapeHtml(n.senderCenter || n.senderName || 'المديرية')} | ${n.createdAtFormatted || 'الآن'}</span>
                        <div class="feed-actions">
                            <button class="btn-feed-action" onclick="previewNotificationItem('${n.id}')">
                                <i class="fa-solid fa-eye"></i> معاينة
                            </button>
                            ${canDelete ? `
                                <button class="btn-feed-action btn-feed-delete" onclick="deleteNotificationItem('${n.id}')">
                                    <i class="fa-solid fa-trash-can"></i> حذف
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// 9. معاينة وتكبير الصورة
window.previewImageZoom = function(url, fileId) {
    if (!url && !fileId) return;
    let fId = fileId || '';
    if (!fId && url) {
        if (url.includes('id=')) fId = url.split('id=')[1].split('&')[0];
        else if (url.includes('/d/')) fId = url.split('/d/')[1].split(/[=/]/)[0];
    }
    const zoomSrc = fId ? `https://drive.google.com/thumbnail?id=${fId}&sz=w1600` : url;
    const fbSrc = fId ? `https://lh3.googleusercontent.com/d/${fId}=s1600` : '';

    Swal.fire({
        html: `
            <div style="text-align:center; padding:5px;">
                <img src="${zoomSrc}" alt="معاينة بالحجم الكامل" referrerpolicy="no-referrer" onerror="if(!this.dataset.retried && '${fbSrc}'){this.dataset.retried=1; this.src='${fbSrc}';}" style="max-width:100%; max-height:80vh; border-radius:12px; box-shadow:0 8px 30px rgba(0,0,0,0.15); object-fit:contain;">
            </div>
        `,
        showConfirmButton: true,
        confirmButtonText: 'إغلاق',
        confirmButtonColor: '#102a43',
        width: 'auto',
        scrollbarPadding: false
    });
};

window.previewNotificationItem = function(id) {
    const notif = allNotifications.find(n => n.id === id);
    if (!notif) return;

    // تسجيل القراءة في النظام
    const readerTag = currentEntity.role === "ADMIN" ? "المديرية" : currentEntity.center;
    if (readerTag) {
        db.collection("notifications").doc(id).update({
            readBy: firebase.firestore.FieldValue.arrayUnion(readerTag, currentEntity.name || '')
        }).catch(() => {});
    }

    let imageHtml = '';
    if (notif.imageUrl && notif.imageUrl.trim() !== '') {
        let fId = notif.imageFileId || '';
        if (!fId) {
            if (notif.imageUrl.includes('id=')) fId = notif.imageUrl.split('id=')[1].split('&')[0];
            else if (notif.imageUrl.includes('/d/')) fId = notif.imageUrl.split('/d/')[1].split(/[=/]/)[0];
        }
        const fullSrc = fId ? `https://drive.google.com/thumbnail?id=${fId}&sz=w1200` : notif.imageUrl;
        const fbSrc = fId ? `https://lh3.googleusercontent.com/d/${fId}=s1200` : '';
        imageHtml = `
            <div style="margin:15px 0; text-align:center;">
                <img src="${fullSrc}" alt="الصورة المرفقة" referrerpolicy="no-referrer" onerror="if(!this.dataset.retried && '${fbSrc}'){this.dataset.retried=1; this.src='${fbSrc}';}" style="max-width:100%; max-height:350px; border-radius:12px; border:1px solid #e2e8f0; cursor:pointer;" onclick="previewImageZoom('${fullSrc}', '${fId}')">
                <div style="font-size:11px; color:#64748b; margin-top:4px;"><i class="fa-solid fa-magnifying-glass-plus"></i> انقر لتكبير الصورة</div>
            </div>
        `;
    }

    Swal.fire({
        title: `<div style="font-family:'Cairo'; font-size:18px; font-weight:800; color:#102a43;">${notif.title || 'تفاصيل الإشعار'}</div>`,
        html: `
            <div style="text-align:right; direction:rtl; font-family:'Cairo'; padding:5px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:12px; color:#64748b; background:#f8fafc; padding:8px 12px; border-radius:10px; border:1px solid #e2e8f0;">
                    <span>المرسل: <b>${notif.senderCenter || notif.senderName}</b></span>
                    <span>التاريخ: ${notif.createdAtFormatted || 'الآن'}</span>
                </div>
                <div style="font-size:14px; line-height:1.8; color:#334155; white-space:pre-wrap; background:#fff; padding:15px; border-radius:10px; border:1px solid #cbd5e1;">
${notif.content || ''}
                </div>
                ${imageHtml}
            </div>
        `,
        showConfirmButton: true,
        confirmButtonText: 'إغلاق',
        confirmButtonColor: '#102a43',
    });
};

window.deleteNotificationItem = function(id) {
    Swal.fire({
        title: 'تأكيد الحذف',
        text: 'هل أنت متأكد من رغبتك في حذف هذا الإشعار نهائياً من النظام؟',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'نعم، احذفه',
        cancelButtonText: 'تراجع',
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#64748b'
    }).then(async (res) => {
        if (res.isConfirmed) {
            try {
                await db.collection("notifications").doc(id).delete();
                Swal.fire('تم!', 'تم حذف الإشعار بنجاح.', 'success');
            } catch(e) {
                console.error("فشل حذف الإشعار:", e);
                Swal.fire('خطأ', 'تعذر حذف الإشعار.', 'error');
            }
        }
    });
};

function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function escapeHtml(text) {
    if (!text) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
