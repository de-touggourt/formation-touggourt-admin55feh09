// التحقق الأمني من جلسة الأستاذ المؤطر
const userEmpId = sessionStorage.getItem("userEmpId");
const isLoggedIn = sessionStorage.getItem("isLoggedIn");
const userRole = (sessionStorage.getItem("userRole") || "").toUpperCase();

if (!isLoggedIn || !userEmpId || (userRole !== "SUPERVISOR" && userRole !== "ADMIN")) {
    window.location.href = (window.location.protocol === "file:") ? "index.html" : "/login";
}

// إعدادات Firebase
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

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_eNgM1R-fILJq00iye9-3eeFCFjKBkMcej4VOq53gG5gshOsulAH7b-X0_JkHHrkyJw/exec";
const DEFAULT_MODULES = [
    "تعليمية المادة", 
    "التشريع المدرسي", 
    "علم النفس التربوي", 
    "هندسة التكوين", 
    "تكنولوجيا الإعلام والاتصال", 
    "التقويم والمعالجة البيداغوجية", 
    "الشفافية والوقاية من الفساد", 
    "النظام التربوي الجزائري"
];

let SITE_SETTINGS = null;
let supervisorAccounts = [];
let currentActiveCenterDoc = null;
let currentFolderId = null;

// تشغيل النظام عند تحميل الصفحة
window.onload = async function() {
    const loader = document.getElementById("loader");
    if (loader) loader.style.display = "flex";

    try {
        // 1. جلب إعدادات الموقع اللحظية من Firestore
        db.collection("site_settings").doc("main").onSnapshot((docSnap) => {
            if (docSnap.exists) {
                SITE_SETTINGS = docSnap.data();
                if (currentActiveCenterDoc) {
                    renderModulesGrid();
                }
            }
        });

        // 2. جلب حسابات الأستاذ المؤطر المعتمدة من supervisor_accounts
        const accountsSnap = await db.collection("supervisor_accounts")
            .where("empId", "==", String(userEmpId))
            .get();

        if (accountsSnap.empty) {
            Swal.fire({
                icon: 'error',
                title: 'لا يوجد حساب معتمد',
                text: 'عذراً أستاذنا الفاضل، لم يتم العثور على حساب مؤطر معتمد لهذا الرقم الوظيفي.',
                confirmButtonText: 'العودة لصفحة الدخول'
            }).then(() => {
                logoutSupervisor();
            });
            return;
        }

        let activeList = [];
        accountsSnap.forEach(doc => {
            const data = doc.data();
            if (data.status === "active") {
                activeList.push({ docId: doc.id, ...data });
            }
        });

        if (activeList.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'الحساب معطل',
                text: 'تم تعليق أو تعطيل حسابك في هذا الفضاء من طرف إدارة المركز. يرجى مراجعة إدارة المركز.',
                confirmButtonText: 'حسناً'
            }).then(() => {
                logoutSupervisor();
            });
            return;
        }

        supervisorAccounts = activeList;

        // تعيين الملف الشخصي للأستاذ
        setupProfileHeader(activeList[0]);

        // رسم مراكز التكليف
        renderCentersGrid();

        // اختيار أول مركز تلقائياً
        selectCenter(activeList[0].docId);

        if (loader) loader.style.display = "none";

    } catch (err) {
        console.error("خطأ أثناء تحميل فضاء المؤطر:", err);
        if (loader) loader.style.display = "none";
        Swal.fire("خطأ", "تعذر الاتصال بقاعدة البيانات، يرجى المحاولة لاحقاً.", "error");
    }
};

function setupProfileHeader(supData) {
    document.getElementById("supName").innerText = supData.name || "أستاذ مؤطر";
    document.getElementById("supEmpId").innerText = supData.empId || userEmpId;
    document.getElementById("supRank").innerText = supData.rank || "أستاذ مؤطر";
    document.getElementById("supWorkplace").innerText = supData.workplace || "مديرية التربية لولاية توقرت";

    // جلب الصورة الشخصية إن وجدت
    if (supData.photoUrl) {
        const img = document.getElementById("supAvatar");
        img.src = supData.photoUrl;
        img.style.display = "block";
        document.getElementById("supPlaceholder").style.display = "none";
    }
}

function renderCentersGrid() {
    const container = document.getElementById("centersContainer");
    if (!container) return;

    let html = "";
    supervisorAccounts.forEach(acc => {
        html += `
            <div class="center-card" id="card_${acc.docId}" onclick="selectCenter('${acc.docId}')">
                <div class="center-icon">
                    <i class="fa-solid fa-school-flag"></i>
                </div>
                <div class="center-info">
                    <div class="center-name">${acc.center}</div>
                    <div class="center-status">
                        <i class="fa-solid fa-circle-check"></i> تكليف معتمد ونشط
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

window.selectCenter = function(docId) {
    const found = supervisorAccounts.find(x => x.docId === docId);
    if (!found) return;

    currentActiveCenterDoc = found;

    // تمييز البطاقة النشطة
    document.querySelectorAll(".center-card").forEach(el => el.classList.remove("active"));
    const activeCard = document.getElementById(`card_${docId}`);
    if (activeCard) activeCard.classList.add("active");

    // تحديث بيانات التكليف بالمركز
    document.getElementById("detCenterName").innerText = found.center;
    
    const specsStr = (found.specs && found.specs.length > 0) ? found.specs.join("، ") : "جميع التخصصات المعتمدة";
    document.getElementById("detSpecs").innerText = specsStr;

    const ranksStr = (found.supervisedRanks && found.supervisedRanks.length > 0) ? found.supervisedRanks.join("، ") : (found.rank || "غير محدد");
    document.getElementById("detRanks").innerText = ranksStr;

    const groupsStr = (found.groups && found.groups.length > 0) ? found.groups.map(g => g.includes("::") ? g.split("::")[1] : g).join("، ") : "كل الأفواج";
    document.getElementById("detGroups").innerText = groupsStr;

    // رسم المقاييس المتاحة للرفع
    renderModulesGrid();
};

function isCycleOpen(module, cycle) {
    if (!SITE_SETTINGS) return false;
    const isGlobalOpen = SITE_SETTINGS.GLOBAL_CYCLE_STATUS 
        ? ((typeof SITE_SETTINGS.GLOBAL_CYCLE_STATUS[cycle] !== 'undefined') ? SITE_SETTINGS.GLOBAL_CYCLE_STATUS[cycle] : SITE_SETTINGS.GLOBAL_CYCLE_STATUS[String(cycle)])
        : true;
    if (isGlobalOpen === false) return false;

    if (SITE_SETTINGS.MODULE_CYCLE_STATUS && SITE_SETTINGS.MODULE_CYCLE_STATUS[module]) {
        const mStatus = (typeof SITE_SETTINGS.MODULE_CYCLE_STATUS[module][cycle] !== 'undefined')
            ? SITE_SETTINGS.MODULE_CYCLE_STATUS[module][cycle]
            : SITE_SETTINGS.MODULE_CYCLE_STATUS[module][String(cycle)];
        if (typeof mStatus !== 'undefined') {
            return !!mStatus;
        }
    }
    return !!isGlobalOpen;
}

function renderModulesGrid() {
    const container = document.getElementById("modulesContainer");
    if (!container || !currentActiveCenterDoc) return;

    // المقاييس المسندة للأستاذ
    let assignedModules = currentActiveCenterDoc.modules || [];
    if (assignedModules.length === 0) {
        assignedModules = DEFAULT_MODULES;
    }

    let html = "";
    assignedModules.forEach(mod => {
        const c1Open = isCycleOpen(mod, 1);
        const c2Open = isCycleOpen(mod, 2);
        const c3Open = isCycleOpen(mod, 3);

        html += `
            <div class="module-card">
                <div>
                    <div class="module-header">
                        <div class="module-icon">
                            <i class="fa-solid fa-book-open-reader"></i>
                        </div>
                        <h3 class="module-title">${mod}</h3>
                    </div>

                    <div class="cycles-list">
                        <div class="cycle-row-btn ${c1Open ? '' : 'closed'}" onclick="${c1Open ? `openSupervisorFileManager('${mod}', 1)` : ''}">
                            <span><i class="fa-solid fa-calendar-day" style="margin-left:6px;"></i> الدورة التكوينية الأولى</span>
                            <span class="cycle-status-pill ${c1Open ? 'pill-open' : 'pill-closed'}">${c1Open ? 'مفتوحة للرفع' : 'مغلقة'}</span>
                        </div>

                        <div class="cycle-row-btn ${c2Open ? '' : 'closed'}" onclick="${c2Open ? `openSupervisorFileManager('${mod}', 2)` : ''}">
                            <span><i class="fa-solid fa-calendar-day" style="margin-left:6px;"></i> الدورة التكوينية الثانية</span>
                            <span class="cycle-status-pill ${c2Open ? 'pill-open' : 'pill-closed'}">${c2Open ? 'مفتوحة للرفع' : 'مغلقة'}</span>
                        </div>

                        <div class="cycle-row-btn ${c3Open ? '' : 'closed'}" onclick="${c3Open ? `openSupervisorFileManager('${mod}', 3)` : ''}">
                            <span><i class="fa-solid fa-calendar-day" style="margin-left:6px;"></i> الدورة التكوينية الثالثة</span>
                            <span class="cycle-status-pill ${c3Open ? 'pill-open' : 'pill-closed'}">${c3Open ? 'مفتوحة للرفع' : 'مغلقة'}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// دالة مساعدة لتحديد معرف مجلد جوجل درايف بدقة
function resolveDriveFolder(module, cycle) {
    if (!SITE_SETTINGS || !SITE_SETTINGS.dbLinks || !currentActiveCenterDoc) return null;

    const centerName = currentActiveCenterDoc.center;
    let cId = null;

    // 1. البحث عن مفتاح المركز
    if (SITE_SETTINGS.UI_NAMES && SITE_SETTINGS.UI_NAMES.centers) {
        for (let k in SITE_SETTINGS.UI_NAMES.centers) {
            if (SITE_SETTINGS.UI_NAMES.centers[k] === centerName) {
                cId = k;
                break;
            }
        }
    }
    if (!cId && SITE_SETTINGS.dbLinks[centerName]) cId = centerName;
    if (!cId) {
        // افتراض أول مركز متاح
        cId = Object.keys(SITE_SETTINGS.dbLinks)[0];
    }

    if (!cId || !SITE_SETTINGS.dbLinks[cId]) return null;

    // 2. البحث عن الطور / الرتبة
    let lvl = 'middle';
    const ranks = currentActiveCenterDoc.supervisedRanks || [currentActiveCenterDoc.rank || ''];
    const rankStr = ranks.join(' ');
    if (rankStr.includes('ثانوي')) lvl = 'secondary';
    else if (rankStr.includes('ابتدائي')) lvl = 'primary';
    else if (rankStr.includes('متوسط')) lvl = 'middle';
    else {
        // أول طور متاح في هذا المركز
        lvl = Object.keys(SITE_SETTINGS.dbLinks[cId])[0] || 'middle';
    }

    if (!SITE_SETTINGS.dbLinks[cId][lvl]) {
        lvl = Object.keys(SITE_SETTINGS.dbLinks[cId])[0];
    }

    if (!SITE_SETTINGS.dbLinks[cId] || !SITE_SETTINGS.dbLinks[cId][lvl]) return null;

    // 3. البحث عن التخصص
    let spc = 'others';
    const specs = currentActiveCenterDoc.specs || [];
    const specStr = specs.join(' ');
    if (specStr.includes('عرب')) spc = 'arabic';
    else if (specStr.includes('فرنس')) spc = 'french';
    else if (specStr.includes('إنجليز') || specStr.includes('انجليز')) spc = 'english';
    else if (specStr.includes('رياض') || specStr.includes('بدني')) spc = 'sport';
    else {
        spc = Object.keys(SITE_SETTINGS.dbLinks[cId][lvl])[0] || 'others';
    }

    if (!SITE_SETTINGS.dbLinks[cId][lvl][spc]) {
        spc = Object.keys(SITE_SETTINGS.dbLinks[cId][lvl])[0];
    }

    const linksObj = SITE_SETTINGS.dbLinks[cId][lvl][spc];
    if (linksObj && linksObj[module] && linksObj[module][cycle]) {
        const rawUrl = linksObj[module][cycle];
        const match = rawUrl.match(/folders\/([a-zA-Z0-9-_]+)/);
        return match ? match[1] : null;
    }

    return null;
}

// دالة فتح مدير الملفات ورفع الملفات من حساب الأستاذ
window.openSupervisorFileManager = function(module, cycle) {
    const folderId = resolveDriveFolder(module, cycle);

    if (!folderId) {
        Swal.fire({
            icon: 'info',
            title: 'المسار غير متوفر',
            text: 'لم يتم تعيين رابط مجلد Google Drive لهذا المقياس من طرف إدارة التكوين حتى الآن.'
        });
        return;
    }

    currentFolderId = folderId;
    const cacheKey = `files_data_${folderId}`;
    let cached = localStorage.getItem(cacheKey) || sessionStorage.getItem(cacheKey);
    if (cached) {
        try {
            const filesList = JSON.parse(cached);
            renderFmModal(folderId, filesList, module, cycle);
            
            // تحديث صامت في الخلفية
            fetch(`${APPS_SCRIPT_URL}?action=list&folderId=${folderId}`)
                .then(r => r.json())
                .then(d => {
                    if (!d.error) {
                        const fresh = Array.isArray(d) ? d : (Array.isArray(d?.files) ? d.files : []);
                        localStorage.setItem(cacheKey, JSON.stringify(fresh));
                        sessionStorage.setItem(cacheKey, JSON.stringify(fresh));
                    }
                }).catch(() => {});
            return;
        } catch(e) {}
    }

    Swal.fire({
        title: 'جاري استدعاء الملفات...',
        html: '<div class="spinner" style="margin:20px auto;"></div><p style="font-weight:700; color:#1E68E8;">جاري الاتصال بمجلد Google Drive...</p>',
        showConfirmButton: false,
        allowOutsideClick: false,
        width: '400px'
    });

    fetch(`${APPS_SCRIPT_URL}?action=list&folderId=${folderId}`)
        .then(r => r.json())
        .then(d => {
            if (d.error) {
                Swal.fire('خطأ', 'تعذر جلب ملفات المجلد، يرجى مراجعة الصلاحيات.', 'error');
            } else {
                const filesList = Array.isArray(d) ? d : (Array.isArray(d?.files) ? d.files : []);
                localStorage.setItem(cacheKey, JSON.stringify(filesList));
                sessionStorage.setItem(cacheKey, JSON.stringify(filesList));
                renderFmModal(folderId, filesList, module, cycle);
            }
        }).catch(err => {
            Swal.fire('خطأ', 'حدث خطأ في الاتصال بالخادم السحابي.', 'error');
        });
};

function renderFmModal(folderId, filesList, module, cycle) {
    const cycleNames = { 1: "الدورة الأولى", 2: "الدورة الثانية", 3: "الدورة الثالثة" };
    const cycleName = cycleNames[cycle] || `الدورة ${cycle}`;

    let filesHtml = "";
    if (!filesList || filesList.length === 0) {
        filesHtml = `
            <div style="grid-column: 1 / -1; text-align:center; padding:30px; color:#64748b; background:#f8fafc; border:2px dashed #cbd5e1; border-radius:14px;">
                <i class="fa-regular fa-folder-open" style="font-size:36px; margin-bottom:8px; display:block; color:#94a3b8;"></i>
                <div style="font-weight:700; font-size:14px;">لا توجد ملفات مرفوعة حالياً في هذه الدورة</div>
                <div style="font-size:12px; color:#94a3b8; margin-top:4px;">يمكنك البدء برفع مذكراتك وعروضك التقديمية عبر زر الرفع أدناه</div>
            </div>
        `;
    } else {
        filesHtml = filesList.map(f => {
            const previewUrl = `https://drive.google.com/file/d/${f.id}/preview`;
            const downloadUrl = `https://drive.google.com/uc?export=download&id=${f.id}`;
            return `
                <div class="fm-file-card">
                    <div class="fm-file-top">
                        <i class="fa-solid fa-file-lines fm-file-icon"></i>
                        <div class="fm-file-info">
                            <div class="fm-file-title" title="${f.name}">${f.name}</div>
                            <div class="fm-file-meta"><i class="fa-solid fa-cloud-check"></i> متوفر على Drive</div>
                        </div>
                    </div>
                    <div class="fm-file-actions">
                        <a href="${previewUrl}" target="_blank" class="btn-fm-act btn-fm-preview"><i class="fa-solid fa-eye"></i> معاينة</a>
                        <a href="${downloadUrl}" target="_blank" class="btn-fm-act btn-fm-download"><i class="fa-solid fa-download"></i> تحميل</a>
                        <button type="button" class="btn-fm-act btn-fm-delete" onclick="deleteSupervisorFile('${f.id}', '${folderId}', '${module}', ${cycle})"><i class="fa-solid fa-trash"></i> حذف</button>
                    </div>
                </div>
            `;
        }).join("");
    }

    const modalHtml = `
        <div class="file-manager-container">
            <div class="fm-upload-panel">
                <input type="file" id="supFileInput" style="display:none;" onchange="handleSupFileChosen(this)">
                <div style="display:flex; align-items:center; gap:10px; flex:1;">
                    <button type="button" class="upload-btn-real" onclick="document.getElementById('supFileInput').click()">
                        <i class="fa-solid fa-folder-open"></i> اختيار ملف للرفع
                    </button>
                    <span id="supFileChosenName" style="font-size:12px; font-weight:700; color:#64748b;">لم يتم اختيار أي ملف</span>
                </div>
                <button type="button" id="btnStartUpload" class="upload-btn-real" style="background:#16a34a; opacity:0.6; cursor:not-allowed;" disabled onclick="startSupervisorUpload('${folderId}', '${module}', ${cycle})">
                    <i class="fa-solid fa-cloud-arrow-up"></i> رفع الملف الآن
                </button>
            </div>

            <div style="font-size:13px; font-weight:800; color:#1e293b; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                <span><i class="fa-solid fa-list-check" style="color:#1E68E8;"></i> قائمة الملفات المتاحة (${filesList ? filesList.length : 0})</span>
                <a href="https://drive.google.com/drive/folders/${folderId}" target="_blank" style="font-size:12px; color:#1E68E8; text-decoration:none;">
                    <i class="fa-brands fa-google-drive"></i> فتح في Drive
                </a>
            </div>

            <div class="fm-files-grid" id="supFilesGrid">
                ${filesHtml}
            </div>
        </div>
    `;

    Swal.fire({
        title: `<div style="font-size:18px; font-weight:900; color:#0f172a;"><i class="fa-solid fa-cloud-arrow-up" style="color:#1E68E8; margin-left:8px;"></i> إدارة ملفات: ${module} - <span style="color:#1E68E8;">${cycleName}</span></div>`,
        html: modalHtml,
        width: '850px',
        showConfirmButton: true,
        confirmButtonText: 'إغلاق النافذة',
        confirmButtonColor: '#102a43'
    });
}

window.handleSupFileChosen = function(input) {
    const label = document.getElementById("supFileChosenName");
    const btn = document.getElementById("btnStartUpload");
    if (input.files && input.files[0]) {
        const file = input.files[0];
        label.innerText = file.name;
        label.style.color = "#16a34a";
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.style.cursor = "pointer";
    } else {
        label.innerText = "لم يتم اختيار أي ملف";
        label.style.color = "#64748b";
        btn.disabled = true;
        btn.style.opacity = "0.6";
        btn.style.cursor = "not-allowed";
    }
};

window.startSupervisorUpload = function(folderId, module, cycle) {
    const input = document.getElementById("supFileInput");
    if (!input || !input.files || !input.files[0]) return;

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        const rawData = e.target.result.split(',')[1];
        Swal.fire({
            title: 'جاري الرفع إلى Google Drive...',
            html: `يرجى الانتظار أثناء رفع <b>${file.name}</b> <div class="spinner" style="margin:15px auto;"></div>`,
            showConfirmButton: false,
            allowOutsideClick: false,
            width: '420px'
        });

        const formData = new FormData();
        formData.append('action', 'upload');
        formData.append('folderId', folderId);
        formData.append('data', rawData);
        formData.append('name', file.name);
        formData.append('mime', file.type);

        fetch(APPS_SCRIPT_URL, { method: 'POST', body: formData })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    localStorage.removeItem(`files_data_${folderId}`);
                    sessionStorage.removeItem(`files_data_${folderId}`);
                    Swal.fire({
                        icon: 'success',
                        title: 'تم الرفع بنجاح',
                        text: `تم رفع ملفك البيداغوجي ${file.name} بنجاح إلى المجلد المعتمد.`,
                        timer: 1800,
                        showConfirmButton: false
                    }).then(() => {
                        openSupervisorFileManager(module, cycle);
                    });
                } else {
                    Swal.fire('خطأ', data.message || 'فشل رفع الملف، يرجى المحاولة مرة أخرى.', 'error');
                }
            })
            .catch(err => {
                Swal.fire('خطأ', 'حدث انقطاع في الاتصال بالخادم أثناء الرفع.', 'error');
            });
    };

    reader.readAsDataURL(file);
};

window.deleteSupervisorFile = function(fileId, folderId, module, cycle) {
    Swal.fire({
        title: 'تأكيد الحذف',
        text: 'هل أنت متأكد من رغبتك في حذف هذا الملف من المجلد السحابي؟',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'نعم، حذف الملف',
        cancelButtonText: 'إلغاء'
    }).then((res) => {
        if (res.isConfirmed) {
            Swal.fire({
                title: 'جاري الحذف...',
                html: '<div class="spinner" style="margin:15px auto;"></div>',
                showConfirmButton: false,
                allowOutsideClick: false,
                width: '380px'
            });

            fetch(`${APPS_SCRIPT_URL}?action=delete&fileId=${fileId}&folderId=${folderId}`, { method: 'POST' })
                .then(r => r.json())
                .then(d => {
                    if (d.status === 'success') {
                        localStorage.removeItem(`files_data_${folderId}`);
                        sessionStorage.removeItem(`files_data_${folderId}`);
                        Swal.fire({
                            icon: 'success',
                            title: 'تم الحذف بنجاح',
                            timer: 1500,
                            showConfirmButton: false
                        }).then(() => {
                            openSupervisorFileManager(module, cycle);
                        });
                    } else {
                        Swal.fire('خطأ', 'فشل حذف الملف من السحابة.', 'error');
                    }
                })
                .catch(() => {
                    Swal.fire('خطأ', 'تعذر الاتصال بالخادم لحذف الملف.', 'error');
                });
        }
    });
};

window.logoutSupervisor = function() {
    sessionStorage.clear();
    window.location.href = (window.location.protocol === "file:") ? "index.html" : "/login";
};
