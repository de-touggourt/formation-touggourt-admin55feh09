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

// قاموس الربط بين المسميات العربية والمفاتيح البرمجية الإنجليزية المعتمدة في قاعدة البيانات
const MODULE_KEY_MAP = {
    // المفاتيح الإنجليزية
    "didactique": "didactique",
    "tasyire": "tasyire",
    "takwime": "takwime",
    "informatique": "informatique",
    "nidame": "nidame",
    "akhlakiyate": "akhlakiyate",
    "handasa": "handasa",
    "wasata": "wasata",
    "tachri": "tachri",
    "psycho": "psycho",
    "fasad": "fasad",

    // المسميات العربية الشائعة
    "تعليمية المادة": "didactique",
    "تعليمية مادة التخصص": "didactique",
    "تعليمية مادة التخصص وطرق التدريس": "didactique",
    "تقنيات تسيير القسم": "tasyire",
    "التقويم والمعالجة": "takwime",
    "التقويم والمعالجة البيداغوجية": "takwime",
    "التقييم والمعالجة البيداغوجية": "takwime",
    "الإعلام الآلي": "informatique",
    "تكنولوجيا الإعلام والاتصال": "informatique",
    "الإعلام الآلي وتكنولوجيا الإعلام و الاتصال": "informatique",
    "النظام التربوي": "nidame",
    "النظام التربوي الجزائري": "nidame",
    "النظام التربوي الجزائري والمناهج التعليمية": "nidame",
    "أخلاقيات المهنة": "akhlakiyate",
    "أخلاقيات وأدبيات المهنة": "akhlakiyate",
    "هندسة التكوين": "handasa",
    "هندسة التكوين والبيداغوجيا": "handasa",
    "الوساطة المدرسية": "wasata",
    "التشريع المدرسي": "tachri",
    "علوم التربية": "psycho",
    "علم النفس التربوي": "psycho",
    "علوم التربية وعلم النفس": "psycho",
    "الشفافية والوقاية من الفساد": "fasad",
    "الوقاية من الفساد": "fasad"
};

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
let currentSelectedRank = "";
let currentSelectedSpec = "";
let currentFolderId = null;
let currentModalFiles = [];

// تشغيل النظام عند تحميل الصفحة
window.onload = async function() {
    const loader = document.getElementById("loader");
    if (loader) loader.style.display = "flex";

    try {
        // 1. جلب إعدادات الموقع اللحظية من Firestore
        db.collection("site_settings").doc("main").onSnapshot((docSnap) => {
            if (docSnap.exists) {
                SITE_SETTINGS = docSnap.data();
                if (currentActiveCenterDoc && currentSelectedRank && currentSelectedSpec) {
                    renderModulesGrid();
                }
            }
        });

        // 2. جلب حسابات الأستاذ المؤطر المعتمدة من supervisor_accounts
        const accountsSnap = await db.collection("supervisor_accounts")
            .where("empId", "==", String(userEmpId))
            .get();

        // جلب بيانات التكليف من center_framers لضمان التحديث اللحظي للرتب والأفواج والتخصصات
        let framersSnap = null;
        try {
            framersSnap = await db.collection("center_framers")
                .where("empId", "==", String(userEmpId))
                .get();
        } catch(e) {
            console.warn("تعذر فحص center_framers احتياطياً:", e);
        }

        let framersByCenter = {};
        if (framersSnap && !framersSnap.empty) {
            framersSnap.forEach(d => {
                const fd = d.data();
                if (fd.center) framersByCenter[fd.center.trim()] = fd;
            });
        }

        if (accountsSnap.empty && Object.keys(framersByCenter).length === 0) {
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
                const cName = (data.center || "").trim();
                const fData = framersByCenter[cName] || {};

                // دمج الحقول من الجدولين لضمان أعلى دقة
                let specs = (data.specs && data.specs.length > 0) ? data.specs : (data.framingSpecs || fData.framingSpecs || fData.specs || []);
                let modules = (data.modules && data.modules.length > 0) ? data.modules : (data.framingModules || fData.framingModules || fData.modules || []);
                let groups = (data.groups && data.groups.length > 0) ? data.groups : (data.framingGroups || fData.framingGroups || fData.groups || []);
                let supervisedRanks = (data.supervisedRanks && data.supervisedRanks.length > 0) ? data.supervisedRanks : (data.framingRanks || fData.framingRanks || fData.supervisedRanks || (data.rank ? [data.rank] : []));

                let s1 = (typeof data.s1 !== 'undefined') ? !!data.s1 : ((typeof fData.s1 !== 'undefined') ? !!fData.s1 : true);
                let s2 = (typeof data.s2 !== 'undefined') ? !!data.s2 : ((typeof fData.s2 !== 'undefined') ? !!fData.s2 : false);
                let s3 = (typeof data.s3 !== 'undefined') ? !!data.s3 : ((typeof fData.s3 !== 'undefined') ? !!fData.s3 : false);

                activeList.push({ 
                    docId: doc.id, 
                    ...data,
                    specs,
                    modules,
                    groups,
                    supervisedRanks,
                    s1, s2, s3
                });
            }
        });

        if (activeList.length === 0) {
            Swal.fire({
                icon: 'warning',
                title: 'الحساب غير مفعل',
                text: 'حسابك في فضاء التأطير قيد المراجعة والاعتماد أو معطل من طرف إدارة المركز.',
                confirmButtonText: 'حسناً'
            }).then(() => {
                logoutSupervisor();
            });
            return;
        }

        supervisorAccounts = activeList;

        // تعيين الملف الشخصي للأستاذ
        setupProfileHeader(activeList[0]);

        // رسم بطاقات المراكز المعتمدة فقط (دون عرض المقاييس حتى يتم اختيار المركز)
        renderCentersGrid();

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

// رسم قائمة المراكز المكلف بها الأستاذ
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
                <div style="font-size: 13px; color: #1E68E8; font-weight: 800;">
                    اختيار <i class="fa-solid fa-chevron-left" style="margin-right: 4px;"></i>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// عند النقر على أي مركز: فتح نافذة اختيار الرتبة والتخصص
window.selectCenter = function(docId) {
    const found = supervisorAccounts.find(x => x.docId === docId);
    if (!found) return;

    currentActiveCenterDoc = found;

    // تمييز البطاقة النشطة
    document.querySelectorAll(".center-card").forEach(el => el.classList.remove("active"));
    const activeCard = document.getElementById(`card_${docId}`);
    if (activeCard) activeCard.classList.add("active");

    // فتح نافذة اختيار الرتبة والتخصص
    openRankSpecModal();
};

// نافذة اختيار الرتبة والتخصص للمركز المختار
window.openRankSpecModal = function() {
    if (!currentActiveCenterDoc) return;

    let ranks = currentActiveCenterDoc.supervisedRanks || currentActiveCenterDoc.framingRanks || [];
    if (ranks.length === 0 && currentActiveCenterDoc.rank && currentActiveCenterDoc.rank !== '-') {
        ranks = [currentActiveCenterDoc.rank];
    }
    if (ranks.length === 0) ranks = ["التعليم العام"];

    let specs = currentActiveCenterDoc.specs || currentActiveCenterDoc.framingSpecs || [];
    if (specs.length === 0) specs = ["جميع التخصصات"];

    let defaultRank = (currentSelectedRank && ranks.includes(currentSelectedRank)) ? currentSelectedRank : ranks[0];
    let defaultSpec = (currentSelectedSpec && specs.includes(currentSelectedSpec)) ? currentSelectedSpec : specs[0];

    let ranksOptions = ranks.map(r => `<option value="${r}" ${r === defaultRank ? 'selected' : ''}>${r}</option>`).join('');
    let specsOptions = specs.map(s => `<option value="${s}" ${s === defaultSpec ? 'selected' : ''}>${s}</option>`).join('');

    Swal.fire({
        title: '<div style="font-size:19px; font-weight:900; color:#102a43;"><i class="fa-solid fa-graduation-cap" style="color:#1E68E8; margin-left:8px;"></i> تحديد الرتبة والتخصص للتأطير</div>',
        html: `
            <div style="text-align:right; font-family:'Cairo'; padding:10px 5px;">
                <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:12px; padding:12px; margin-bottom:18px;">
                    <div style="font-size:12px; font-weight:800; color:#1e40af; margin-bottom:4px;"><i class="fa-solid fa-school"></i> مركز التكوين:</div>
                    <div style="font-size:15px; font-weight:900; color:#0f172a;">${currentActiveCenterDoc.center}</div>
                </div>

                <div style="margin-bottom:15px;">
                    <label style="display:block; font-size:13px; font-weight:800; color:#334155; margin-bottom:6px;">
                        <i class="fa-solid fa-user-graduate" style="color:#1E68E8;"></i> اختر الرتبة المسندة لك:
                    </label>
                    <select id="modalSelRank" style="width:100%; padding:10px 14px; border:2px solid #cbd5e1; border-radius:10px; font-family:'Cairo'; font-size:14px; font-weight:700; outline:none; background:#fff;">
                        ${ranksOptions}
                    </select>
                </div>

                <div style="margin-bottom:15px;">
                    <label style="display:block; font-size:13px; font-weight:800; color:#334155; margin-bottom:6px;">
                        <i class="fa-solid fa-book-bookmark" style="color:#e67e22;"></i> اختر التخصص المسند لك:
                    </label>
                    <select id="modalSelSpec" style="width:100%; padding:10px 14px; border:2px solid #cbd5e1; border-radius:10px; font-family:'Cairo'; font-size:14px; font-weight:700; outline:none; background:#fff;" onchange="window.updateModalGroupsPreview()">
                        ${specsOptions}
                    </select>
                </div>

                <div id="modalGroupsPreviewBox" style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px; font-size:12.5px; color:#475569;">
                    <!-- معاينة الأفواج التابعة للتخصص -->
                </div>
            </div>
        `,
        width: '520px',
        showCancelButton: true,
        confirmButtonColor: '#1E68E8',
        cancelButtonColor: '#64748b',
        confirmButtonText: '<i class="fa-solid fa-check"></i> تأكيد واستعراض المقاييس',
        cancelButtonText: 'إلغاء',
        didOpen: () => {
            window.updateModalGroupsPreview = () => {
                const specVal = document.getElementById("modalSelSpec") ? document.getElementById("modalSelSpec").value : "";
                const previewBox = document.getElementById("modalGroupsPreviewBox");
                if (!previewBox) return;

                let allGroups = currentActiveCenterDoc.groups || currentActiveCenterDoc.framingGroups || [];
                let matchingGroups = allGroups.filter(g => g.startsWith(specVal + "::") || !g.includes("::"));
                let grpNames = matchingGroups.map(g => g.includes("::") ? g.split("::")[1] : g);

                if (grpNames.length > 0) {
                    previewBox.innerHTML = `<b><i class="fa-solid fa-users" style="color:#0FBA50;"></i> الأفواج المسندة لهذا التخصص:</b> <span style="color:#0f172a; font-weight:800;">${grpNames.join("، ")}</span>`;
                } else {
                    previewBox.innerHTML = `<b><i class="fa-solid fa-users" style="color:#0FBA50;"></i> الأفواج المسندة:</b> <span style="color:#0f172a; font-weight:800;">جميع أفواج المركز</span>`;
                }
            };
            window.updateModalGroupsPreview();
        },
        preConfirm: () => {
            const r = document.getElementById("modalSelRank").value;
            const s = document.getElementById("modalSelSpec").value;
            if (!r || !s) {
                Swal.showValidationMessage("يرجى اختيار الرتبة والتخصص!");
                return false;
            }
            return { rank: r, spec: s };
        }
    }).then((res) => {
        if (res.isConfirmed && res.value) {
            currentSelectedRank = res.value.rank;
            currentSelectedSpec = res.value.spec;
            applySelectionAndRenderModules();
        }
    });
};

function applySelectionAndRenderModules() {
    if (!currentActiveCenterDoc) return;

    // إخفاء إشعار الانتظار وإظهار بطاقة المقاييس
    const noticeEl = document.getElementById("noCenterSelectedNotice");
    if (noticeEl) noticeEl.style.display = "none";

    const modulesCard = document.getElementById("modulesSectionCard");
    if (modulesCard) {
        modulesCard.style.display = "block";
        modulesCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // تحديث بيانات التكليف بالمركز في الهيدر التفصيلي
    document.getElementById("detCenterName").innerText = currentActiveCenterDoc.center;
    document.getElementById("detRanks").innerText = currentSelectedRank || "غير محدد";
    document.getElementById("detSpecs").innerText = currentSelectedSpec || "غير محدد";

    // تصفية الأفواج المناسبة للتخصص المختار
    let allGroups = currentActiveCenterDoc.groups || currentActiveCenterDoc.framingGroups || [];
    let matchingGroups = allGroups.filter(g => g.startsWith(currentSelectedSpec + "::") || !g.includes("::"));
    let grpNames = matchingGroups.map(g => g.includes("::") ? g.split("::")[1] : g);
    document.getElementById("detGroups").innerText = grpNames.length > 0 ? grpNames.join("، ") : "كل الأفواج";

    // رسم المقاييس المتاحة للرفع
    renderModulesGrid();
}

// فحص هل الدورة مفتوحة مركزياً في site_settings
function isCycleOpen(module, cycle) {
    if (!SITE_SETTINGS) return false;

    // 1. فحص هل الدورة العامة مفتوحة
    const isGlobalOpen = SITE_SETTINGS.GLOBAL_CYCLE_STATUS 
        ? ((typeof SITE_SETTINGS.GLOBAL_CYCLE_STATUS[cycle] !== 'undefined') ? SITE_SETTINGS.GLOBAL_CYCLE_STATUS[cycle] : SITE_SETTINGS.GLOBAL_CYCLE_STATUS[String(cycle)])
        : true;
    if (isGlobalOpen === false) return false;

    // 2. فحص حالة المقياس بالاسم العربي أو بالمفتاح الإنجليزي
    const modKey = MODULE_KEY_MAP[module] || module;
    if (SITE_SETTINGS.MODULE_CYCLE_STATUS) {
        let mStatus = undefined;
        if (SITE_SETTINGS.MODULE_CYCLE_STATUS[modKey]) {
            mStatus = (typeof SITE_SETTINGS.MODULE_CYCLE_STATUS[modKey][cycle] !== 'undefined')
                ? SITE_SETTINGS.MODULE_CYCLE_STATUS[modKey][cycle]
                : SITE_SETTINGS.MODULE_CYCLE_STATUS[modKey][String(cycle)];
        } else if (SITE_SETTINGS.MODULE_CYCLE_STATUS[module]) {
            mStatus = (typeof SITE_SETTINGS.MODULE_CYCLE_STATUS[module][cycle] !== 'undefined')
                ? SITE_SETTINGS.MODULE_CYCLE_STATUS[module][cycle]
                : SITE_SETTINGS.MODULE_CYCLE_STATUS[module][String(cycle)];
        }
        if (typeof mStatus !== 'undefined') {
            return !!mStatus;
        }
    }

    return !!isGlobalOpen;
}

// رسم بطاقات المقاييس المسندة مع الدورات
function renderModulesGrid() {
    const container = document.getElementById("modulesContainer");
    if (!container || !currentActiveCenterDoc) return;

    // المقاييس المسندة للأستاذ
    let assignedModules = currentActiveCenterDoc.modules || currentActiveCenterDoc.framingModules || [];
    if (assignedModules.length === 0) {
        assignedModules = DEFAULT_MODULES;
    }

    let html = "";
    assignedModules.forEach(mod => {
        // فحص الشرط الثنائي لكل دورة:
        // 1. هل المقياس والدورة مفتوحان في النظام المركزي
        // 2. هل الأستاذ مكلف بهذه الدورة (s1, s2, s3)
        const s1Allowed = !!currentActiveCenterDoc.s1;
        const s2Allowed = !!currentActiveCenterDoc.s2;
        const s3Allowed = !!currentActiveCenterDoc.s3;

        const c1CentralOpen = isCycleOpen(mod, 1);
        const c2CentralOpen = isCycleOpen(mod, 2);
        const c3CentralOpen = isCycleOpen(mod, 3);

        const c1Active = s1Allowed && c1CentralOpen;
        const c2Active = s2Allowed && c2CentralOpen;
        const c3Active = s3Allowed && c3CentralOpen;

        const getBadgeInfo = (isAllowed, isCentral) => {
            if (!isAllowed) return { text: 'غير مسند لك', cls: 'pill-closed' };
            if (!isCentral) return { text: 'مغلقة مركزياً', cls: 'pill-closed' };
            return { text: 'مفتوحة للرفع', cls: 'pill-open' };
        };

        const b1 = getBadgeInfo(s1Allowed, c1CentralOpen);
        const b2 = getBadgeInfo(s2Allowed, c2CentralOpen);
        const b3 = getBadgeInfo(s3Allowed, c3CentralOpen);

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
                        <div class="cycle-row-btn ${c1Active ? '' : 'closed'}" onclick="${c1Active ? `openSupervisorFileManager('${mod}', 1)` : `notifyCycleClosed('${b1.text}')`}">
                            <span><i class="fa-solid fa-calendar-day" style="margin-left:6px;"></i> الدورة التكوينية الأولى</span>
                            <span class="cycle-status-pill ${b1.cls}">${b1.text}</span>
                        </div>

                        <div class="cycle-row-btn ${c2Active ? '' : 'closed'}" onclick="${c2Active ? `openSupervisorFileManager('${mod}', 2)` : `notifyCycleClosed('${b2.text}')`}">
                            <span><i class="fa-solid fa-calendar-day" style="margin-left:6px;"></i> الدورة التكوينية الثانية</span>
                            <span class="cycle-status-pill ${b2.cls}">${b2.text}</span>
                        </div>

                        <div class="cycle-row-btn ${c3Active ? '' : 'closed'}" onclick="${c3Active ? `openSupervisorFileManager('${mod}', 3)` : `notifyCycleClosed('${b3.text}')`}">
                            <span><i class="fa-solid fa-calendar-day" style="margin-left:6px;"></i> الدورة التكوينية الثالثة</span>
                            <span class="cycle-status-pill ${b3.cls}">${b3.text}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

window.notifyCycleClosed = function(reason) {
    Swal.fire({
        icon: 'info',
        title: 'الدورة مغلقة للرفع',
        text: `هذه الدورة غير متاحة للرفع حالياً (${reason}).`,
        timer: 2000,
        showConfirmButton: false
    });
};

// دالة ذكية لتحديد معرف مجلد Google Drive بدقة تامة اعتماداً على المركز، الطور، التخصص، والمقياس
function resolveDriveFolder(module, cycle) {
    if (!SITE_SETTINGS || !SITE_SETTINGS.dbLinks || !currentActiveCenterDoc) return null;

    const centerName = currentActiveCenterDoc.center;
    let cId = null;

    // 1. البحث عن مفتاح المركز في UI_NAMES.centers
    if (SITE_SETTINGS.UI_NAMES && SITE_SETTINGS.UI_NAMES.centers) {
        for (let k in SITE_SETTINGS.UI_NAMES.centers) {
            if (SITE_SETTINGS.UI_NAMES.centers[k] && SITE_SETTINGS.UI_NAMES.centers[k].trim() === centerName.trim()) {
                cId = k;
                break;
            }
        }
    }
    if (!cId && SITE_SETTINGS.dbLinks[centerName]) cId = centerName;
    if (!cId) {
        for (let k in SITE_SETTINGS.UI_NAMES?.centers || {}) {
            let name = SITE_SETTINGS.UI_NAMES.centers[k];
            if (name && (name.includes(centerName) || centerName.includes(name))) {
                cId = k;
                break;
            }
        }
    }
    if (!cId && Object.keys(SITE_SETTINGS.dbLinks).length > 0) {
        cId = Object.keys(SITE_SETTINGS.dbLinks)[0];
    }

    if (!cId || !SITE_SETTINGS.dbLinks[cId]) return null;

    // 2. كشف الطور والمستوى التعليمي من الرتبة المحددة
    let rankToUse = currentSelectedRank || (currentActiveCenterDoc.supervisedRanks && currentActiveCenterDoc.supervisedRanks[0]) || currentActiveCenterDoc.rank || "";
    let lvl = 'middle';
    if (rankToUse.includes('ثانوي')) lvl = 'secondary';
    else if (rankToUse.includes('ابتدائي')) lvl = 'primary';
    else if (rankToUse.includes('متوسط')) lvl = 'middle';
    else {
        lvl = Object.keys(SITE_SETTINGS.dbLinks[cId])[0] || 'middle';
    }

    if (!SITE_SETTINGS.dbLinks[cId][lvl]) {
        lvl = Object.keys(SITE_SETTINGS.dbLinks[cId])[0] || 'middle';
    }

    // 3. كشف التخصص من التخصص المحدد
    let specToUse = currentSelectedSpec || (currentActiveCenterDoc.specs && currentActiveCenterDoc.specs[0]) || "";
    let spc = 'others';
    if (specToUse.includes('عرب')) spc = 'arabic';
    else if (specToUse.includes('فرنس')) spc = 'french';
    else if (specToUse.includes('إنجليز') || specToUse.includes('انجليز')) spc = 'english';
    else if (specToUse.includes('رياض') || specToUse.includes('بدني')) spc = 'sport';
    else {
        spc = Object.keys(SITE_SETTINGS.dbLinks[cId][lvl] || {})[0] || 'others';
    }

    if (SITE_SETTINGS.dbLinks[cId][lvl] && !SITE_SETTINGS.dbLinks[cId][lvl][spc]) {
        spc = Object.keys(SITE_SETTINGS.dbLinks[cId][lvl])[0] || 'others';
    }

    // 4. ترجمة اسم المقياس إلى المفتاح الإنجليزي المستخدم في dbLinks
    const modKey = MODULE_KEY_MAP[module] || module;

    // البحث المباشر في الرابط المحدد
    if (SITE_SETTINGS.dbLinks[cId] && SITE_SETTINGS.dbLinks[cId][lvl] && SITE_SETTINGS.dbLinks[cId][lvl][spc]) {
        const linksObj = SITE_SETTINGS.dbLinks[cId][lvl][spc];
        if (linksObj[modKey] && linksObj[modKey][cycle]) {
            const rawUrl = linksObj[modKey][cycle];
            const match = rawUrl.match(/folders\/([a-zA-Z0-9-_]+)/);
            if (match) return match[1];
        }
        // في حال كان اسم المقياس مخزناً باللغة العربية
        if (linksObj[module] && linksObj[module][cycle]) {
            const rawUrl = linksObj[module][cycle];
            const match = rawUrl.match(/folders\/([a-zA-Z0-9-_]+)/);
            if (match) return match[1];
        }
    }

    // 5. بحث احتياطي ذكي في باقي أطوار وتخصصات هذا المركز
    if (SITE_SETTINGS.dbLinks[cId]) {
        for (let l in SITE_SETTINGS.dbLinks[cId]) {
            for (let s in SITE_SETTINGS.dbLinks[cId][l]) {
                const targetObj = SITE_SETTINGS.dbLinks[cId][l][s];
                if (targetObj && targetObj[modKey] && targetObj[modKey][cycle]) {
                    const rawUrl = targetObj[modKey][cycle];
                    const match = rawUrl.match(/folders\/([a-zA-Z0-9-_]+)/);
                    if (match) return match[1];
                }
                if (targetObj && targetObj[module] && targetObj[module][cycle]) {
                    const rawUrl = targetObj[module][cycle];
                    const match = rawUrl.match(/folders\/([a-zA-Z0-9-_]+)/);
                    if (match) return match[1];
                }
            }
        }
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
            text: `لم يتم تعيين رابط مجلد Google Drive لمقياس "${module}" بهذه الدورة من طرف إدارة التكوين حتى الآن.`
        });
        return;
    }

    currentFolderId = folderId;
    const cacheKey = `files_data_${folderId}`;
    let cached = localStorage.getItem(cacheKey) || sessionStorage.getItem(cacheKey);
    if (cached) {
        try {
            const filesList = JSON.parse(cached);
            currentModalFiles = filesList;
            renderFmModal(folderId, filesList, module, cycle);
            
            // تحديث صامت في الخلفية
            fetch(`${APPS_SCRIPT_URL}?action=list&folderId=${folderId}`)
                .then(r => r.json())
                .then(d => {
                    if (!d.error) {
                        const fresh = Array.isArray(d) ? d : (Array.isArray(d?.files) ? d.files : []);
                        currentModalFiles = fresh;
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
                currentModalFiles = filesList;
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

    let filesHtml = buildFilesCardsHtml(filesList, folderId, module, cycle);

    const modalHtml = `
        <div class="file-manager-container">
            <div class="fm-header-bar">
                <div class="fm-search-box">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="text" placeholder="بحث في ملفات المجلد..." oninput="filterModalFiles(this.value, '${folderId}', '${module}', ${cycle})">
                </div>
                <div style="font-size: 13px; font-weight: 800; color: #475569;">
                    <i class="fa-solid fa-graduation-cap" style="color:#1E68E8;"></i> ${currentSelectedRank} | ${currentSelectedSpec}
                </div>
            </div>

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
                <span id="fmFilesCountLabel"><i class="fa-solid fa-list-check" style="color:#1E68E8;"></i> قائمة الملفات المتاحة (${filesList ? filesList.length : 0})</span>
                <a href="https://drive.google.com/drive/folders/${folderId}" target="_blank" style="font-size:12px; color:#1E68E8; text-decoration:none; font-weight: bold;">
                    <i class="fa-brands fa-google-drive"></i> فتح المجلد في Drive
                </a>
            </div>

            <div class="fm-files-grid" id="supFilesGrid">
                ${filesHtml}
            </div>
        </div>
    `;

    Swal.fire({
        title: `<div style="font-size:18px; font-weight:900; color:#0f172a;"><i class="fa-solid fa-cloud-arrow-up" style="color:#1E68E8; margin-left:8px;"></i> ملفات مقياس: ${module} - <span style="color:#1E68E8;">${cycleName}</span></div>`,
        html: modalHtml,
        width: '860px',
        showConfirmButton: true,
        confirmButtonText: 'إغلاق النافذة',
        confirmButtonColor: '#102a43'
    });
}

function buildFilesCardsHtml(filesList, folderId, module, cycle) {
    if (!filesList || filesList.length === 0) {
        return `
            <div style="grid-column: 1 / -1; text-align:center; padding:35px; color:#64748b; background:#f8fafc; border:2px dashed #cbd5e1; border-radius:14px;">
                <i class="fa-regular fa-folder-open" style="font-size:38px; margin-bottom:8px; display:block; color:#94a3b8;"></i>
                <div style="font-weight:800; font-size:14px; color:#1e293b;">لا توجد ملفات مرفوعة حالياً في هذه الدورة</div>
                <div style="font-size:12px; color:#94a3b8; margin-top:5px;">يمكنك البدء برفع مذكراتك وعروضك التقديمية عبر زر الرفع أعلاه</div>
            </div>
        `;
    }

    return filesList.map(f => {
        const previewUrl = `https://drive.google.com/file/d/${f.id}/preview`;
        const downloadUrl = `https://drive.google.com/uc?export=download&id=${f.id}`;
        return `
            <div class="fm-file-card">
                <div class="fm-file-top">
                    <i class="fa-solid fa-file-lines fm-file-icon"></i>
                    <div class="fm-file-info">
                        <div class="fm-file-title" title="${f.name}">${f.name}</div>
                        <div class="fm-file-meta"><i class="fa-solid fa-cloud-check" style="color:#16a34a;"></i> متوفر على Drive</div>
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

window.filterModalFiles = function(query, folderId, module, cycle) {
    const grid = document.getElementById("supFilesGrid");
    const countLabel = document.getElementById("fmFilesCountLabel");
    if (!grid) return;

    let filtered = currentModalFiles || [];
    if (query && query.trim() !== '') {
        const q = query.trim().toLowerCase();
        filtered = filtered.filter(f => (f.name || '').toLowerCase().includes(q));
    }

    grid.innerHTML = buildFilesCardsHtml(filtered, folderId, module, cycle);
    if (countLabel) {
        countLabel.innerHTML = `<i class="fa-solid fa-list-check" style="color:#1E68E8;"></i> قائمة الملفات المتاحة (${filtered.length})`;
    }
};

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
